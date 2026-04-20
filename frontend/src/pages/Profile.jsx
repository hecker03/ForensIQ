import { useState } from "react";
import PortalLayout from "../components/layout/PortalLayout";
import useAuth from "../hooks/useAuth";

function formatJoinDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Profile() {
  const { user, updateProfile, extractApiError } = useAuth();
  const [form, setForm] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
  }));
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setSaveSuccess("");
    setSaveError("");
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    try {
      setSavingProfile(true);
      setSaveError("");
      setSaveSuccess("");

      const updatedUser = await updateProfile({
        name: form.name,
        email: form.email,
      });

      setForm({
        name: updatedUser?.name || "",
        email: updatedUser?.email || "",
      });

      setSaveSuccess("Profile updated successfully.");
    } catch (err) {
      setSaveError(extractApiError(err, "Unable to update profile"));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <PortalLayout
      title="Profile"
      subtitle="Update your operator identity used across the analysis workspace."
    >
      <section className="max-w-2xl rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-5 md:p-6">
        <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
          User Identity
        </h2>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={onChange("name")}
              autoComplete="name"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={onChange("email")}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Joined</p>
            <p className="text-sm text-gray-100">{formatJoinDate(user?.createdAt)}</p>
          </div>

          {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}
          {saveSuccess ? <p className="text-sm text-green-300">{saveSuccess}</p> : null}

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-lg bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase text-xs hover:bg-cyan-300 transition-colors disabled:opacity-60"
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>
    </PortalLayout>
  );
}
