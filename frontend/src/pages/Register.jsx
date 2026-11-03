import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../api";

const MIN_PASSWORD_LENGTH = 6;

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (submittingRef.current) {
            return;
        }

        setErrorMessage("");

        if (!name.trim() || !email.trim() || !password) {
            setErrorMessage("Please fill in all fields");
            return;
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            setErrorMessage(
                `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            );
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);

        try {
            await api.post("/auth/register", {
                name,
                email,
                password
            });

            navigate("/login", { state: { registered: true } });

        } catch (error) {
            setErrorMessage(getErrorMessage(error));
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

                <h2>Create Account</h2>

                <p className="auth-subtitle">
                    Start tracking your job applications
                </p>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label htmlFor="name">Name</label>

                        <input
                            id="name"
                            type="text"
                            autoComplete="name"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            placeholder="Enter your name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>

                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            placeholder="Enter your email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>

                        <input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
                        {submitting ? "Creating account…" : "Register"}
                    </button>

                </form>

                <p className="auth-footer">
                    Already have an account?{" "}
                    <button
                        className="link-button"
                        onClick={() =>
                            navigate("/login")
                        }
                    >
                        Login
                    </button>
                </p>

            </div>

        </div>
    );
}

export default Register;
