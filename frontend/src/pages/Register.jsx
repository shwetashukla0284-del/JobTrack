import { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage("");

        if (!name || !email || !password) {
            setErrorMessage("Please fill in all fields");
            return;
        }

        if (password.length < 6) {
            setErrorMessage(
                "Password must be at least 6 characters"
            );
            return;
        }

        try {
            await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password
                }
            );

            navigate("/login");

        } catch (error) {
            if (error.response?.status === 400) {
                setErrorMessage(
                    error.response.data.message
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

                <h2>Create Account</h2>

                <p className="auth-subtitle">
                    Start tracking your job applications
                </p>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    <div className="form-group">
                        <label>Name</label>

                        <input
                            type="text"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            placeholder="Enter your name"
                        />
                    </div>

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
                            placeholder="Create a password"
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
                        Register
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