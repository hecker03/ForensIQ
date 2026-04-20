import { useMemo, useState } from "react";
import PortalLayout from "../components/layout/PortalLayout";
import api, { extractApiError } from "../lib/api";
import { saveOperatorSnapshot } from "../lib/operatorSnapshot";

const ANALYSIS_CATEGORIES = [
  {
    id: "memory-analysis",
    label: "Memory Analysis",
    apiPath: "/analysis/memory",
    description: "Upload a binary memory dump and run anomaly and threat analysis.",
  },
];

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** unitIndex;
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatTimestamp(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function severityTone(level) {
  const severityMap = {
    Low: {
      pill: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
      dot: "bg-emerald-400",
    },
    Medium: {
      pill: "bg-yellow-500/15 text-yellow-300 border-yellow-400/40",
      dot: "bg-yellow-400",
    },
    High: {
      pill: "bg-orange-500/15 text-orange-300 border-orange-400/40",
      dot: "bg-orange-400",
    },
    Critical: {
      pill: "bg-red-500/15 text-red-300 border-red-400/40",
      dot: "bg-red-400",
    },
  };

  return severityMap[level] || severityMap.Medium;
}

export default function Dashboard() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(ANALYSIS_CATEGORIES[0].id);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState(null);
  const [error, setError] = useState("");

  const selectedCategory = useMemo(
    () =>
      ANALYSIS_CATEGORIES.find((category) => category.id === selectedCategoryId) ||
      ANALYSIS_CATEGORIES[0],
    [selectedCategoryId],
  );

  const handleFileSelection = (event) => {
    setSelectedFile(event.target.files?.[0] || null);
    setError("");
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setError("Upload a memory dump file before running analysis.");
      return;
    }

    try {
      setAnalyzing(true);
      setError("");

      const response = await api.post(
        `${selectedCategory.apiPath}?category=${encodeURIComponent(selectedCategory.label)}`,
        selectedFile,
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(selectedFile.name),
          },
          timeout: 120000,
        },
      );

      const report = response.data.report;
      setAnalysisReport(report);

      saveOperatorSnapshot({
        category: selectedCategory.label,
        analyzedAt: report.analyzedAt,
        fileName: report.fileName,
        fileSizeBytes: report.fileSizeBytes,
        severity: report.severity,
        rootCause: report.rootCause,
        suspiciousProcesses: report.suspiciousProcesses,
        recommendedActions: report.recommendedActions,
      });
    } catch (err) {
      setError(extractApiError(err, "Unable to run memory analysis"));
    } finally {
      setAnalyzing(false);
    }
  };

  const tone = severityTone(analysisReport?.severity?.level);

  return (
    <PortalLayout
      title="Memory Analysis Dashboard"
      subtitle="Upload a memory dump, run the ML pipeline, and review structured threat analysis reports."
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80">
              Dump Intake
            </h2>
            <span className="inline-flex items-center rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-[0.15em] text-cyan-300">
              {selectedCategory.label}
            </span>
          </div>

          <form className="space-y-4" onSubmit={handleAnalyze}>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
                Analysis Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
              >
                {ANALYSIS_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">{selectedCategory.description}</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
                Memory Dump File
              </label>
              <div className="rounded-xl border-2 border-dashed border-cyan-500/40 bg-gray-800/40 px-4 py-6">
                <input
                  type="file"
                  accept=".mem,.dmp,.raw,.bin,.vmem,application/octet-stream"
                  onChange={handleFileSelection}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-900 hover:file:bg-cyan-300"
                />
                <p className="mt-3 text-xs text-gray-500">
                  Upload a binary memory dump for ML-driven anomaly and threat analysis.
                </p>
                {selectedFile ? (
                  <p className="mt-2 text-sm text-cyan-200">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="px-5 py-2.5 rounded-lg bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase text-xs hover:bg-cyan-300 transition-colors disabled:opacity-60"
            >
              {analyzing ? "Running Pipeline..." : "Run Memory Analysis"}
            </button>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            Reports / Analysis
          </h2>

          {!analysisReport ? (
            <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-5">
              <p className="text-sm text-gray-400">
                No analysis report yet. Upload a memory dump and run the pipeline to populate this section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm text-gray-100 font-medium">Analysis Summary</h3>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-widest font-mono ${tone.pill}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    {analysisReport.severity.level} ({analysisReport.severity.score}/100)
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-300 leading-relaxed">{analysisReport.rootCause}</p>
                <p className="mt-3 text-xs text-gray-500 font-mono">
                  File: {analysisReport.fileName} | Size: {formatFileSize(analysisReport.fileSizeBytes)} |
                  Processed: {formatTimestamp(analysisReport.analyzedAt)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-gray-400 font-mono mb-3">
                  Suspicious Processes
                </h3>
                {analysisReport.suspiciousProcesses.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No suspicious process signatures were detected in this dump sample.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-800">
                          <th className="py-2 pr-3 font-mono text-[11px] uppercase tracking-widest">
                            Process
                          </th>
                          <th className="py-2 pr-3 font-mono text-[11px] uppercase tracking-widest">PID</th>
                          <th className="py-2 font-mono text-[11px] uppercase tracking-widest">Reason Flagged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisReport.suspiciousProcesses.map((process, index) => (
                          <tr
                            key={`${process.processName}-${process.pid}-${index}`}
                            className="border-b border-gray-800/70"
                          >
                            <td className="py-2 pr-3 text-cyan-200">{process.processName}</td>
                            <td className="py-2 pr-3 text-gray-300">{process.pid}</td>
                            <td className="py-2 text-gray-300">{process.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-800/35 p-4">
                <h3 className="text-xs uppercase tracking-[0.2em] text-gray-400 font-mono mb-3">
                  Recommended Actions
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                  {analysisReport.recommendedActions.map((step, index) => (
                    <li key={`${step}-${index}`} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
