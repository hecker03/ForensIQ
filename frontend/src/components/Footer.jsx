function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 mt-10">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8 text-gray-400">
        <div>
          <h2 className="text-2xl font-bold text-cyan-400 mb-3">ForensIQ</h2>
          <p className="text-sm">
            Advanced digital forensic platform designed to analyze, detect, and
            investigate cyber threats efficiently.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
          <ul className="space-y-2">
            <li className="hover:text-cyan-400 cursor-pointer transition">
              Home
            </li>

            <li className="hover:text-cyan-400 cursor-pointer transition">
              Login
            </li>
            <li className="hover:text-cyan-400 cursor-pointer transition">
              Signup
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Contact</h3>
          <p className="text-sm">Email: support@forensiq.com</p>
          <p className="text-sm">Phone: +91 XXXXXXXXXX</p>
        </div>
      </div>

      <div className="border-t border-gray-800 text-center py-4 text-gray-500 text-sm">
        © {new Date().getFullYear()} ForensIQ. All rights reserved.
      </div>
    </footer>
  );
}

export default Footer;
