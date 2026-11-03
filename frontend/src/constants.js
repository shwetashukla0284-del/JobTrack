// Keep in sync with backend/constants.js
export const JOB_STATUSES = ["Applied", "Interview", "Offer", "Rejected"];

export const JOB_SOURCES = [
    "LinkedIn",
    "Referral",
    "Company Website",
    "Job Board",
    "Recruiter",
    "Other"
];

// Today's date in the user's timezone, as YYYY-MM-DD (for <input type="date">)
export const todayInputValue = () =>
    new Date().toLocaleDateString("en-CA");

// Starting values for a new application (a function, so "today" is current)
export const emptyJob = () => ({
    company: "",
    role: "",
    status: "Applied",
    source: "",
    location: "",
    dateApplied: todayInputValue()
});

// Dates from <input type="date"> are stored as UTC midnight,
// so read and display them in UTC to avoid off-by-one-day shifts.
export const toInputValue = (isoDate) =>
    isoDate ? isoDate.slice(0, 10) : "";

export const formatDate = (isoDate) =>
    isoDate
        ? new Date(isoDate).toLocaleDateString(undefined, {
            timeZone: "UTC",
            day: "numeric",
            month: "short",
            year: "numeric"
        })
        : "Not specified";
