import { useState } from "react";
import { Link } from "react-router-dom";
import { NavLink } from "react-router-dom";
function Profile() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // User Object
  const user = {
    name: "John Smith",
    email: "john.smith@forensiq.io",
    joined: "March 2024",
    location: "India",
    cases: 42,
    scans: 187,
    threats: 13,
    lastActive: "Today, 10:32 AM",
    avatar: "JS",
  };

  return (
    <div className="relative min-h-screen w-full bg-gray-950 text-white overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-cyan-500/10 via-transparent to-purple-500/10 blur-3xl pointer-events-none" />

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(34,211,238,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(34,211,238,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); }
        }

        .f1{animation:fadeUp 0.5s ease 0.05s both}
        .f2{animation:fadeUp 0.5s ease 0.12s both}
        .f3{animation:fadeUp 0.5s ease 0.19s both}
        .f4{animation:fadeUp 0.5s ease 0.26s both}
        .f5{animation:fadeUp 0.5s ease 0.33s both}
        .f6{animation:fadeUp 0.5s ease 0.40s both}

        .dropdown-anim { animation: fadeIn 0.2s ease both; }

        .avatar-ring { animation: pulse-ring 2.5s ease-out infinite; }

        .stat-card {
          background: rgba(17,24,39,0.7);
          border: 1px solid rgba(55,65,81,0.6);
          border-radius: 10px;
          padding: 16px;
          transition: border-color 0.25s, transform 0.2s;
        }
        .stat-card:hover {
          border-color: rgba(34,211,238,0.4);
          transform: translateY(-2px);
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #9ca3af;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .dropdown-item:hover { background: rgba(34,211,238,0.08); color: #22d3ee; }
        .dropdown-item.logout:hover { background: rgba(248,113,113,0.08); color: #f87171; }

        .profile-card {
          background: rgba(17,24,39,0.8);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(55,65,81,0.6);
          border-radius: 14px;
          padding: 28px;
        }
      `}</style>

      <div
        className="relative z-20 flex items-center justify-between px-6 md:px-10 py-4 border-b border-gray-800/60"
        style={{ background: "rgba(3,7,18,0.7)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xl font-bold text-cyan-400 tracking-widest font-mono">
            ForensIQ
          </span>
        </div>

        {/* Navbar links */}
        <div className="hidden md:flex items-center gap-6">
          {[
            { name: "Dashboard", path: "/profile" },
            { name: "Cases", path: "/cases" },
            { name: "Scanner", path: "/scanner" },
            { name: "Reports", path: "/reports" },
          ].map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `text-sm font-mono tracking-widest uppercase transition-all duration-300 ${
                  isActive ? "text-yellow-400" : "text-gray-300"
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>

        {/* Profile icon */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 focus:outline-none"
          >
            {/* Avatar */}
            <div
              className="avatar-ring w-9 h-9 rounded-full bg-linear-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-gray-950 font-bold font-mono text-sm cursor-pointer"
              style={{ boxShadow: "0 0 0 2px rgba(34,211,238,0.5)" }}
            >
              {user.avatar}
            </div>
            {/* Chevron */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              style={{
                transition: "transform 0.2s",
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M6 9l6 6 6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="dropdown-anim absolute right-0 mt-3 w-48 rounded-xl border border-gray-700/70 py-2 z-50"
              style={{
                background: "rgba(17,24,39,0.95)",
                backdropFilter: "blur(16px)",
                boxShadow:
                  "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.1)",
              }}
            >
              <div className="px-4 pb-2 mb-1 border-b border-gray-800">
                <p className="font-mono text-xs text-white truncate">
                  {user.name}
                </p>
                <p className="font-mono text-xs text-gray-600 truncate">
                  {user.email}
                </p>
              </div>

              <button
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                    strokeLinecap="round"
                  />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Profile
              </button>

              {/* Settings */}
              <button
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                Settings
              </button>

              <div
                style={{
                  height: 1,
                  background: "rgba(31,41,55,0.8)",
                  margin: "4px 0",
                }}
              />

              {/* Logout */}
              <button
                className="dropdown-item logout"
                onClick={() => {
                  setDropdownOpen(false);
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                    strokeLinecap="round"
                  />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-10">
        {/* Profile Header*/}
        <div className="profile-card f1 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-full bg-linear-to-br from-cyan-400 via-cyan-300 to-purple-500 flex items-center justify-center text-gray-950 font-bold font-mono text-2xl"
                style={{
                  boxShadow:
                    "0 0 0 3px rgba(34,211,238,0.3), 0 0 24px rgba(34,211,238,0.2)",
                }}
              >
                {user.avatar}
              </div>
              <span
                className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-gray-900"
                style={{ animation: "blink 3s ease infinite" }}
              />
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-white tracking-wide">
                  {user.name}
                </h1>
              </div>
              <p className="text-gray-500 font-mono text-sm mb-3">
                {user.email}
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-mono text-gray-500">
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {user.location}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Joined {user.joined}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Last active: {user.lastActive}
                </span>
              </div>
            </div>

            {/* Edit button */}
            <button className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-400 font-mono text-xs tracking-widest uppercase transition-all duration-200 hover:bg-cyan-400/10 hover:border-cyan-400/70">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                  strokeLinecap="round"
                />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Profile
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6 f2">
          {[
            {
              label: "Cases Handled",
              value: user.cases,
              color: "#22d3ee",
              icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
            },
            {
              label: "Total Scans",
              value: user.scans,
              color: "#a855f7",
              icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
            },
            {
              label: "Threats Found",
              value: user.threats,
              color: "#f87171",
              icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
            },
          ].map((s) => (
            <div key={s.label} className="stat-card text-center">
              <svg
                className="mx-auto mb-2"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={s.color}
                strokeWidth="2"
              >
                <path d={s.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p
                className="text-2xl font-bold font-mono"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {dropdownOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}

export default Profile;
