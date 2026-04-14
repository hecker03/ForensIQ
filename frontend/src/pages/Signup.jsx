import { useState } from "react";

function Signup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [focused, setFocused] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const strength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "WEAK", "FAIR", "STRONG", "MAXIMUM"];
  const strengthColor = [
    "",
    "text-red-400",
    "text-yellow-400",
    "text-cyan-400",
    "text-green-400",
  ];
  const strengthBarColor = [
    "",
    "bg-red-400",
    "bg-yellow-400",
    "bg-cyan-400",
    "bg-green-400",
  ];

  const handleChange = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(1);
    }, 2000);
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden flex items-center justify-center py-10">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl pointer-events-none" />

      {/* Grid Background*/}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <style>{`
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .fade-up-1 { animation: fadeSlideUp 0.5s ease 0.05s forwards; opacity: 0; }
        .fade-up-2 { animation: fadeSlideUp 0.5s ease 0.1s forwards; opacity: 0; }
        .fade-up-3 { animation: fadeSlideUp 0.5s ease 0.15s forwards; opacity: 0; }
        .fade-up-4 { animation: fadeSlideUp 0.5s ease 0.2s forwards; opacity: 0; }
        .fade-up-5 { animation: fadeSlideUp 0.5s ease 0.25s forwards; opacity: 0; }
        .fade-up-6 { animation: fadeSlideUp 0.5s ease 0.3s forwards; opacity: 0; }
        .input-glow:focus-within {
          box-shadow: 0 0 0 1px rgba(34,211,238,0.7), 0 0 14px rgba(34,211,238,0.2);
        }
        .btn-cyber { position: relative; overflow: hidden; }
        .btn-cyber::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s ease;
        }
        .btn-cyber:hover::before { left: 100%; }
        .success-anim { animation: successPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        .corner-tl-br { position: relative; }
        .corner-tl-br::before {
          content: '';
          position: absolute;
          top: -1px; left: -1px;
          width: 14px; height: 14px;
          border-top: 2px solid #22d3ee;
          border-left: 2px solid #22d3ee;
          border-radius: 2px 0 0 0;
        }
        .corner-tl-br::after {
          content: '';
          position: absolute;
          bottom: -1px; right: -1px;
          width: 14px; height: 14px;
          border-bottom: 2px solid #22d3ee;
          border-right: 2px solid #22d3ee;
          border-radius: 0 0 2px 0;
        }
      `}</style>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="corner-tl-br">
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-xl p-8">
            {step === 0 ? (
              <>
                {/* Header */}
                <div className="text-center mb-7 fade-up-1">
                  <div className="inline-flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-mono text-purple-400/70 tracking-widest uppercase">
                      User Registration
                    </span>
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  </div>
                  <h1 className="text-4xl font-bold text-cyan-400 tracking-wider mb-1">
                    ForensIQ
                  </h1>
                  <p className="text-gray-500 text-sm font-mono">
                    <span className="text-cyan-500/60">&gt;</span> Create your
                    access credentials
                    <span
                      className="inline-block w-1 h-3 bg-cyan-400 ml-1 align-middle"
                      style={{ animation: "blink 1s step-end infinite" }}
                    />
                  </p>
                </div>

                {/*Input Fields */}
                <div className="space-y-4">
                  <div className="fade-up-2">
                    <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-1.5">
                      User Name
                    </label>
                    <div
                      className={`relative rounded-lg border transition-all duration-300 input-glow ${focused === "name" ? "border-cyan-400/60 bg-gray-800/80" : "border-gray-700/60 bg-gray-800/40"}`}
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm">
                        @
                      </span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={handleChange("name")}
                        onFocus={() => setFocused("name")}
                        onBlur={() => setFocused("")}
                        placeholder="John Smith"
                        className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="fade-up-3">
                    <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-1.5">
                      User ID / Email
                    </label>
                    <div
                      className={`relative rounded-lg border transition-all duration-300 input-glow ${focused === "email" ? "border-cyan-400/60 bg-gray-800/80" : "border-gray-700/60 bg-gray-800/40"}`}
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm">
                        &gt;
                      </span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={handleChange("email")}
                        onFocus={() => setFocused("email")}
                        onBlur={() => setFocused("")}
                        placeholder="test@test.com"
                        className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="fade-up-4">
                    <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-1.5">
                      Access Key
                    </label>
                    <div
                      className={`relative rounded-lg border transition-all duration-300 input-glow ${focused === "password" ? "border-cyan-400/60 bg-gray-800/80" : "border-gray-700/60 bg-gray-800/40"}`}
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm">
                        #
                      </span>
                      <input
                        type="password"
                        value={form.password}
                        onChange={handleChange("password")}
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused("")}
                        placeholder="••••••••••••"
                        className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                    {/* Password Strength measure */}
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${i <= strength ? strengthBarColor[strength] : "bg-gray-700"}`}
                            />
                          ))}
                        </div>
                        <span
                          className={`text-xs font-mono ${strengthColor[strength]}`}
                        >
                          KEY STRENGTH: {strengthLabel[strength]}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="fade-up-5">
                    <label className="block text-xs font-mono text-cyan-400/70 tracking-widest uppercase mb-1.5">
                      Confirm Access Key
                    </label>
                    <div
                      className={`relative rounded-lg border transition-all duration-300 input-glow ${
                        focused === "confirm"
                          ? "border-cyan-400/60 bg-gray-800/80"
                          : form.confirm && form.confirm !== form.password
                            ? "border-red-500/60 bg-gray-800/40"
                            : form.confirm && form.confirm === form.password
                              ? "border-green-500/60 bg-gray-800/40"
                              : "border-gray-700/60 bg-gray-800/40"
                      }`}
                    >
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50 font-mono text-sm">
                        ✓
                      </span>
                      <input
                        type="password"
                        value={form.confirm}
                        onChange={handleChange("confirm")}
                        onFocus={() => setFocused("confirm")}
                        onBlur={() => setFocused("")}
                        placeholder="••••••••••••"
                        className="w-full bg-transparent pl-8 pr-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                    {form.confirm && form.confirm !== form.password && (
                      <p className="text-xs font-mono text-red-400 mt-1">
                        ⚠ Keys do not match
                      </p>
                    )}
                    {form.confirm && form.confirm === form.password && (
                      <p className="text-xs font-mono text-green-400 mt-1">
                        ✓ Keys matched
                      </p>
                    )}
                  </div>

                  <div className="fade-up-6 pt-1">
                    <button
                      onClick={handleSubmit}
                      disabled={
                        loading ||
                        !form.name ||
                        !form.email ||
                        !form.password ||
                        form.password !== form.confirm
                      }
                      className="btn-cyber w-full py-3 bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase rounded-lg shadow-lg shadow-cyan-500/20 hover:bg-cyan-300 hover:shadow-cyan-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" />
                          Provisioning Access...
                        </span>
                      ) : (
                        "Register User"
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-800" />
                  <span className="text-xs font-mono text-gray-600">OR</span>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>

                <p className="text-center text-sm font-mono text-gray-500">
                  Already registered?{" "}
                  <a
                    href="/login"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
                  >
                    Login
                  </a>
                </p>
              </>
            ) : (
              /* Success state */
              <div className="text-center py-8 success-anim">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/30">
                  <svg
                    className="w-8 h-8 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-cyan-400 font-mono tracking-wider mb-2">
                  ACCESS GRANTED
                </h2>
                <p className="text-gray-400 font-mono text-sm mb-1">
                  User account provisioned.
                </p>
                <p className="text-gray-600 font-mono text-xs mb-6">
                  Welcome to ForensIQ, {form.name || "Operator"}.
                </p>
                <a
                  href="/login"
                  className="inline-block px-6 py-2.5 bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase rounded-lg hover:bg-cyan-300 transition-all duration-300"
                >
                  Proceed to Login →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
