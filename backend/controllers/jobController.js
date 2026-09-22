const mongoose = require("mongoose");
const Job = require("../models/job");

// =========================
// CREATE JOB
// =========================

const createJob = async (req, res) => {
    try {
        const {
            company,
            role,
            status,
            location,
            dateApplied
        } = req.body;

        // Validate required fields
        if (!company || !role) {
            return res.status(400).json({
                message: "Company and role are required"
            });
        }

        // Validate status
        const validStatuses = [
            "Applied",
            "Interview",
            "Offer",
            "Rejected"
        ];

        if (
            status &&
            !validStatuses.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid job status"
            });
        }

        const job = await Job.create({
            userId: req.userId,
            company,
            role,
            status,
            location,
            dateApplied
        });

        res.status(201).json({
            message: "Job application created successfully",
            job
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
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

        // Validate status filter
        const validStatuses = [
            "Applied",
            "Interview",
            "Offer",
            "Rejected"
        ];

        if (
            status !== "All" &&
            !validStatuses.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid status filter"
            });
        }

        // Filter for logged-in user's jobs
        const filter = {
            userId: req.userId
        };

        // Search company, role, or location
        if (search.trim()) {
            filter.$or = [
                {
                    company: {
                        $regex: search.trim(),
                        $options: "i"
                    }
                },
                {
                    role: {
                        $regex: search.trim(),
                        $options: "i"
                    }
                },
                {
                    location: {
                        $regex: search.trim(),
                        $options: "i"
                    }
                }
            ];
        }

        // Filter by status
        if (status !== "All") {
            filter.status = status;
        }

        // Calculate how many jobs to skip
        const skip =
            (pageNumber - 1) * limitNumber;

        // Get matching jobs
        const jobs = await Job.find(filter)
            .sort({
                createdAt: -1
            })
            .skip(skip)
            .limit(limitNumber);

        // Count matching jobs
        const totalJobs =
            await Job.countDocuments(filter);

        // =========================
        // OVERALL STATISTICS
        // =========================

        const userFilter = {
            userId: req.userId
        };

        const totalApplications =
            await Job.countDocuments(userFilter);

        const totalApplied =
            await Job.countDocuments({
                ...userFilter,
                status: "Applied"
            });

        const totalInterviews =
            await Job.countDocuments({
                ...userFilter,
                status: "Interview"
            });

        const totalOffers =
            await Job.countDocuments({
                ...userFilter,
                status: "Offer"
            });

        const totalRejected =
            await Job.countDocuments({
                ...userFilter,
                status: "Rejected"
            });

        // Calculate rates
        const interviewRate =
            totalApplications === 0
                ? 0
                : Math.round(
                    (totalInterviews /
                        totalApplications) *
                    100
                );

        const offerRate =
            totalApplications === 0
                ? 0
                : Math.round(
                    (totalOffers /
                        totalApplications) *
                    100
                );

        res.status(200).json({
            jobs,
            totalJobs,
            currentPage: pageNumber,
            totalPages: Math.ceil(
                totalJobs / limitNumber
            ),

            statistics: {
                totalApplications,
                totalApplied,
                totalInterviews,
                totalOffers,
                totalRejected,
                interviewRate,
                offerRate
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
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

        const {
            company,
            role,
            status,
            location,
            dateApplied
        } = req.body;

        // Validate status
        const validStatuses = [
            "Applied",
            "Interview",
            "Offer",
            "Rejected"
        ];

        if (
            status &&
            !validStatuses.includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid job status"
            });
        }

        // Validate required fields if provided
        if (
            company !== undefined &&
            !company.trim()
        ) {
            return res.status(400).json({
                message: "Company cannot be empty"
            });
        }

        if (
            role !== undefined &&
            !role.trim()
        ) {
            return res.status(400).json({
                message: "Role cannot be empty"
            });
        }

        const job = await Job.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        job.company =
            company?.trim() ?? job.company;

        job.role =
            role?.trim() ?? job.role;

        job.status =
            status ?? job.status;

        job.location =
            location?.trim() ?? job.location;

        job.dateApplied =
            dateApplied ?? job.dateApplied;

        await job.save();

        res.status(200).json({
            message: "Job application updated successfully",
            job
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
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

        const job = await Job.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        await Job.deleteOne({
            _id: req.params.id,
            userId: req.userId
        });

        res.status(200).json({
            message: "Job application deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
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

        const job = await Job.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job application not found"
            });
        }

        res.status(200).json({
            job
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
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