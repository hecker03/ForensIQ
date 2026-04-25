import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import AnalysisOutput from "../models/AnalysisOutput.js";
import { attachAuthIfPresent, requireAuth } from "../middleware/auth.js";
import { executePythonMemoryPipeline } from "../services/pythonPipeline.js";

const router = express.Router();

const MEMORY_ANALYSIS_CATEGORY = "Memory Analysis";
const MAX_HISTORY_LIMIT = 50;
const DEFAULT_HISTORY_LIMIT = 10;

const rawDumpParser = express.raw({
  type: "application/octet-stream",
  limit: "100mb",
});

function safelyDecode(value) {
  if (!value) return "memory-dump.bin";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeFileName(input) {
  const decoded = safelyDecode(input).trim();
  const fallback = "memory-dump.bin";
  const baseName = path.basename(decoded || fallback);
  const normalized = baseName.replace(/[^\w.\-+]/g, "_");
  return normalized || fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function createPipelineErrorResponse(error) {
  const details = {
    code: error?.code || "PIPELINE_EXECUTION_ERROR",
    stage: error?.stage || "unknown",
    message: error?.message || "Pipeline execution failed",
    details: error?.details || {},
  };

  return {
    category: MEMORY_ANALYSIS_CATEGORY,
    status: "error",
    message: "Memory analysis pipeline failed",
    error: details,
  };
}

async function persistAnalysisOutput(payload) {
  try {
    const createdRecord = await AnalysisOutput.create(payload);
    return {
      saved: true,
      id: createdRecord._id.toString(),
    };
  } catch (error) {
    console.error("Failed to persist AnalysisOutput", error);
    return {
      saved: false,
      id: null,
      errorCode: "PERSISTENCE_WRITE_FAILED",
      errorMessage: error?.message || "Unable to save analysis output",
    };
  }
}

async function writeDumpToTempFile(fileBuffer, fileName) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "forensiq-upload-"));
  const tempFilePath = path.join(tempDir, fileName);
  await fs.writeFile(tempFilePath, fileBuffer);
  return { tempDir, tempFilePath };
}

function mapHistoryRecord(record) {
  return {
    id: record._id.toString(),
    createdAt: record.created_at,
    filename: record.filename,
    fileSize: record.file_size,
    fileHash: record.file_hash,
    status: record.status,
    errorMessage: record.error_message,
    durationMs: record.duration_ms,
    report: record.result_payload,
    chartDatasets: record.chart_datasets || null,
  };
}

router.post("/memory", attachAuthIfPresent, rawDumpParser, async (req, res) => {
  const category = String(req.query.category || MEMORY_ANALYSIS_CATEGORY).trim();

  if (category !== MEMORY_ANALYSIS_CATEGORY) {
    res.status(400).json({ message: `Unsupported category: ${category}` });
    return;
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ message: "Upload a non-empty memory dump file" });
    return;
  }

  const fileName = sanitizeFileName(req.header("X-File-Name"));
  const fileSizeBytes = req.body.length;
  const fileHash = crypto.createHash("sha256").update(req.body).digest("hex");
  const requestStartedAt = Date.now();

  let tempDir = null;

  try {
    const tempFileContext = await writeDumpToTempFile(req.body, fileName);
    tempDir = tempFileContext.tempDir;

    const pipelineResult = await executePythonMemoryPipeline({
      filePath: tempFileContext.tempFilePath,
      fileName,
      fileSizeBytes,
    });

    const durationMs = pipelineResult.durationMs || Date.now() - requestStartedAt;

    if (!pipelineResult.ok) {
      const errorResponse = createPipelineErrorResponse(pipelineResult.error);
      const persistence = await persistAnalysisOutput({
        user: req.userId || null,
        filename: fileName,
        file_size: fileSizeBytes,
        file_hash: fileHash,
        result_payload: errorResponse,
        chart_datasets: null,
        status: "error",
        error_message: errorResponse.error.message,
        duration_ms: durationMs,
      });

      if (!persistence.saved) {
        errorResponse.persistence = {
          saved: false,
          errorCode: persistence.errorCode,
        };
      }

      res.status(500).json(errorResponse);
      return;
    }

    const responsePayload = {
      category: MEMORY_ANALYSIS_CATEGORY,
      status: "success",
      report: pipelineResult.report,
    };

    if (pipelineResult.chartDatasets) {
      responsePayload.chartDatasets = pipelineResult.chartDatasets;
    }

    const persistence = await persistAnalysisOutput({
      user: req.userId || null,
      filename: fileName,
      file_size: fileSizeBytes,
      file_hash: fileHash,
      result_payload: pipelineResult.report,
      chart_datasets: pipelineResult.chartDatasets || null,
      status: "success",
      error_message: null,
      duration_ms: durationMs,
    });

    if (persistence.saved) {
      responsePayload.analysisId = persistence.id;
    } else {
      responsePayload.persistence = {
        saved: false,
        errorCode: persistence.errorCode,
      };
    }

    res.json(responsePayload);
  } catch (error) {
    console.error("Unexpected memory analysis failure", error);

    const fallbackError = {
      category: MEMORY_ANALYSIS_CATEGORY,
      status: "error",
      message: "Memory analysis pipeline failed",
      error: {
        code: "ANALYSIS_ROUTE_EXCEPTION",
        stage: "route",
        message: "Unexpected exception while processing memory analysis",
        details: {
          reason: error?.message || "Unknown error",
        },
      },
    };

    const persistence = await persistAnalysisOutput({
      user: req.userId || null,
      filename: fileName,
      file_size: fileSizeBytes,
      file_hash: fileHash,
      result_payload: fallbackError,
      chart_datasets: null,
      status: "error",
      error_message: fallbackError.error.message,
      duration_ms: Date.now() - requestStartedAt,
    });

    if (!persistence.saved) {
      fallbackError.persistence = {
        saved: false,
        errorCode: persistence.errorCode,
      };
    }

    res.status(500).json(fallbackError);
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const requestedLimit = parsePositiveInt(req.query.limit, DEFAULT_HISTORY_LIMIT);
    const limit = Math.min(requestedLimit, MAX_HISTORY_LIMIT);
    const skip = (page - 1) * limit;

    const query = { user: req.userId };
    const [total, records] = await Promise.all([
      AnalysisOutput.countDocuments(query),
      AnalysisOutput.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      results: records.map(mapHistoryRecord),
    });
  } catch (error) {
    console.error("Unable to fetch analysis history", error);
    res.status(500).json({
      message: "Unable to fetch analysis history",
      error: {
        code: "ANALYSIS_HISTORY_FAILED",
        details: {
          reason: error?.message || "Unknown error",
        },
      },
    });
  }
});

export default router;
