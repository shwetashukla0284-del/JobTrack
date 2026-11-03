// Single source of truth for allowed values.
// Used by the Mongoose model and by request validation.

const JOB_STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

// Where the application came from (the "channel").
// Lets us compare conversion rates by channel later.
const JOB_SOURCES = [
    "LinkedIn",
    "Referral",
    "Company Website",
    "Job Board",
    "Recruiter",
    "Other"
];

module.exports = {
    JOB_STATUSES,
    JOB_SOURCES
};
