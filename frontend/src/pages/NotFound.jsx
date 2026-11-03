import { useNavigate } from "react-router-dom";

function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1 className="auth-logo">JobTrack</h1>

                <h2>Page not found</h2>

                <p className="auth-subtitle">
                    The page you're looking for doesn't exist.
                </p>

                <button
                    className="auth-button"
                    onClick={() => navigate("/dashboard")}
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );
}

export default NotFound;
