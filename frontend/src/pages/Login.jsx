import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { login, extractApiError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractApiError(err, "Unable to login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/80 backdrop-blur-xl p-6 md:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-cyan-400/70 mb-2">
            User Authentication Portal
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 tracking-wide mb-1">
            ForensIQ
          </h1>
          <p className="text-sm text-gray-500">Sign in to your secure workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="test@test.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="••••••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase py-2.5 hover:bg-cyan-300 transition-colors disabled:opacity-70"
          >
            {loading ? "Authenticating..." : "Secure Login"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 font-mono">
          No account?{" "}
          <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            Register User
          </Link>
        </p>
      </div>
    </div>
  );
}
