import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
      <h1 className="text-2xl font-bold text-cyan-400">ForensIQ</h1>

      <div className="space-x-4">
        <Link
          to="/login"
          className="text-cyan-400 border border-cyan-400 px-4 py-2 rounded hover:bg-cyan-400 hover:text-black transition"
        >
          Login
        </Link>

        <Link
          to="/signup"
          className="text-cyan-400 border border-cyan-400 px-4 py-2 rounded hover:bg-cyan-400 hover:text-black transition"
        >
          Signup
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
