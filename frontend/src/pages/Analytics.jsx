import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChartGrid from "../components/charts/ChartGrid";
import PortalLayout from "../components/layout/PortalLayout";
import Navbar from "../components/Navbar";
import useAuth from "../hooks/useAuth";
import api, { extractApiError } from "../lib/api";
import { saveOperatorSnapshot } from "../lib/operatorSnapshot";

const PAGE_SIZE = 6;

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

function StatusBadge({ status }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono text-emerald-300">
        Success
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono text-red-300">
      Error
    </span>
  );
}

function UnauthenticatedAnalytics() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-6 md:p-8">
          <h1 className="text-2xl text-cyan-300 font-semibold">Analytics</h1>
          <p className="mt-3 text-gray-400 leading-relaxed">
            Sign in to access persisted analysis history and rich chart visualizations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-300"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="rounded-lg border border-cyan-400/50 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/10"
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Analytics() {
  const { isAuthenticated, loadingUser } = useAuth();
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        setLoadingHistory(true);
        setHistoryError("");

        const response = await api.get(`/analysis/history?page=${page}&limit=${PAGE_SIZE}`);
        if (cancelled) return;

        const results = response.data.results || [];
        setHistoryItems(results);
        setTotal(response.data.total || 0);

        if (results.length > 0) {
          setSelectedId((prev) => (results.some((item) => item.id === prev) ? prev : results[0].id));
        } else {
          setSelectedId("");
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryItems([]);
          setTotal(0);
          setSelectedId("");
          setHistoryError(extractApiError(error, "Unable to load analysis history"));
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, page]);

  useEffect(() => {
    if (!selectedId) return;
    const selectedItem = historyItems.find((item) => item.id === selectedId);
    if (!selectedItem || selectedItem.status !== "success") return;

    if (selectedItem.report) {
      saveOperatorSnapshot({
        category: "Memory Analysis",
        analyzedAt: selectedItem.report.analyzedAt,
        fileName: selectedItem.report.fileName || selectedItem.filename,
        fileSizeBytes: selectedItem.report.fileSizeBytes || selectedItem.fileSize,
        severity: selectedItem.report.severity,
        rootCause: selectedItem.report.rootCause,
        suspiciousProcesses: selectedItem.report.suspiciousProcesses || [],
        recommendedActions: selectedItem.report.recommendedActions || [],
        chartDatasets: selectedItem.chartDatasets || null,
      });
    }
  }, [historyItems, selectedId]);

  const selectedItem = useMemo(
    () => historyItems.find((item) => item.id === selectedId) || null,
    [historyItems, selectedId],
  );

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-950 text-cyan-400 flex items-center justify-center font-mono tracking-widest">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <UnauthenticatedAnalytics />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PortalLayout
      title="Analytics"
      subtitle="Persisted analysis history with chart-rich visualizations for authenticated operators."
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80">
              Analysis History
            </h2>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
              Total Records: {total}
            </p>
          </div>

          {historyError ? <p className="text-sm text-red-300">{historyError}</p> : null}

          {loadingHistory ? (
            <p className="text-sm text-gray-400">Loading history...</p>
          ) : historyItems.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
              <p className="text-sm text-gray-400">
                No persisted analysis entries yet. Run an analysis from the dashboard.
              </p>
              <Link
                to="/dashboard"
                className="inline-flex mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-900 hover:bg-cyan-300"
              >
                Go To Dashboard
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {historyItems.map((item) => {
                  const isSelected = item.id === selectedId;
                  const severityLevel = item.report?.severity?.level || "-";
                  const severityScore = item.report?.severity?.score;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-gray-800 bg-gray-800/35 hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-gray-100 break-all">{item.filename}</p>
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            {formatFileSize(item.fileSize)} | {formatTimestamp(item.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} />
                          {item.status === "success" ? (
                            <span className="text-xs text-gray-300 font-mono">
                              {severityLevel}
                              {typeof severityScore === "number" ? ` (${severityScore}/100)` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-mono uppercase tracking-widest text-gray-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                  Page {page} / {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-mono uppercase tracking-widest text-gray-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>

        {selectedItem?.status === "error" ? (
          <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 md:p-6">
            <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-red-200 mb-3">
              Persisted Pipeline Error
            </h2>
            <p className="text-sm text-red-100">
              {selectedItem.errorMessage || "Pipeline execution failed for this run."}
            </p>
          </section>
        ) : null}

        <ChartGrid
          chartDatasets={selectedItem?.chartDatasets || null}
          title="Selected Analysis Visualizations"
          subtitle="Charts are rendered from persisted normalized datasets."
        />
      </div>
    </PortalLayout>
  );
}
