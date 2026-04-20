import { Link } from "react-router-dom";

export default function Notfound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center rounded-xl border border-gray-800 bg-gray-900/70 backdrop-blur-xl p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/70 font-mono mb-3">ForensIQ</p>
        <h1 className="text-6xl font-bold text-cyan-400">404</h1>
        <p className="mt-3 text-gray-400">Page not found.</p>
        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-cyan-400 text-gray-950 font-semibold hover:bg-cyan-300 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
