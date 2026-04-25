import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="px-4 md:px-8 py-4 border-b border-gray-800/90 bg-gray-950/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-2xl font-bold text-cyan-400 tracking-wide">
          ForensIQ
        </Link>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="text-cyan-300 border border-cyan-400/50 px-4 py-2 rounded-lg hover:bg-cyan-500/10 transition"
              >
                Dashboard
              </Link>
              <Link
                to="/analytics"
                className="text-cyan-300 border border-cyan-400/50 px-4 py-2 rounded-lg hover:bg-cyan-500/10 transition"
              >
                Analytics
              </Link>
              <button
                onClick={logout}
                className="text-red-300 border border-red-400/50 px-4 py-2 rounded-lg hover:bg-red-500/10 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-cyan-300 border border-cyan-400/50 px-4 py-2 rounded-lg hover:bg-cyan-500/10 transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-cyan-400 text-gray-950 border border-cyan-300 px-4 py-2 rounded-lg hover:bg-cyan-300 transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
