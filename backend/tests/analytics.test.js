// Analytics KPIs checked against values calculated by hand for a small,
// deliberately tricky dataset.

const { describe, test, before, after, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const Job = require("../models/job");
const { getAnalytics } = require("../services/analyticsService");
const { startDb, clearDb, stopDb, createUser, auth, assertIncludes } = require("./helpers");

before(startDb);
afterEach(clearDb);
after(stopDb);

const date = (text) => new Date(text);
const history = (...events) => events.map(([status, at]) => ({ status, changedAt: date(at) }));

const seed = async (userId) => {
    const base = { userId, role: "Data Analyst", location: "Pune" };
    const otherUser = new mongoose.Types.ObjectId();

    await Job.insertMany([
        // J1: Applied -> Interview -> Offer, 5 days to first reply
        { ...base, company: "J1", source: "LinkedIn", status: "Offer", dateApplied: date("2026-10-05"),
          statusHistory: history(["Applied", "2026-10-05"], ["Interview", "2026-10-10T10:00Z"], ["Offer", "2026-10-20"]) },
        // J2: rejected after 3 days
        { ...base, company: "J2", source: "Referral", status: "Rejected", dateApplied: date("2026-10-06"),
          statusHistory: history(["Applied", "2026-10-06"], ["Rejected", "2026-10-09T00:00Z"]) },
        // J3: interviewed after 7 days, then rejected
        { ...base, company: "J3", source: "Referral", status: "Rejected", dateApplied: date("2026-10-13"),
          statusHistory: history(["Applied", "2026-10-13"], ["Interview", "2026-10-20T12:00Z"], ["Rejected", "2026-10-25"]) },
        // J4: no reply for a long time (stale), no source
        { ...base, company: "J4", status: "Applied", dateApplied: date("2026-09-01"),
          statusHistory: history(["Applied", "2026-09-01"]) },
        // J6: same-day reply in IST that is the previous day in UTC (-1 -> 0 days)
        { ...base, company: "J6", source: "LinkedIn", status: "Interview", dateApplied: date("2026-10-15"),
          statusHistory: history(["Applied", "2026-10-15"], ["Interview", "2026-10-14T20:00Z"]) },
        // J7: impossible date (reply 10 days before applying)
        { ...base, company: "J7", source: "Job Board", status: "Rejected", dateApplied: date("2026-10-20"),
          statusHistory: history(["Applied", "2026-10-20"], ["Rejected", "2026-10-10"]) },
        // Another user's job: must never be counted
        { ...base, userId: otherUser, company: "OTHER", status: "Offer", dateApplied: date("2026-10-05"),
          statusHistory: history(["Applied", "2026-10-05"], ["Offer", "2026-10-06"]) }
    ]);

    // J5: created before status history existed (no history field, no source, no location)
    await Job.collection.insertOne({
        userId: new mongoose.Types.ObjectId(userId), company: "J5", role: "DA", status: "Interview",
        dateApplied: date("2026-10-14"), createdAt: date("2026-10-14"), updatedAt: date("2026-10-18")
    });
};

describe("getAnalytics", () => {
    let analytics;

    beforeEach(async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        await seed(userId);
        analytics = await getAnalytics(userId);
    });

    test("funnel counts use 'ever reached', not just the current status", () => {
        assertIncludes(analytics.summary, {
            applications: 7,
            responded: 6,          // everything except J4
            reachedInterview: 4,   // J1 (now Offer), J3 (now Rejected), J5 (no history), J6
            reachedOffer: 1,
            rejected: 3,
            awaitingResponse: 1,
            stale: 1
        });
    });

    test("rates are rounded to one decimal place", () => {
        assertIncludes(analytics.summary, {
            responseRate: 85.7,
            interviewRate: 57.1,
            offerRate: 14.3,
            interviewToOfferRate: 25
        });
        assert.deepEqual(analytics.funnel.map((step) => [step.stage, step.count, step.conversionFromPrevious]), [
            ["Applied", 7, null],
            ["Responded", 6, 85.7],
            ["Interview", 4, 66.7],
            ["Offer", 1, 25]
        ]);
    });

    test("response time: -1 day counts as 0, impossible dates are excluded", () => {
        // valid replies: J6 0 days, J2 3, J1 5, J3 7
        assert.deepEqual(analytics.responseTime, {
            respondedCount: 4, medianDays: 4, averageDays: 3.8, minDays: 0, maxDays: 7
        });
    });

    test("weekly groups start on Monday", () => {
        assert.deepEqual(analytics.weekly.map((week) => [week.weekStart.toISOString().slice(0, 10), week.applications]),
            [["2026-08-31", 1], ["2026-10-05", 2], ["2026-10-12", 3], ["2026-10-19", 1]]);
    });

    test("conversion by source, with missing source as 'Unknown'", () => {
        assert.deepEqual(analytics.bySource.map((row) => [row.source, row.applications, row.reachedInterview]),
            [["LinkedIn", 2, 2], ["Referral", 2, 1], ["Unknown", 2, 1], ["Job Board", 1, 0]]);
    });

    test("data quality counts", () => {
        assert.deepEqual(analytics.dataQuality, {
            totalRecords: 7, missingSource: 2, missingLocation: 1, missingHistory: 1, responseBeforeApplied: 1
        });
    });
});

describe("GET /api/analytics", () => {
    test("requires login", async () => {
        assert.equal((await request(app).get("/api/analytics")).status, 401);
    });

    test("a user with no jobs gets null rates ('no data'), not 0%", async () => {
        const { token } = await createUser(app);
        const response = await request(app).get("/api/analytics").set(auth(token)).expect(200);

        assertIncludes(response.body.summary, { applications: 0, interviewRate: null, responseRate: null });
        assert.equal(response.body.responseTime.medianDays, null);
        assert.deepEqual(response.body.weekly, []);
    });

    test("a job that moved Interview -> Offer still counts as interviewed (the original bug)", async () => {
        const { token } = await createUser(app);
        const id = (await request(app).post("/api/jobs").set(auth(token))
            .send({ company: "Acme", role: "DA" })).body.job._id;

        await request(app).put(`/api/jobs/${id}`).set(auth(token)).send({ status: "Interview" }).expect(200);
        await request(app).put(`/api/jobs/${id}`).set(auth(token)).send({ status: "Offer" }).expect(200);

        const { summary } = (await request(app).get("/api/analytics").set(auth(token))).body;
        assertIncludes(summary, { reachedInterview: 1, interviewRate: 100, reachedOffer: 1 });
    });
});
