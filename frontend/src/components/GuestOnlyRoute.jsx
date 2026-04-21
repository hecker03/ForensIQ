import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function FullscreenLoader() {
  return (
    <div className="min-h-screen bg-gray-950 text-cyan-400 flex items-center justify-center font-mono tracking-widest">
      Loading...
    </div>
  );
}

export default function GuestOnlyRoute({ children }) {
  const { isAuthenticated, loadingUser } = useAuth();

  if (loadingUser) {
    return <FullscreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
