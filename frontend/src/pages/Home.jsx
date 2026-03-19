import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function Home() {
  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        {/* Hero Section */}
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-cyan-400 mb-6 tracking-wide animate-pulse">
            ForensIQ
          </h1>

          <p className="text-gray-400 max-w-xl mb-8 leading-relaxed">
            Advanced Digital Forensic Intelligence Platform for tracking,
            analyzing and investigating cyber threats in real-time.
          </p>

          <button className="px-6 py-3 bg-cyan-400 text-black font-semibold rounded-lg shadow-lg shadow-cyan-500/30 hover:scale-110 hover:shadow-cyan-400/50 transition duration-300">
            Get Started
          </button>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 px-6 md:px-16 pb-16">
          <div className="p-6 bg-gray-900/80 backdrop-blur-lg rounded-xl border border-gray-800 hover:shadow-cyan-500/20 hover:shadow-xl hover:-translate-y-2 transition duration-300">
            <h2 className="text-xl font-semibold text-cyan-400 mb-2">
              Automated Forensics Pipeline
            </h2>
            <p className="text-gray-400">
              No manual Volatility commands needed just feed a memory dump. Our
              platform automatically runs all plugins, structures the results
              into clean, analyzable dataframes, and stores them securely in
              MongoDB.
            </p>
          </div>

          <div className="p-6 bg-gray-900/80 backdrop-blur-lg rounded-xl border border-gray-800 hover:shadow-cyan-500/20 hover:shadow-xl hover:-translate-y-2 transition duration-300">
            <h2 className="text-xl font-semibold text-cyan-400 mb-2">
              Multi-Method Malware Detection
            </h2>
            <p className="text-gray-400">
              Multi Method Malware Detection that blends hash checks, behavior
              rules, threat intel lookups, and entropy analysis giving you
              stronger protection in one platform.
            </p>
          </div>

          <div className="p-6 bg-gray-900/80 backdrop-blur-lg rounded-xl border border-gray-800 hover:shadow-cyan-500/20 hover:shadow-xl hover:-translate-y-2 transition duration-300">
            <h2 className="text-xl font-semibold text-cyan-400 mb-2">
              Steganography Detection
            </h2>
            <p className="text-gray-400">
              Steganography Detection quickly uncovers hidden data in files,
              ensuring secure communication and protecting against covert
              information leaks.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Home;
