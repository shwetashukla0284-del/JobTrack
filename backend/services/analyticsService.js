// =========================================================
// JOB SEARCH ANALYTICS
//
// All KPIs are defined here, once, and used by both the dashboard
// statistics and the /api/analytics endpoint.
// Metric definitions are documented in docs/metrics.md.
//
// How it works (think of it like SQL):
//   1. $match      -> WHERE userId = ?
//   2. $addFields  -> add calculated columns per job (flags like
//                     "reachedInterview", and "daysToResponse")
//   3. $group      -> GROUP BY, with SUM(CASE WHEN flag THEN 1 ELSE 0)
//   4. $facet      -> run several GROUP BY queries over the same rows
//                     in a single database round trip
// =========================================================

const mongoose = require("mongoose");
const Job = require("../models/job");

// Applications still "Applied" after this many days count as stale
// (most likely ghosted). Used to prompt follow-ups.
const STALE_AFTER_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------
// Stage 1 + 2: one row per job, with calculated flags
// ---------------------------------------------------------

const jobMetricStages = (userId) => {
    // List of every status this job has ever had, e.g. ["Applied", "Interview"]
    const historyStatuses = {
        $ifNull: ["$statusHistory.status", []]
    };

    const everHad = (status) => ({
        $or: [
            { $in: [status, historyStatuses] },
            { $eq: ["$status", status] }
        ]
    });

    return [
        {
            // Aggregations don't auto-convert strings to ObjectIds
            $match: {
                userId: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $addFields: {
                // Any change away from "Applied" means the company replied
                // (a rejection is a response too)
                responded: {
                    $or: [
                        { $ne: ["$status", "Applied"] },
                        {
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: historyStatuses,
                                            cond: { $ne: ["$$this", "Applied"] }
                                        }
                                    }
                                },
                                0
                            ]
                        }
                    ]
                },

                // An offer implies the candidate got through the interview stage
                reachedInterview: {
                    $or: [everHad("Interview"), everHad("Offer")]
                },

                reachedOffer: everHad("Offer"),

                isRejected: { $eq: ["$status", "Rejected"] },

                isAwaitingResponse: { $eq: ["$status", "Applied"] },

                // First event that isn't "Applied" = the first response
                firstResponse: {
                    $first: {
                        $filter: {
                            input: { $ifNull: ["$statusHistory", []] },
                            cond: { $ne: ["$$this.status", "Applied"] }
                        }
                    }
                },

                sourceLabel: { $ifNull: ["$source", "Unknown"] }
            }
        },
        {
            $addFields: {
                // Whole days between applying and the first response
                // (null when there has been no response yet).
                // dateApplied is a calendar date at UTC midnight, so a same-day
                // response in a timezone ahead of UTC can show as -1: treat as 0.
                daysToResponse: {
                    $cond: [
                        { $ifNull: ["$firstResponse.changedAt", false] },
                        {
                            $let: {
                                vars: {
                                    days: {
                                        $dateDiff: {
                                            startDate: "$dateApplied",
                                            endDate: "$firstResponse.changedAt",
                                            unit: "day"
                                        }
                                    }
                                },
                                in: {
                                    $cond: [
                                        { $eq: ["$$days", -1] },
                                        0,
                                        "$$days"
                                    ]
                                }
                            }
                        },
                        null
                    ]
                },

                isStale: {
                    $and: [
                        { $eq: ["$status", "Applied"] },
                        {
                            $lt: [
                                "$dateApplied",
                                new Date(Date.now() - STALE_AFTER_DAYS * DAY_MS)
                            ]
                        }
                    ]
                }
            }
        }
    ];
};

// SUM(CASE WHEN <flag> THEN 1 ELSE 0 END)
const countWhere = (flag) => ({
    $sum: { $cond: [flag, 1, 0] }
});

const funnelCounts = {
    applications: { $sum: 1 },
    responded: countWhere("$responded"),
    reachedInterview: countWhere("$reachedInterview"),
    reachedOffer: countWhere("$reachedOffer"),
    rejected: countWhere("$isRejected")
};

// ---------------------------------------------------------
// Helpers (plain JavaScript, after the query)
// ---------------------------------------------------------

// Percentage with one decimal place.
// Returns null when there is nothing to divide by: "no data" is
// different from "0%".
const rate = (part, whole) =>
    whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

const median = (sortedValues) => {
    const count = sortedValues.length;

    if (count === 0) {
        return null;
    }

    const middle = Math.floor(count / 2);

    return count % 2 === 0
        ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
        : sortedValues[middle];
};

const withRates = (row) => ({
    applications: row.applications,
    responded: row.responded,
    reachedInterview: row.reachedInterview,
    reachedOffer: row.reachedOffer,
    rejected: row.rejected,
    responseRate: rate(row.responded, row.applications),
    interviewRate: rate(row.reachedInterview, row.applications),
    offerRate: rate(row.reachedOffer, row.applications)
});

const EMPTY_SUMMARY = {
    applications: 0,
    responded: 0,
    reachedInterview: 0,
    reachedOffer: 0,
    rejected: 0,
    awaitingResponse: 0,
    stale: 0
};

// ---------------------------------------------------------
// Dashboard summary (one query instead of five counts)
// ---------------------------------------------------------

const getSummary = async (userId) => {
    const [row = EMPTY_SUMMARY] = await Job.aggregate([
        ...jobMetricStages(userId),
        {
            $group: {
                _id: null,
                ...funnelCounts,
                awaitingResponse: countWhere("$isAwaitingResponse"),
                stale: countWhere("$isStale")
            }
        }
    ]);

    return {
        ...withRates(row),
        awaitingResponse: row.awaitingResponse,
        stale: row.stale
    };
};

// ---------------------------------------------------------
// Full analytics
// ---------------------------------------------------------

const getAnalytics = async (userId) => {
    const [result] = await Job.aggregate([
        ...jobMetricStages(userId),
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            ...funnelCounts,
                            awaitingResponse: countWhere("$isAwaitingResponse"),
                            stale: countWhere("$isStale")
                        }
                    }
                ],

                // Applications per week (weeks start on Monday)
                weekly: [
                    {
                        $group: {
                            _id: {
                                $dateTrunc: {
                                    date: "$dateApplied",
                                    unit: "week",
                                    startOfWeek: "monday"
                                }
                            },
                            ...funnelCounts
                        }
                    },
                    { $sort: { _id: 1 } }
                ],

                // Conversion by channel
                bySource: [
                    {
                        $group: {
                            _id: "$sourceLabel",
                            ...funnelCounts
                        }
                    },
                    { $sort: { applications: -1, _id: 1 } }
                ],

                // Negative values (response before applying) are bad data;
                // they are excluded here and counted in dataQuality
                responseDays: [
                    { $match: { daysToResponse: { $gte: 0 } } },
                    { $sort: { daysToResponse: 1 } },
                    { $group: { _id: null, days: { $push: "$daysToResponse" } } }
                ],

                // How complete is the data? Missing values limit the analysis.
                dataQuality: [
                    {
                        $group: {
                            _id: null,
                            missingSource: countWhere({ $eq: ["$sourceLabel", "Unknown"] }),
                            missingLocation: countWhere({
                                $eq: [{ $ifNull: ["$location", ""] }, ""]
                            }),
                            missingHistory: countWhere({
                                $eq: [{ $size: { $ifNull: ["$statusHistory", []] } }, 0]
                            }),
                            responseBeforeApplied: countWhere({
                                $and: [
                                    { $ne: ["$daysToResponse", null] },
                                    { $lt: ["$daysToResponse", 0] }
                                ]
                            })
                        }
                    }
                ]
            }
        }
    ]);

    const summaryRow = result.summary[0] || EMPTY_SUMMARY;
    const summary = withRates(summaryRow);
    const days = result.responseDays[0]?.days || [];
    // eslint-disable-next-line no-unused-vars
    const { _id, ...quality } = result.dataQuality[0] || {
        missingSource: 0,
        missingLocation: 0,
        missingHistory: 0,
        responseBeforeApplied: 0
    };

    // Each funnel step as a share of the step before it
    const funnelSteps = [
        ["Applied", summary.applications],
        ["Responded", summary.responded],
        ["Interview", summary.reachedInterview],
        ["Offer", summary.reachedOffer]
    ];

    const funnel = funnelSteps.map(([stage, count], index) => ({
        stage,
        count,
        conversionFromPrevious:
            index === 0 ? null : rate(count, funnelSteps[index - 1][1])
    }));

    return {
        summary: {
            ...summary,
            awaitingResponse: summaryRow.awaitingResponse,
            stale: summaryRow.stale,
            staleAfterDays: STALE_AFTER_DAYS,
            interviewToOfferRate: rate(
                summary.reachedOffer,
                summary.reachedInterview
            )
        },

        funnel,

        responseTime: {
            respondedCount: days.length,
            medianDays: median(days),
            averageDays:
                days.length === 0
                    ? null
                    : Math.round(
                        (days.reduce((sum, value) => sum + value, 0) /
                            days.length) * 10
                    ) / 10,
            minDays: days.length ? days[0] : null,
            maxDays: days.length ? days[days.length - 1] : null
        },

        weekly: result.weekly.map((row) => ({
            weekStart: row._id,
            ...withRates(row)
        })),

        bySource: result.bySource.map((row) => ({
            source: row._id,
            ...withRates(row)
        })),

        dataQuality: {
            totalRecords: summary.applications,
            ...quality
        }
    };
};

module.exports = {
    getSummary,
    getAnalytics,
    // exported for testing
    median,
    rate
};
