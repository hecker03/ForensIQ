import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../components/layout/PortalLayout";
import useAuth from "../hooks/useAuth";
import api, { extractApiError } from "../lib/api";
import { readOperatorSnapshot, saveOperatorSnapshot } from "../lib/operatorSnapshot";

function formatJoinDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimestamp(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** unitIndex;
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

export default function OperatorSnapshots() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(() => readOperatorSnapshot());
  const [loadingRemoteSnapshot, setLoadingRemoteSnapshot] = useState(false);
  const [remoteSnapshotError, setRemoteSnapshotError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadLatestSnapshot = async () => {
      try {
        setLoadingRemoteSnapshot(true);
        setRemoteSnapshotError("");

        const response = await api.get("/analysis/history?page=1&limit=1");
        if (cancelled) return;

        const latest = response.data.results?.[0];
        if (!latest || latest.status !== "success" || !latest.report) {
          setSnapshot(null);
          return;
        }

        const nextSnapshot = {
          category: "Memory Analysis",
          analyzedAt: latest.report.analyzedAt,
          fileName: latest.report.fileName || latest.filename,
          fileSizeBytes: latest.report.fileSizeBytes || latest.fileSize,
          severity: latest.report.severity,
          rootCause: latest.report.rootCause,
          suspiciousProcesses: latest.report.suspiciousProcesses || [],
          recommendedActions: latest.report.recommendedActions || [],
          chartDatasets: latest.chartDatasets || null,
        };

        setSnapshot(nextSnapshot);
        saveOperatorSnapshot(nextSnapshot);
      } catch (error) {
        if (!cancelled) {
          setRemoteSnapshotError(extractApiError(error, "Unable to refresh persisted snapshot"));
        }
      } finally {
        if (!cancelled) {
          setLoadingRemoteSnapshot(false);
        }
      }
    };

    loadLatestSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoadingRemoteSnapshot(true);
      setRemoteSnapshotError("");

      const response = await api.get("/analysis/history?page=1&limit=1");
      const latest = response.data.results?.[0];

      if (!latest || latest.status !== "success" || !latest.report) {
        setSnapshot(null);
        return;
      }

      const nextSnapshot = {
        category: "Memory Analysis",
        analyzedAt: latest.report.analyzedAt,
        fileName: latest.report.fileName || latest.filename,
        fileSizeBytes: latest.report.fileSizeBytes || latest.fileSize,
        severity: latest.report.severity,
        rootCause: latest.report.rootCause,
        suspiciousProcesses: latest.report.suspiciousProcesses || [],
        recommendedActions: latest.report.recommendedActions || [],
        chartDatasets: latest.chartDatasets || null,
      };

      setSnapshot(nextSnapshot);
      saveOperatorSnapshot(nextSnapshot);
    } catch (error) {
      setRemoteSnapshotError(extractApiError(error, "Unable to refresh persisted snapshot"));
    } finally {
      setLoadingRemoteSnapshot(false);
    }
  };

  return (
    <PortalLayout
      title="Operator Snapshots"
      subtitle="Dedicated operational context for the analyst and the latest pipeline execution."
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            Operator Identity
          </h2>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Name</p>
              <p className="text-sm text-gray-100">{user?.name || "-"}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Email</p>
              <p className="text-sm text-gray-100 break-all">{user?.email || "-"}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Joined</p>
              <p className="text-sm text-gray-100">{formatJoinDate(user?.createdAt)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80">
              Latest Analysis Snapshot
            </h2>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-gray-300 hover:border-cyan-500/50 hover:text-cyan-300"
            >
              {loadingRemoteSnapshot ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {remoteSnapshotError ? <p className="text-sm text-red-300 mb-3">{remoteSnapshotError}</p> : null}

          {!snapshot ? (
            <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
              <p className="text-sm text-gray-400">
                No snapshot available yet. Run an analysis from the dashboard to populate this page.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-900 hover:bg-cyan-300"
              >
                Go To Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Category</p>
                <p className="text-sm text-gray-100">{snapshot.category}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Dump File</p>
                <p className="text-sm text-gray-100 break-all">{snapshot.fileName}</p>
                <p className="text-xs text-gray-500 mt-1">{formatFileSize(snapshot.fileSizeBytes)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Threat Severity</p>
                <p className="text-sm text-gray-100">
                  {snapshot?.severity?.level || "-"} ({snapshot?.severity?.score ?? "-"}/100)
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                  Suspicious Process Count
                </p>
                <p className="text-sm text-gray-100">{snapshot.suspiciousProcesses?.length || 0}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">Last Analyzed</p>
                <p className="text-sm text-gray-100">{formatTimestamp(snapshot.analyzedAt)}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
