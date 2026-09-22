import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");

        try {
            const response = await api.post(
                "/auth/login",
                {
                    email,
                    password
                }
            );

            localStorage.setItem(
                "token",
                response.data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(response.data.user)
            );

            navigate("/dashboard");

        } catch (error) {
            if (error.response?.status === 401) {
                setErrorMessage(
                    "Invalid email or password"
                );
            } else {
                setErrorMessage(
                    "Something went wrong. Please try again."
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

                <h2>Welcome Back</h2>

                <p className="auth-subtitle">
                    Login to manage your job applications
                </p>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label>Email</label>

                        <input
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            placeholder="Enter your email"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>

                        <input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                        />
                    </div>

                    {errorMessage && (
                        <p className="error-message">
                            {errorMessage}
                        </p>
                    )}

                    <button
                        className="auth-button"
                        type="submit"
                    >
                        Login
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