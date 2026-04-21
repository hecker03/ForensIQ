import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function FullscreenLoader() {
  return (
    <div className="min-h-screen bg-gray-950 text-cyan-400 flex items-center justify-center font-mono tracking-widest">
      Authenticating...
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loadingUser } = useAuth();

  if (loadingUser) {
    return <FullscreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
