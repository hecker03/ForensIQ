import { useEffect, useState } from "react";
import PortalLayout from "../components/layout/PortalLayout";
import useAuth from "../hooks/useAuth";
import api, { extractApiError } from "../lib/api";

function formatJoinDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRecords: 0,
    latestCategory: "-",
    latestCreatedAt: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const response = await api.get("/records");
        const records = response.data.records || [];

        if (!cancelled) {
          setStats({
            totalRecords: records.length,
            latestCategory: records[0]?.category || "-",
            latestCreatedAt: records[0]?.createdAt || null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractApiError(err, "Unable to load profile stats"));
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PortalLayout
      title="Profile"
      subtitle="Account identity and persisted activity metrics synced from MongoDB."
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            User Identity
          </h2>

          <dl className="space-y-3">
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Full Name
              </dt>
              <dd className="text-sm text-gray-100">{user?.name}</dd>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Email
              </dt>
              <dd className="text-sm text-gray-100 break-all">{user?.email}</dd>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Joined
              </dt>
              <dd className="text-sm text-gray-100">{formatJoinDate(user?.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            Activity Summary
          </h2>

          <div className="grid gap-3">
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Total Stored Inputs
              </p>
              <p className="text-xl text-cyan-200 font-semibold">{stats.totalRecords}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Latest Category
              </p>
              <p className="text-sm text-gray-100">{stats.latestCategory}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Latest Record Time
              </p>
              <p className="text-sm text-gray-100">
                {stats.latestCreatedAt
                  ? new Date(stats.latestCreatedAt).toLocaleString()
                  : "No records yet"}
              </p>
            </div>
          </div>

          {error ? <p className="text-sm text-red-300 mt-4">{error}</p> : null}
        </section>
      </div>
    </PortalLayout>
  );
}
