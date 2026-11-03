import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import JobForm from "../components/JobForm";
import { toInputValue } from "../constants";

function EditJob() {
    const [job, setJob] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        let ignore = false;

        const fetchJob = async () => {
            try {
                const response = await api.get(`/jobs/${id}`);
                const data = response.data.job;

                if (!ignore) {
                    setJob({
                        company: data.company,
                        role: data.role,
                        status: data.status,
                        source: data.source || "",
                        location: data.location || "",
                        dateApplied: toInputValue(data.dateApplied)
                    });
                }

            } catch (error) {
                const message = getErrorMessage(error);

                if (!ignore && message) {
                    setErrorMessage(message);
                }
            }
        };

        fetchJob();

        return () => {
            ignore = true;
        };

    }, [id]);

    const updateJob = ({ dateApplied, ...values }) =>
        api.put(`/jobs/${id}`, {
            ...values,
            // Older jobs may have no date; don't send an empty one
            ...(dateApplied && { dateApplied })
        });

    // Show the form only once the job has loaded, so it never flashes empty
    if (!job) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <h1 className="auth-logo">JobTrack</h1>

                    {errorMessage ? (
                        <>
                            <p className="error-message" role="alert">
                                {errorMessage}
                            </p>

                            <button
                                className="link-button"
                                onClick={() => navigate("/dashboard")}
                            >
                                Back to Dashboard
                            </button>
                        </>
                    ) : (
                        <p className="loading-text">Loading application…</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <JobForm
            title="Edit Job Application"
            subtitle="Update your job application details"
            submitLabel="Save Changes"
            initialValues={job}
            onSubmit={updateJob}
        />
    );
}

export default EditJob;
