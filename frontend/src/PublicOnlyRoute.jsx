import { Navigate } from "react-router-dom";
import { isLoggedIn } from "./auth";

// Login and register pages: already logged in -> go to the dashboard
function PublicOnlyRoute({ children }) {
    if (isLoggedIn()) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

export default PublicOnlyRoute;
