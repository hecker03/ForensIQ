import { Link, NavLink, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const placeholderItems = [
  "Cases",
  "Scanner",
  "Reports",
  "Evidence Vault",
  "Threat Feeds",
];

function initialsFromName(name) {
  if (!name) return "U";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-lg px-4 py-2.5 font-mono text-xs tracking-widest uppercase border transition-all duration-200 ${
          isActive
            ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300"
            : "border-gray-800 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function PlaceholderItem({ label }) {
  return (
    <div className="rounded-lg px-4 py-2.5 font-mono text-xs tracking-widest uppercase border border-gray-800 text-gray-600">
      {label}
    </div>
  );
}

export default function PortalLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const initials = initialsFromName(user?.name);

  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 min-h-screen flex">
        <aside className="hidden md:flex md:w-72 xl:w-80 border-r border-gray-800/90 bg-gray-950/70 backdrop-blur-xl flex-col">
          <div className="p-5 border-b border-gray-800/80">
            <Link to="/profile" className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-linear-to-br from-cyan-400 to-purple-500 text-gray-900 font-bold font-mono flex items-center justify-center shadow-lg shadow-cyan-500/20">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/80 font-mono">
                  Profile
                </p>
                <p className="text-sm text-gray-200 font-medium truncate max-w-[170px]">
                  {user?.name || "Operator"}
                </p>
              </div>
            </Link>
          </div>

          <div className="p-5 flex-1 overflow-y-auto">
            <p className="text-[11px] uppercase tracking-[0.25em] text-gray-500 font-mono mb-3">
              Navigation
            </p>
            <div className="space-y-2.5">
              <NavItem to="/dashboard" label="Dashboard" />
              {placeholderItems.map((item) => (
                <PlaceholderItem key={item} label={item} />
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-gray-800/80">
            <button
              onClick={logout}
              className="w-full rounded-lg px-4 py-2.5 border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors font-mono text-xs uppercase tracking-widest"
            >
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="md:hidden border-b border-gray-800/90 bg-gray-950/70 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/profile" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-cyan-400 to-purple-500 text-gray-900 font-bold font-mono flex items-center justify-center">
                {initials}
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-mono">
                Profile
              </span>
            </Link>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 font-mono text-xs uppercase tracking-widest"
            >
              Logout
            </button>
          </header>

          <div className="border-b border-gray-800/70 px-4 md:px-8 pt-5 md:pt-8 pb-5 md:pb-6 bg-gray-950/45 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-400/70 font-mono mb-2">
              Secure Workspace
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-cyan-300 tracking-wide">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm md:text-base text-gray-400 max-w-3xl leading-relaxed">
                {subtitle}
              </p>
            ) : null}
          </div>

          <main className="flex-1 px-4 md:px-8 py-5 md:py-7">{children}</main>

          <div className="md:hidden border-t border-gray-800/90 p-4 bg-gray-950/70 backdrop-blur-xl">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Link
                to="/dashboard"
                className={`whitespace-nowrap rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-widest border ${
                  location.pathname === "/dashboard"
                    ? "border-cyan-400/60 text-cyan-300 bg-cyan-500/10"
                    : "border-gray-800 text-gray-400"
                }`}
              >
                Dashboard
              </Link>
              {placeholderItems.map((item) => (
                <span
                  key={item}
                  className="whitespace-nowrap rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-widest border border-gray-800 text-gray-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
