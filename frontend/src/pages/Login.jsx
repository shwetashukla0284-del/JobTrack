import { useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api, { getErrorMessage } from "../api";
import { saveSession } from "../auth";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);

    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const infoMessage = location.state?.registered
        ? "Account created. Please log in."
        : searchParams.get("expired")
            ? "Your session has expired. Please log in again."
            : "";

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (submittingRef.current) {
            return;
        }

        setErrorMessage("");
        submittingRef.current = true;
        setSubmitting(true);

        try {
            const response = await api.post("/auth/login", {
                email,
                password
            });

            saveSession(response.data.token, response.data.user);

            navigate("/dashboard", { replace: true });

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

                <h2>Welcome Back</h2>

                <p className="auth-subtitle">
                    Login to manage your job applications
                </p>

                {infoMessage && (
                    <p className="info-message" role="status">
                        {infoMessage}
                    </p>
                )}

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

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
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>

                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            required
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
                        {submitting ? "Logging in…" : "Login"}
                    </button>

                </form>

                <p className="auth-footer">
                    Don't have an account?{" "}
                    <button
                        className="link-button"
                        onClick={() =>
                            navigate("/register")
                        }
                    >
                        Register
                    </button>
                </p>

            </div>

        </div>
    );
}

export default Login;
