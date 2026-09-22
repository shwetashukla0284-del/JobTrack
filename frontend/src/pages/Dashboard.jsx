import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function Dashboard() {
    const [jobs, setJobs] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [statistics, setStatistics] = useState({
        totalApplications: 0,
        totalApplied: 0,
        totalInterviews: 0,
        totalOffers: 0,
        totalRejected: 0,
        interviewRate: 0,
        offerRate: 0
    });

    const [errorMessage, setErrorMessage] = useState("");
    const [refresh, setRefresh] = useState(0);

    const jobsPerPage = 5;

    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user"));

    // =========================
    // FETCH JOBS
    // =========================

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                setErrorMessage("");

                const token = localStorage.getItem("token");

                const response = await api.get(
                    "/jobs",
                    {
                        params: {
                            search,
                            status: statusFilter,
                            page: currentPage,
                            limit: jobsPerPage
                        },
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                setJobs(response.data.jobs);

                setTotalPages(
                    response.data.totalPages
                );

                setStatistics(
                    response.data.statistics
                );

            } catch (error) {
                if (error.response?.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");

                    navigate("/login");

                } else if (error.response) {
                    setErrorMessage(
                        "Unable to load your job applications. Please try again."
                    );

                } else {
                    setErrorMessage(
                        "Unable to connect to the server. Please check your connection."
                    );
                }
            }
        };

        fetchJobs();

    }, [
        search,
        statusFilter,
        currentPage,
        refresh,
        navigate
    ]);


    // =========================
    // LOGOUT
    // =========================

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
    };


    // =========================
    // DELETE JOB
    // =========================

    const deleteJob = async (id) => {
        try {
            setErrorMessage("");

            const token = localStorage.getItem("token");

            await api.delete(
                `/jobs/${id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            // Refresh jobs and statistics
            setRefresh((value) => value + 1);

        } catch (error) {
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                navigate("/login");

            } else if (error.response?.status === 404) {
                setErrorMessage(
                    "Job application not found."
                );

            } else if (error.response) {
                setErrorMessage(
                    "Unable to delete the job application. Please try again."
                );

            } else {
                setErrorMessage(
                    "Unable to connect to the server. Please try again."
                );
            }
        }
    };


    // =========================
    // RESET PAGE WHEN SEARCH
    // OR FILTER CHANGES
    // =========================

    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter]);


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

                <button
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>

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

                    <div className="stat-card">
                        <h3>
                            {statistics.totalApplications}
                        </h3>
                        <p>
                            Total Applications
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.totalApplied}
                        </h3>
                        <p>
                            Applied
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.totalInterviews}
                        </h3>
                        <p>
                            Interviews
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.totalOffers}
                        </h3>
                        <p>
                            Offers
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.totalRejected}
                        </h3>
                        <p>
                            Rejected
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.interviewRate}%
                        </h3>
                        <p>
                            Interview Rate
                        </p>
                    </div>


                    <div className="stat-card">
                        <h3>
                            {statistics.offerRate}%
                        </h3>
                        <p>
                            Offer Rate
                        </p>
                    </div>

                </div>


                {/* =========================
                    SEARCH + FILTER
                ========================= */}

                <div className="filter-container">

                    <input
                        type="text"
                        placeholder="Search company, role, or location..."
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                    />

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >

                        <option value="All">
                            All Statuses
                        </option>

                        <option value="Applied">
                            Applied
                        </option>

                        <option value="Interview">
                            Interview
                        </option>

                        <option value="Offer">
                            Offer
                        </option>

                        <option value="Rejected">
                            Rejected
                        </option>

                    </select>

                </div>


                {/* =========================
                    JOB APPLICATIONS
                ========================= */}

                <div className="jobs-container">

                    {jobs.length === 0 ? (

                        <div className="empty-state">

                            <h3>
                                No applications found
                            </h3>

                            <p>
                                Add a job application to get started.
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
                                        onClick={() =>
                                            deleteJob(job._id)
                                        }
                                    >
                                        Delete
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