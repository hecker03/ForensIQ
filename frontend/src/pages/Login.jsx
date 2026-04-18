import { useState } from "react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl pointer-events-none" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <style>{`
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeSlideUp 0.6s ease forwards; }
        .fade-up-1 { animation: fadeSlideUp 0.6s ease 0.1s forwards; opacity: 0; }
        .fade-up-2 { animation: fadeSlideUp 0.6s ease 0.2s forwards; opacity: 0; }
        .fade-up-3 { animation: fadeSlideUp 0.6s ease 0.3s forwards; opacity: 0; }
        .fade-up-4 { animation: fadeSlideUp 0.6s ease 0.4s forwards; opacity: 0; }
        .input-glow:focus-within {
          box-shadow: 0 0 0 1px rgba(34,211,238,0.8), 0 0 16px rgba(34,211,238,0.25);
        }
        .btn-cyber {
          position: relative;
          overflow: hidden;
        }
        .btn-cyber::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s ease;
        }
        .btn-cyber:hover::before { left: 100%; }
        .corner-tl::before {
          content: '';
          position: absolute;
          top: -1px; left: -1px;
          width: 12px; height: 12px;
          border-top: 2px solid #22d3ee;
          border-left: 2px solid #22d3ee;
        }
        .corner-br::after {
          content: '';
          position: absolute;
          bottom: -1px; right: -1px;
          width: 12px; height: 12px;
          border-bottom: 2px solid #22d3ee;
          border-right: 2px solid #22d3ee;
        }
      `}</style>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="corner-tl corner-br relative">
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-xl p-8">
            {/* Header */}
            <div className="text-center mb-8 fade-up">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-mono text-cyan-400/70 tracking-widest uppercase">
                  User Authentication Portal
                </span>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <h1 className="text-4xl font-bold text-cyan-400 tracking-wider mb-1">
                ForensIQ
              </h1>
              <p className="text-gray-500 text-sm font-mono">
                <span className="text-cyan-500/60">&gt;</span> Authenticate to
                continue
                <span
                  className="inline-block w-1 h-3 bg-cyan-400 ml-1 align-middle"
                  style={{ animation: "blink 1s step-end infinite" }}
                />
              </p>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div className="fade-up-2">
                <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-2">
                  User ID / Email
                </label>
                <div
                  className={`relative rounded-lg border transition-all duration-300 input-glow ${focused === "email" ? "border-cyan-400/60 bg-gray-800/80" : "border-gray-700/60 bg-gray-800/40"}`}
                >
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm select-none">
                    &gt;
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused("")}
                    placeholder="test@test.com"
                    className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="fade-up-3">
                <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-2">
                  Access Key / Password
                </label>
                <div
                  className={`relative rounded-lg border transition-all duration-300 input-glow ${focused === "password" ? "border-cyan-400/60 bg-gray-800/80" : "border-gray-700/60 bg-gray-800/40"}`}
                >
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm select-none">
                    #
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused("")}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end mt-1.5">
                  <a
                    href="#"
                    className="text-xs font-mono text-cyan-500/60 hover:text-cyan-400 transition-colors"
                  >
                    Reset credentials →
                  </a>
                </div>
              </div>

              <div className="fade-up-4 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-cyber w-full py-3 bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase rounded-lg shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 hover:shadow-cyan-400/40 disabled:opacity-70 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    "Secure Login"
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs font-mono text-gray-600">OR</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <p className="text-center text-sm font-mono text-gray-500">
              No account?{" "}
              <a
                href="/signup"
                className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
              >
                Register User
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
