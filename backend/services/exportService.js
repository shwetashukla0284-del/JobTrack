// =========================================================
// CSV EXPORT
//
// Exports raw data (no calculated metrics) as two tidy tables,
// linked by job_id, for analysis in Python, SQL or Excel:
//
//   applications.csv   one row per application
//   status_events.csv  one row per status change
//
// Columns are documented in docs/data-dictionary.md.
// =========================================================

const mongoose = require("mongoose");
const Job = require("../models/job");

// Values starting with these characters can be run as formulas when the
// file is opened in Excel or Google Sheets ("CSV injection"). Prefix them
// with an apostrophe so they are shown as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCsvValue = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    let text = String(value);

    if (FORMULA_START.test(text)) {
        text = `'${text}`;
    }

    // Quote values containing commas, quotes or line breaks (RFC 4180)
    if (/[",\r\n]/.test(text)) {
        text = `"${text.replace(/"/g, '""')}"`;
    }

    return text;
};

const toCsv = (columns, rows) => {
    const lines = [
        columns.map((column) => column.header).join(","),
        ...rows.map((row) =>
            columns
                .map((column) => escapeCsvValue(column.value(row)))
                .join(",")
        )
    ];

    // \r\n line endings are the CSV standard. The leading byte order mark
    // (BOM) tells Excel the file is UTF-8, so text like "Zürich" or "₹"
    // isn't garbled. pandas and DuckDB skip it automatically.
    return "﻿" + lines.join("\r\n") + "\r\n";
};

// Calendar dates as YYYY-MM-DD; exact times as ISO 8601 in UTC
const toDate = (date) => (date ? date.toISOString().slice(0, 10) : "");
const toTimestamp = (date) => (date ? date.toISOString() : "");

const APPLICATION_COLUMNS = [
    { header: "job_id", value: (job) => job._id },
    { header: "company", value: (job) => job.company },
    { header: "role", value: (job) => job.role },
    { header: "location", value: (job) => job.location },
    { header: "source", value: (job) => job.source },
    { header: "current_status", value: (job) => job.status },
    { header: "date_applied", value: (job) => toDate(job.dateApplied) },
    { header: "created_at", value: (job) => toTimestamp(job.createdAt) },
    { header: "updated_at", value: (job) => toTimestamp(job.updatedAt) }
];

const EVENT_COLUMNS = [
    { header: "job_id", value: (event) => event.jobId },
    { header: "event_number", value: (event) => event.eventNumber },
    { header: "status", value: (event) => event.status },
    { header: "changed_at", value: (event) => toTimestamp(event.changedAt) }
];

const DATASETS = ["applications", "status_events"];

const exportDataset = async (userId, dataset) => {
    const jobs = await Job.find({
        userId: new mongoose.Types.ObjectId(userId)
    })
        .sort({ dateApplied: 1, _id: 1 })
        .lean();

    if (dataset === "applications") {
        return toCsv(APPLICATION_COLUMNS, jobs);
    }

    const events = jobs.flatMap((job) =>
        (job.statusHistory || []).map((event, index) => ({
            jobId: job._id,
            eventNumber: index + 1,
            status: event.status,
            changedAt: event.changedAt
        }))
    );

    return toCsv(EVENT_COLUMNS, events);
};

module.exports = {
    DATASETS,
    exportDataset,
    // exported for testing
    escapeCsvValue
};
