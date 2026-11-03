const mongoose = require("mongoose");
const { JOB_STATUSES, JOB_SOURCES } = require("../constants");

// One entry per status change. Keeping the full history (instead of only
// the current status) lets us measure how many applications EVER reached
// each stage of the funnel, and how long each stage took.
const statusEventSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: JOB_STATUSES,
            required: true
        },

        changedAt: {
            type: Date,
            required: true
        }
    },
    {
        _id: false
    }
);

const jobSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        company: {
            type: String,
            required: true,
            trim: true
        },

        role: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: JOB_STATUSES,
            default: "Applied"
        },

        // Optional: older records have no source and are treated as "Unknown".
        source: {
            type: String,
            enum: JOB_SOURCES
        },

        location: {
            type: String,
            trim: true
        },

        dateApplied: {
            type: Date,
            default: Date.now
        },

        statusHistory: {
            type: [statusEventSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
