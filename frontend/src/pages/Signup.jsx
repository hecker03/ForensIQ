import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

const initialState = {
  name: "",
  email: "",
  password: "",
  confirm: "",
};

function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export default function Signup() {
  const navigate = useNavigate();
  const { signup, extractApiError } = useAuth();

  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const hasMismatch = Boolean(form.confirm) && form.password !== form.confirm;

  const strengthLabel = ["", "Weak", "Fair", "Strong", "Maximum"];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-cyan-400", "bg-green-400"];

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractApiError(err, "Unable to create account"));
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
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-purple-300/70 mb-2">
            User Registration
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 tracking-wide mb-1">
            ForensIQ
          </h1>
          <p className="text-sm text-gray-500">Create your access credentials.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={onChange("name")}
              autoComplete="name"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={onChange("email")}
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
              value={form.password}
              onChange={onChange("password")}
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
              placeholder="••••••••••••"
            />
            {form.password ? (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 flex-1 rounded-full ${step <= strength ? strengthColor[strength] : "bg-gray-700"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 font-mono">Strength: {strengthLabel[strength]}</p>
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={form.confirm}
              onChange={onChange("confirm")}
              autoComplete="new-password"
              required
              className={`w-full rounded-lg border bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 ${
                hasMismatch
                  ? "border-red-500/60 focus:border-red-400/60 focus:ring-red-500/30"
                  : "border-gray-700 focus:border-cyan-400/60 focus:ring-cyan-500/40"
              }`}
              placeholder="••••••••••••"
            />
            {hasMismatch ? <p className="mt-1 text-xs text-red-300">Passwords do not match.</p> : null}
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || hasMismatch}
            className="w-full rounded-lg bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase py-2.5 hover:bg-cyan-300 transition-colors disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Register User"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500 font-mono">
          Already registered?{" "}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            Login
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-gray-500 font-mono">
          <Link to="/" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
            Back to Landing Page
          </Link>
        </p>
      </div>
    </div>
  );
}
