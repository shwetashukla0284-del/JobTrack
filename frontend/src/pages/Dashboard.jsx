import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { clearSession, getUser } from "../auth";
import { JOB_STATUSES, formatDate } from "../constants";

const SEARCH_DEBOUNCE_MS = 300;

function Dashboard() {
    const [jobs, setJobs] = useState([]);
    // What the user is typing vs. the (debounced) value sent to the API
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [statistics, setStatistics] = useState({
        applications: 0,
        awaitingResponse: 0,
        reachedInterview: 0,
        reachedOffer: 0,
        rejected: 0,
        responseRate: null,
        interviewRate: null,
        offerRate: null
    });

    const [errorMessage, setErrorMessage] = useState("");
    const [refresh, setRefresh] = useState(0);
    // true until the first response arrives, so "No applications" never flashes
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    const jobsPerPage = 5;

    const navigate = useNavigate();

    const user = getUser();

    // =========================
    // DEBOUNCE SEARCH
    // Wait until the user stops typing, then search from page 1
    // =========================

    useEffect(() => {
        const nextSearch = searchInput.trim();

        if (nextSearch === search) {
            return;
        }

        const timer = setTimeout(() => {
            setSearch(nextSearch);
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);

    }, [searchInput, search]);


    // =========================
    // FETCH JOBS
    // =========================

    useEffect(() => {
        // Ignore responses from outdated requests, so a slow earlier
        // response can't overwrite newer results
        let ignore = false;

        const fetchJobs = async () => {
            try {
                const response = await api.get("/jobs", {
                    params: {
                        search,
                        status: statusFilter,
                        page: currentPage,
                        limit: jobsPerPage
                    }
                });

                if (ignore) {
                    return;
                }

                // e.g. after deleting the only job on the last page
                if (
                    response.data.totalPages > 0 &&
                    currentPage > response.data.totalPages
                ) {
                    setCurrentPage(response.data.totalPages);
                    return;
                }

                setErrorMessage("");
                setJobs(response.data.jobs);
                setTotalPages(response.data.totalPages);
                setStatistics(response.data.statistics);
                setLoading(false);

            } catch (error) {
                if (ignore) {
                    return;
                }

                const message = getErrorMessage(
                    error,
                    "Unable to load your job applications. Please try again."
                );

                if (message) {
                    setErrorMessage(message);
                    setLoading(false);
                }
            }
        };

        fetchJobs();

        return () => {
            ignore = true;
        };

    }, [
        search,
        statusFilter,
        currentPage,
        refresh
    ]);


    // =========================
    // LOGOUT
    // =========================

    const handleLogout = () => {
        clearSession();
        navigate("/login");
    };


    // =========================
    // DELETE JOB
    // =========================

    const deleteJob = async (job) => {
        const confirmed = window.confirm(
            `Delete your application to ${job.company} (${job.role})? This can't be undone.`
        );

        if (!confirmed || deletingId) {
            return;
        }

        setErrorMessage("");
        setDeletingId(job._id);

        try {
            await api.delete(`/jobs/${job._id}`);

            // Refresh jobs and statistics
            setRefresh((value) => value + 1);

        } catch (error) {
            const message = getErrorMessage(
                error,
                "Unable to delete the job application. Please try again."
            );

            if (message) {
                setErrorMessage(message);
            }

        } finally {
            setDeletingId(null);
        }
    };


    // =========================
    // FILTER CHANGE
    // Start again from page 1
    // =========================

    const handleStatusFilterChange = (event) => {
        setStatusFilter(event.target.value);
        setCurrentPage(1);
    };

    const isFiltering = search !== "" || statusFilter !== "All";

    // A rate is null when there are no applications yet ("no data", not 0%)
    const formatRate = (value) =>
        value === null || value === undefined ? "—" : `${value}%`;

    // Definitions match docs/metrics.md
    const statCards = [
        {
            label: "Total Applications",
            value: statistics.applications,
            definition: "All applications you have logged"
        },
        {
            label: "Awaiting Response",
            value: statistics.awaitingResponse,
            definition: "Current status is still Applied"
        },
        {
            label: "Interviewed",
            value: statistics.reachedInterview,
            definition: "Applications that ever reached the Interview stage (including ones that later got an offer or were rejected)"
        },
        {
            label: "Offers",
            value: statistics.reachedOffer,
            definition: "Applications that ever reached the Offer stage"
        },
        {
            label: "Rejected",
            value: statistics.rejected,
            definition: "Current status is Rejected"
        },
        {
            label: "Response Rate",
            value: formatRate(statistics.responseRate),
            definition: "Share of applications that got any reply (moved past Applied, including rejections)"
        },
        {
            label: "Interview Rate",
            value: formatRate(statistics.interviewRate),
            definition: "Interviewed ÷ Total Applications"
        },
        {
            label: "Offer Rate",
            value: formatRate(statistics.offerRate),
            definition: "Offers ÷ Total Applications"
        }
    ];


    return (
        <div className="dashboard">

            {/* =========================
                HEADER
            ========================= */}

            <header className="dashboard-header">

                <div>
                    <h1>
                        JobTrack
                    </h1>

                    {user && (
                        <p>
                            Welcome, {user.name}! 👋
                        </p>
                    )}
                </div>

                <div className="header-actions">
                    <button
                        className="secondary-button"
                        onClick={() => navigate("/analytics")}
                    >
                        📊 Analytics
                    </button>

                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>

            </header>


            <main className="dashboard-content">

                {/* =========================
                    TITLE
                ========================= */}

                <div className="dashboard-title">

                    <div>
                        <h2>
                            My Applications
                        </h2>

                        <p>
                            Track and manage your job applications
                        </p>
                    </div>

                    <button
                        onClick={() =>
                            navigate("/add-job")
                        }
                    >
                        + Add Job
                    </button>

                </div>


                {/* =========================
                    ERROR MESSAGE
                ========================= */}

                {errorMessage && (
                    <p className="error-message">
                        {errorMessage}
                    </p>
                )}


                {/* =========================
                    STATISTICS
                ========================= */}

                <div className="stats-container">
                    {statCards.map((card) => (
                        <div
                            className="stat-card"
                            key={card.label}
                            title={card.definition}
                        >
                            <h3>
                                {card.value}
                            </h3>
                            <p>
                                {card.label}
                            </p>
                        </div>
                    ))}
                </div>


                {/* =========================
                    SEARCH + FILTER
                ========================= */}

                <div className="filter-container">

                    <input
                        type="text"
                        placeholder="Search company, role, or location..."
                        value={searchInput}
                        onChange={(event) =>
                            setSearchInput(event.target.value)
                        }
                    />

                    <select
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                    >

                        <option value="All">
                            All Statuses
                        </option>

                        {JOB_STATUSES.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}

                    </select>

                </div>


                {/* =========================
                    JOB APPLICATIONS
                ========================= */}

                <div className="jobs-container">

                    {loading ? (

                        <p className="loading-text">
                            Loading your applications…
                        </p>

                    ) : jobs.length === 0 ? (

                        <div className="empty-state">

                            <h3>
                                No applications found
                            </h3>

                            <p>
                                {isFiltering
                                    ? "Try a different search or status filter."
                                    : "Add a job application to get started."}
                            </p>

                        </div>

                    ) : (

                        jobs.map((job) => (

                            <div
                                className="job-card"
                                key={job._id}
                            >

                                <div className="job-info">

                                    <h3>
                                        {job.company}
                                    </h3>

                                    <p className="job-role">
                                        {job.role}
                                    </p>

                                    <p>
                                        📍{" "}
                                        {job.location ||
                                            "Not specified"}
                                    </p>

                                    <p>
                                        🗓️ Applied{" "}
                                        {formatDate(job.dateApplied)}
                                        {job.source &&
                                            ` · via ${job.source}`}
                                    </p>

                                    <span
                                        className={`status status-${job.status.toLowerCase()}`}
                                    >
                                        {job.status}
                                    </span>

                                </div>


                                <div className="job-actions">

                                    <button
                                        onClick={() =>
                                            navigate(
                                                `/edit-job/${job._id}`
                                            )
                                        }
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="delete-button"
                                        disabled={deletingId === job._id}
                                        onClick={() =>
                                            deleteJob(job)
                                        }
                                    >
                                        {deletingId === job._id
                                            ? "Deleting…"
                                            : "Delete"}
                                    </button>

                                </div>

                            </div>

                        ))

                    )}

                </div>


                {/* =========================
                    PAGINATION
                ========================= */}

                {totalPages > 1 && (

                    <div className="pagination">

                        <button
                            disabled={
                                currentPage === 1
                            }
                            onClick={() =>
                                setCurrentPage(
                                    currentPage - 1
                                )
                            }
                        >
                            ← Previous
                        </button>


                        <span>
                            Page {currentPage} of {totalPages}
                        </span>


                        <button
                            disabled={
                                currentPage === totalPages
                            }
                            onClick={() =>
                                setCurrentPage(
                                    currentPage + 1
                                )
                            }
                        >
                            Next →
                        </button>

                    </div>

                )}

            </main>

        </div>
    );
}

export default Dashboard;