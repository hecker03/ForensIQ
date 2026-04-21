import { Link } from "react-router-dom";

const links = [
  { label: "Home", to: "/" },
  { label: "Login", to: "/login" },
  { label: "Signup", to: "/signup" },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/80 mt-14 bg-gray-950/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-3 text-gray-400">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400 mb-3">ForensIQ</h2>
          <p className="text-sm leading-relaxed">
            Advanced digital forensics workspace for tracking, analyzing, and investigating cyber threats.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            {links.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="hover:text-cyan-300 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Contact</h3>
          <p className="text-sm">Email: support@forensiq.com</p>
          <p className="text-sm">Phone: +91 XXXXXXXXXX</p>
        </div>
      </div>

      <div className="border-t border-gray-800/80 text-center py-4 text-gray-500 text-sm">
        © {new Date().getFullYear()} ForensIQ. All rights reserved.
      </div>
    </footer>
  );
}
