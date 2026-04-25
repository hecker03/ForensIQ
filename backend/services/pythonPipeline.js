import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 120000;

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function severityFromScore(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function dedupeStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeProcesses(rawProcesses) {
  if (!Array.isArray(rawProcesses)) return [];

  return rawProcesses
    .map((entry) => ({
      processName: String(entry?.process_name || entry?.processName || "unknown_process"),
      pid: entry?.pid ?? "N/A",
      reason: String(entry?.reason || "Suspicious behavior detected"),
    }))
    .slice(0, 20);
}

function normalizeChartDatasets(pluginsData, trainData) {
  const pluginCharts = Array.isArray(pluginsData?.chart_datasets?.charts)
    ? pluginsData.chart_datasets.charts
    : [];
  const trainCharts = Array.isArray(trainData?.chart_datasets?.charts)
    ? trainData.chart_datasets.charts
    : [];

  const charts = [...pluginCharts, ...trainCharts].filter(
    (chart) =>
      chart &&
      typeof chart === "object" &&
      typeof chart.id === "string" &&
      typeof chart.title === "string" &&
      Array.isArray(chart.labels) &&
      Array.isArray(chart.values),
  );

  if (charts.length === 0) {
    return null;
  }

  return {
    version: 1,
    charts,
  };
}

function createScriptError({ code, stage, message, details = {} }) {
  return {
    code,
    stage,
    message,
    details,
  };
}

function parseTimeoutMs(rawValue) {
  const parsed = Number.parseInt(rawValue || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

function getPythonExecutable() {
  return process.env.PYTHON_EXECUTABLE || "python3";
}

function getPipelineDir() {
  const configuredDir = process.env.PYTHON_PIPELINE_DIR;
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  return path.resolve(process.cwd(), "python_pipeline");
}

async function ensureScriptExists(scriptName) {
  const scriptPath = path.join(getPipelineDir(), scriptName);
  await fs.access(scriptPath);
  return scriptPath;
}

function parseJsonOutput(stdout) {
  const trimmed = String(stdout || "").trim();

  if (!trimmed) {
    return null;
  }

  return JSON.parse(trimmed);
}

async function runPythonScript({ stage, scriptName, args = [] }) {
  let scriptPath;

  try {
    scriptPath = await ensureScriptExists(scriptName);
  } catch {
    return {
      ok: false,
      error: createScriptError({
        code: "SCRIPT_NOT_FOUND",
        stage,
        message: `${scriptName} is not available`,
        details: {
          scriptName,
          pipelineDir: getPipelineDir(),
        },
      }),
    };
  }

  const timeoutMs = parseTimeoutMs(process.env.PYTHON_SCRIPT_TIMEOUT_MS);
  const pythonExecutable = getPythonExecutable();

  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let launchError = null;

    const child = spawn(pythonExecutable, [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      launchError = error;
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeoutId);

      const durationMs = Date.now() - start;
      const trimmedStderr = stderr.trim();
      const stderrPreview = trimmedStderr.slice(0, 2000);

      if (timedOut) {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_TIMEOUT",
            stage,
            message: `${scriptName} timed out`,
            details: { timeoutMs },
          }),
          durationMs,
        });
        return;
      }

      if (launchError) {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_LAUNCH_FAILED",
            stage,
            message: `Failed to start ${scriptName}`,
            details: {
              reason: launchError.message,
            },
          }),
          durationMs,
        });
        return;
      }

      let parsedOutput = null;

      try {
        parsedOutput = parseJsonOutput(stdout);
      } catch {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_INVALID_JSON",
            stage,
            message: `${scriptName} returned invalid JSON`,
            details: {
              exitCode,
              signal,
              stderr: stderrPreview || null,
              stdoutPreview: String(stdout).trim().slice(0, 2000),
            },
          }),
          durationMs,
        });
        return;
      }

      if (!parsedOutput) {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_EMPTY_OUTPUT",
            stage,
            message: `${scriptName} did not return output`,
            details: {
              exitCode,
              signal,
              stderr: stderrPreview || null,
            },
          }),
          durationMs,
        });
        return;
      }

      if (parsedOutput.status === "error") {
        resolve({
          ok: false,
          error: createScriptError({
            code: parsedOutput?.error?.code || "SCRIPT_EXECUTION_ERROR",
            stage,
            message: parsedOutput?.error?.message || `${scriptName} failed`,
            details: {
              ...parsedOutput?.error?.details,
              exitCode,
              signal,
              stderr: stderrPreview || null,
            },
          }),
          durationMs,
        });
        return;
      }

      if (exitCode !== 0) {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_NONZERO_EXIT",
            stage,
            message: `${scriptName} exited with code ${exitCode}`,
            details: {
              exitCode,
              signal,
              stderr: stderrPreview || null,
            },
          }),
          durationMs,
        });
        return;
      }

      if (parsedOutput.status !== "success" || typeof parsedOutput.data !== "object") {
        resolve({
          ok: false,
          error: createScriptError({
            code: "SCRIPT_INVALID_RESPONSE",
            stage,
            message: `${scriptName} returned an unexpected payload`,
            details: {
              exitCode,
              signal,
            },
          }),
          durationMs,
        });
        return;
      }

      resolve({
        ok: true,
        data: parsedOutput.data,
        durationMs,
      });
    });
  });
}

function buildNormalizedReport({ fileName, fileSizeBytes, pluginsData, trainData }) {
  const threatScore = clampScore(
    pluginsData?.threat_score ?? trainData?.prediction?.risk_score ?? 0,
  );

  const severityLevel =
    String(pluginsData?.severity_level || "").trim() || severityFromScore(threatScore);

  const entropy = Number(pluginsData?.metrics?.entropy);
  const suspiciousProcesses = normalizeProcesses(pluginsData?.suspicious_processes);
  const recommendedActions = dedupeStrings([
    ...(pluginsData?.recommended_actions || []),
    ...(trainData?.recommended_actions || []),
  ]);

  const pipelineStages = dedupeStrings([
    ...(pluginsData?.pipeline_stages || []),
    ...(trainData?.pipeline_stages || []),
  ]);

  const rootCause =
    String(pluginsData?.root_cause || "").trim() ||
    String(trainData?.prediction?.primary_reason || "").trim() ||
    "Low-confidence anomaly profile; manual triage is recommended for confirmation.";

  const predictionPayload =
    trainData?.prediction && typeof trainData.prediction === "object"
      ? {
          label: String(trainData.prediction.label || "Unknown"),
          confidence: Number(trainData.prediction.confidence || 0),
          riskScore: clampScore(trainData.prediction.risk_score ?? threatScore),
          modelVersion: String(trainData.prediction.model_version || "n/a"),
          rationale: Array.isArray(trainData.prediction.rationale)
            ? trainData.prediction.rationale.map((item) => String(item)).slice(0, 8)
            : [],
        }
      : undefined;

  const report = {
    pipelineStages:
      pipelineStages.length > 0
        ? pipelineStages
        : [
            "ingest",
            "feature_extraction",
            "pattern_detection",
            "prediction",
            "remediation_planning",
          ],
    fileName,
    fileSizeBytes,
    analyzedAt: new Date().toISOString(),
    rootCause,
    severity: {
      level: severityLevel,
      score: threatScore,
      entropy: Number.isFinite(entropy) ? Number(entropy.toFixed(3)) : 0,
    },
    suspiciousProcesses,
    recommendedActions,
  };

  if (predictionPayload) {
    report.prediction = predictionPayload;
  }

  return report;
}

export async function executePythonMemoryPipeline({ filePath, fileName, fileSizeBytes }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "forensiq-pipeline-"));
  const pluginOutputPath = path.join(tempDir, "plugins_output.json");

  try {
    const pluginsResult = await runPythonScript({
      stage: "plugins",
      scriptName: "plugins.py",
      args: ["--input-file", filePath, "--file-name", fileName, "--output-json", pluginOutputPath],
    });

    if (!pluginsResult.ok) {
      return {
        ok: false,
        error: pluginsResult.error,
        durationMs: pluginsResult.durationMs,
      };
    }

    const trainResult = await runPythonScript({
      stage: "train",
      scriptName: "train.py",
      args: ["predict", "--plugin-output-file", pluginOutputPath, "--file-name", fileName],
    });

    const totalDurationMs = (pluginsResult.durationMs || 0) + (trainResult.durationMs || 0);

    if (!trainResult.ok) {
      return {
        ok: false,
        error: trainResult.error,
        durationMs: totalDurationMs,
      };
    }

    const report = buildNormalizedReport({
      fileName,
      fileSizeBytes,
      pluginsData: pluginsResult.data,
      trainData: trainResult.data,
    });

    const chartDatasets = normalizeChartDatasets(pluginsResult.data, trainResult.data);

    return {
      ok: true,
      report,
      chartDatasets,
      durationMs: totalDurationMs,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
