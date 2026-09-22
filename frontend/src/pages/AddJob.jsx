import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function AddJob() {
    const [company, setCompany] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("Applied");
    const [location, setLocation] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");

        try {
            const token = localStorage.getItem("token");

            await api.post(
                "/jobs",
                {
                    company,
                    role,
                    status,
                    location
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            navigate("/dashboard");

        } catch (error) {

            if (error.response?.status === 401) {

                localStorage.removeItem("token");
                localStorage.removeItem("user");

                navigate("/login");

            } else if (error.response?.status === 400) {

                setErrorMessage(
                    error.response.data.message
                );

            } else if (error.response) {

                setErrorMessage(
                    "Something went wrong. Please try again."
                );

            } else {

                setErrorMessage(
                    "Unable to connect to the server. Please try again."
                );
            }
        }
    };

    return (
        <div className="auth-page">

            <div className="auth-card">

                <h1 className="auth-logo">
                    JobTrack
                </h1>

                <h2>
                    Add Job Application
                </h2>

                <p className="auth-subtitle">
                    Add a new job to your application tracker
                </p>


                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    {/* Company */}

                    <div className="form-group">

                        <label>
                            Company
                        </label>

                        <input
                            type="text"
                            value={company}
                            onChange={(event) =>
                                setCompany(event.target.value)
                            }
                            placeholder="e.g. Google"
                            required
                        />

                    </div>


                    {/* Role */}

                    <div className="form-group">

                        <label>
                            Role
                        </label>

                        <input
                            type="text"
                            value={role}
                            onChange={(event) =>
                                setRole(event.target.value)
                            }
                            placeholder="e.g. Software Engineer"
                            required
                        />

                    </div>


                    {/* Status */}

                    <div className="form-group">

                        <label>
                            Status
                        </label>

                        <select
                            value={status}
                            onChange={(event) =>
                                setStatus(event.target.value)
                            }
                        >

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


                    {/* Location */}

                    <div className="form-group">

                        <label>
                            Location
                        </label>

                        <input
                            type="text"
                            value={location}
                            onChange={(event) =>
                                setLocation(event.target.value)
                            }
                            placeholder="e.g. Bangalore"
                        />

                    </div>


                    {/* Error */}

                    {errorMessage && (
                        <p className="error-message">
                            {errorMessage}
                        </p>
                    )}


                    {/* Submit */}

                    <button
                        className="auth-button"
                        type="submit"
                    >
                        Add Job
                    </button>


                    {/* Cancel */}

                    <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                            navigate("/dashboard")
                        }
                    >
                        Cancel
                    </button>

                </form>

            </div>

        </div>
    );
}

export default AddJob;