import { lazy, Suspense } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddJob from "./pages/AddJob";
import EditJob from "./pages/EditJob";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";

// Loaded only when opened, so the charting library doesn't slow down
// the login page and dashboard
const Analytics = lazy(() => import("./pages/Analytics"));

function App() {
    return (
        <BrowserRouter>
            <Routes>

                <Route
                    path="/login"
                    element={
                        <PublicOnlyRoute>
                            <Login />
                        </PublicOnlyRoute>
                    }
                />

                <Route
                    path="/register"
                    element={
                        <PublicOnlyRoute>
                            <Register />
                        </PublicOnlyRoute>
                    }
                />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/add-job"
                    element={
                        <ProtectedRoute>
                            <AddJob />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/edit-job/:id"
                    element={
                        <ProtectedRoute>
                            <EditJob />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/analytics"
                    element={
                        <ProtectedRoute>
                            <Suspense fallback={<p className="loading-text">Loading…</p>}>
                                <Analytics />
                            </Suspense>
                        </ProtectedRoute>
                    }
                />

                {/* "/" -> dashboard if logged in, otherwise ProtectedRoute sends to login */}
                <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                />

                <Route
                    path="*"
                    element={<NotFound />}
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;
