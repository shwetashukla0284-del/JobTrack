import { Navigate } from "react-router-dom";
import { isLoggedIn } from "./auth";

// Pages that need a valid (unexpired) login
function ProtectedRoute({ children }) {
    if (!isLoggedIn()) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default ProtectedRoute;
