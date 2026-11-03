import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api";
import {
    JOB_STATUSES,
    JOB_SOURCES,
    todayInputValue
} from "../constants";

// Shared form for adding and editing a job application.
// onSubmit(values) should return a promise; the form shows errors itself.
function JobForm({ title, subtitle, submitLabel, initialValues, onSubmit }) {
    const [values, setValues] = useState(initialValues);
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);

    const navigate = useNavigate();

    const handleChange = (event) => {
        const { name, value } = event.target;
        setValues((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        // A ref, not state: state only updates on the next render, so rapid
        // double clicks would all still see "not submitting"
        if (submittingRef.current) {
            return;
        }

        submittingRef.current = true;

        setErrorMessage("");
        setSubmitting(true);

        try {
            await onSubmit(values);
            navigate("/dashboard");

        } catch (error) {
            const message = getErrorMessage(error);

            if (message) {
                setErrorMessage(message);
            }

            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-page">

            <div className="auth-card">

                <h1 className="auth-logo">
                    JobTrack
                </h1>

                <h2>
                    {title}
                </h2>

                <p className="auth-subtitle">
                    {subtitle}
                </p>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label htmlFor="company">Company</label>

                        <input
                            id="company"
                            name="company"
                            type="text"
                            value={values.company}
                            onChange={handleChange}
                            placeholder="e.g. Google"
                            maxLength={100}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="role">Role</label>

                        <input
                            id="role"
                            name="role"
                            type="text"
                            value={values.role}
                            onChange={handleChange}
                            placeholder="e.g. Data Analyst"
                            maxLength={100}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="status">Status</label>

                        <select
                            id="status"
                            name="status"
                            value={values.status}
                            onChange={handleChange}
                        >
                            {JOB_STATUSES.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="source">Source</label>

                        <select
                            id="source"
                            name="source"
                            value={values.source}
                            onChange={handleChange}
                        >
                            <option value="">
                                Not specified
                            </option>

                            {JOB_SOURCES.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="dateApplied">Date Applied</label>

                        <input
                            id="dateApplied"
                            name="dateApplied"
                            type="date"
                            value={values.dateApplied}
                            max={todayInputValue()}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="location">Location</label>

                        <input
                            id="location"
                            name="location"
                            type="text"
                            value={values.location}
                            onChange={handleChange}
                            placeholder="e.g. Bengaluru or Remote"
                            maxLength={100}
                        />
                    </div>

                    {errorMessage && (
                        <p className="error-message" role="alert">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        className="auth-button"
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting ? "Saving…" : submitLabel}
                    </button>

                    <button
                        type="button"
                        className="link-button"
                        onClick={() => navigate("/dashboard")}
                    >
                        Cancel
                    </button>

                </form>

            </div>

        </div>
    );
}

export default JobForm;
