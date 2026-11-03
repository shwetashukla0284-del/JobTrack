const mongoose = require("mongoose");
const Job = require("../models/job");
const { JOB_STATUSES, JOB_SOURCES } = require("../constants");
const { getSummary } = require("../services/analyticsService");

// Allow dates up to one day ahead so users in timezones ahead of UTC
// can still pick "today".
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const MAX_SEARCH_LENGTH = 100;

// =========================
// HELPERS
// =========================

// Escape characters that have special meaning in regular expressions,
// so user search text is matched literally.
const escapeRegex = (text) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isNonEmptyString = (value) =>
    typeof value === "string" && value.trim() !== "";

// Validate job fields from a request body.
// partial = true for updates, where every field is optional.
// Returns an error message, or null when the input is valid.
const validateJobInput = (body, { partial }) => {
    const {
        company,
        role,
        status,
        source,
        location,
        dateApplied
    } = body;

    if (!partial || company !== undefined) {
        if (!isNonEmptyString(company)) {
            return "Company is required";
        }
    }

    if (!partial || role !== undefined) {
        if (!isNonEmptyString(role)) {
            return "Role is required";
        }
    }

    if (status !== undefined && !JOB_STATUSES.includes(status)) {
        return "Invalid job status";
    }

    // An empty string means "not specified"
    if (
        source !== undefined &&
        source !== "" &&
        !JOB_SOURCES.includes(source)
    ) {
        return "Invalid job source";
    }

    if (location !== undefined && typeof location !== "string") {
        return "Invalid location";
    }

    if (dateApplied !== undefined) {
        const date = new Date(dateApplied);

        if (
            typeof dateApplied !== "string" ||
            Number.isNaN(date.getTime())
        ) {
            return "Invalid date applied";
        }

        if (date.getTime() > Date.now() + MAX_FUTURE_MS) {
            return "Date applied cannot be in the future";
        }
    }

    return null;
};

const findUserJob = (id, userId) =>
    Job.findOne({ _id: id, userId });

// =========================
// CREATE JOB
// =========================

const createJob = async (req, res) => {
    try {
        const validationError = validateJobInput(req.body, {
            partial: false
        });

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const {
            company,
            role,
            status = "Applied",
            source,
            location,
            dateApplied
        } = req.body;

        const appliedAt = dateApplied
            ? new Date(dateApplied)
            : new Date();

        // Every application starts with an "Applied" event on the
        // date it was applied. If it is created at a later stage,
        // record that stage as of now.
        const statusHistory = [
            { status: "Applied", changedAt: appliedAt }
        ];

        if (status !== "Applied") {
            statusHistory.push({
                status,
                changedAt: new Date()
            });
        }

        const job = await Job.create({
            userId: req.userId,
            company: company.trim(),
            role: role.trim(),
            status,
            source: source || undefined,
            location: location?.trim(),
            dateApplied: appliedAt,
            statusHistory
        });

        res.status(201).json({
            message: "Job application created successfully",
            job
        });

    } catch (error) {
        console.error("createJob error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// =========================
// READ JOBS
// SEARCH + FILTER + PAGINATION
// =========================

const getJobs = async (req, res) => {
    try {
        const {
            search = "",
            status = "All",
            page = 1,
            limit = 5
        } = req.query;

        // Convert pagination values to numbers
        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        // Validate pagination
        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1
        ) {
            return res.status(400).json({
                message: "Invalid page number"
            });
        }

        if (
            !Number.isInteger(limitNumber) ||
            limitNumber < 1 ||
            limitNumber > 50
        ) {
            return res.status(400).json({
                message: "Invalid limit"
            });
        }

        if (
            typeof search !== "string" ||
            search.length > MAX_SEARCH_LENGTH
        ) {
            return res.status(400).json({
                message: "Invalid search"
            });
        }

        // Validate status filter
        if (
            status !== "All" &&
            !JOB_STATUSES.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid status filter"
            });
        }

        // Filter for logged-in user's jobs
        const filter = {
            userId: req.userId
        };

        // Search company, role, or location (literal, case-insensitive)
        const searchText = search.trim();

        if (searchText) {
            const pattern = {
                $regex: escapeRegex(searchText),
                $options: "i"
            };

            filter.$or = [
                { company: pattern },
                { role: pattern },
                { location: pattern }
            ];
        }

        // Filter by status
        if (status !== "All") {
            filter.status = status;
        }

        // Calculate how many jobs to skip
        const skip =
            (pageNumber - 1) * limitNumber;

        // Run the page query, the count, and the overall
        // statistics (for all of the user's jobs) in parallel
        const [jobs, totalJobs, statistics] = await Promise.all([
            Job.find(filter)
                // Most recently applied first; _id breaks ties so
                // pagination order is stable
                .sort({
                    dateApplied: -1,
                    _id: -1
                })
                .skip(skip)
                .limit(limitNumber),

            Job.countDocuments(filter),

            getSummary(req.userId)
        ]);

        res.status(200).json({
            jobs,
            totalJobs,
            currentPage: pageNumber,
            totalPages: Math.ceil(
                totalJobs / limitNumber
            ),
            statistics
        });

    } catch (error) {
        console.error("getJobs error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// =========================
// UPDATE JOB
// =========================

const updateJob = async (req, res) => {
    try {

        // Validate MongoDB ID
        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {
            return res.status(400).json({
                message: "Invalid job ID"
            });
        }

        const validationError = validateJobInput(req.body, {
            partial: true
        });

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const {
            company,
            role,
            status,
            source,
            location,
            dateApplied
        } = req.body;

        const job = await findUserJob(
            req.params.id,
            req.userId
        );

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        if (company !== undefined) {
            job.company = company.trim();
        }

        if (role !== undefined) {
            job.role = role.trim();
        }

        if (location !== undefined) {
            job.location = location.trim();
        }

        if (source !== undefined) {
            job.source = source || undefined;
        }

        if (dateApplied !== undefined) {
            const newDate = new Date(dateApplied);

            // The application date can't be after the company responded
            const firstResponse = job.statusHistory.find(
                (event) => event.status !== "Applied"
            );

            // (one day of tolerance: dateApplied is a calendar date stored
            // as UTC midnight, while events are exact moments in time)
            if (
                firstResponse &&
                newDate.getTime() - firstResponse.changedAt.getTime() > MAX_FUTURE_MS
            ) {
                return res.status(400).json({
                    message: "Date applied cannot be after the first status change"
                });
            }

            job.dateApplied = newDate;

            // Keep the initial "Applied" event in sync with the date
            const firstEvent = job.statusHistory[0];

            if (firstEvent?.status === "Applied") {
                firstEvent.changedAt = job.dateApplied;
            }
        }

        // Record a history event only when the status actually changes
        if (status !== undefined && status !== job.status) {
            job.status = status;

            job.statusHistory.push({
                status,
                changedAt: new Date()
            });
        }

        await job.save();

        res.status(200).json({
            message: "Job application updated successfully",
            job
        });

    } catch (error) {
        console.error("updateJob error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// =========================
// DELETE JOB
// =========================

const deleteJob = async (req, res) => {
    try {

        // Validate MongoDB ID
        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {
            return res.status(400).json({
                message: "Invalid job ID"
            });
        }

        const job = await Job.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        res.status(200).json({
            message: "Job application deleted successfully"
        });

    } catch (error) {
        console.error("deleteJob error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// =========================
// GET SINGLE JOB
// =========================

const getJobById = async (req, res) => {
    try {

        // Validate MongoDB ID
        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {
            return res.status(400).json({
                message: "Invalid job ID"
            });
        }

        const job = await findUserJob(
            req.params.id,
            req.userId
        );

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        res.status(200).json({
            job
        });

    } catch (error) {
        console.error("getJobById error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};


// =========================
// EXPORT
// =========================

module.exports = {
    createJob,
    getJobs,
    getJobById,
    updateJob,
    deleteJob
};
