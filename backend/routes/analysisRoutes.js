import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const MEMORY_ANALYSIS_CATEGORY = "Memory Analysis";

const PROCESS_SIGNATURES = [
  {
    processName: "powershell.exe",
    indicators: ["powershell", "encodedcommand", "-enc"],
    reason: "Encoded PowerShell execution pattern detected",
  },
  {
    processName: "cmd.exe",
    indicators: ["cmd.exe", " /c ", " /k "],
    reason: "Command shell execution chain identified",
  },
  {
    processName: "rundll32.exe",
    indicators: ["rundll32", ".dll"],
    reason: "Suspicious DLL execution pattern via rundll32",
  },
  {
    processName: "wmic.exe",
    indicators: ["wmic", "process call create"],
    reason: "WMI-based process creation activity detected",
  },
  {
    processName: "procdump.exe",
    indicators: ["procdump", "-ma", "lsass"],
    reason: "Potential credential dumping tooling observed",
  },
  {
    processName: "mimikatz.exe",
    indicators: ["mimikatz", "sekurlsa", "logonpasswords"],
    reason: "Credential theft signature matched",
  },
  {
    processName: "svchost.exe",
    indicators: ["svchost", "syn_sent", "beacon"],
    reason: "Possible beaconing from service host context",
  },
  {
    processName: "unknown_process",
    indicators: ["malfind", "page_execute_readwrite", "inject"],
    reason: "Memory injection indicators detected",
  },
];

const KEYWORD_SIGNALS = [
  { token: "lsass", weight: 18 },
  { token: "mimikatz", weight: 22 },
  { token: "sekurlsa", weight: 18 },
  { token: "procdump", weight: 14 },
  { token: "encodedcommand", weight: 14 },
  { token: "powershell", weight: 10 },
  { token: "rundll32", weight: 10 },
  { token: "inject", weight: 12 },
  { token: "malfind", weight: 16 },
  { token: "c2", weight: 12 },
  { token: "beacon", weight: 12 },
  { token: "syn_sent", weight: 8 },
  { token: "credential", weight: 10 },
  { token: "page_execute_readwrite", weight: 12 },
];

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

function extractPrintableStrings(buffer) {
  const sampleSize = Math.min(buffer.length, 8 * 1024 * 1024);
  const sample = buffer.subarray(0, sampleSize).toString("latin1");
  const matches = sample.match(/[\x20-\x7E]{4,}/g) || [];
  return matches.slice(0, 20000);
}

function calculateShannonEntropy(buffer) {
  if (!buffer.length) return 0;

  const frequencies = new Array(256).fill(0);

  for (const byte of buffer) {
    frequencies[byte] += 1;
  }

  let entropy = 0;

  for (const count of frequencies) {
    if (!count) continue;
    const probability = count / buffer.length;
    entropy -= probability * Math.log2(probability);
  }

  return Number(entropy.toFixed(3));
}

function extractPid(line) {
  const pidMatch =
    line.match(/\bpid(?:\s*[:=]\s*|\s+)(\d{2,6})\b/i) || line.match(/\b(\d{2,6})\b/);

  return pidMatch ? Number(pidMatch[1]) : "N/A";
}

function extractSuspiciousProcesses(printableStrings) {
  const suspiciousProcesses = [];
  const seen = new Set();

  for (const line of printableStrings) {
    const normalizedLine = line.toLowerCase();

    for (const signature of PROCESS_SIGNATURES) {
      const isMatch = signature.indicators.some((indicator) => normalizedLine.includes(indicator));

      if (!isMatch) continue;

      const pid = extractPid(line);
      const key = `${signature.processName}|${pid}|${signature.reason}`;

      if (seen.has(key)) continue;
      seen.add(key);

      suspiciousProcesses.push({
        processName: signature.processName,
        pid,
        reason: signature.reason,
      });

      if (suspiciousProcesses.length >= 12) {
        return suspiciousProcesses;
      }
    }
  }

  return suspiciousProcesses;
}

function computeSignalScore(corpus) {
  let score = 0;
  const matchedSignals = [];

  for (const signal of KEYWORD_SIGNALS) {
    if (!corpus.includes(signal.token)) continue;

    score += signal.weight;
    matchedSignals.push(signal.token);
  }

  return { score, matchedSignals };
}

function severityFromScore(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function inferRootCause({ corpus, matchedSignals, suspiciousProcesses, entropy }) {
  const hasSignal = (token) => corpus.includes(token) || matchedSignals.includes(token);

  if (hasSignal("lsass") || hasSignal("mimikatz") || hasSignal("sekurlsa") || hasSignal("procdump")) {
    return "Probable credential dumping behavior targeting LSASS memory structures.";
  }

  if (hasSignal("encodedcommand") || hasSignal("powershell") || hasSignal("-enc")) {
    return "Likely script-driven execution chain with encoded PowerShell payload staging.";
  }

  if (hasSignal("beacon") || hasSignal("c2") || hasSignal("syn_sent")) {
    return "Potential command-and-control beaconing from memory-resident process context.";
  }

  if (hasSignal("inject") || hasSignal("malfind") || hasSignal("page_execute_readwrite")) {
    return "Possible code injection activity with executable memory region anomalies.";
  }

  if (suspiciousProcesses.length > 0) {
    return "Anomalous process execution patterns indicate suspicious in-memory activity.";
  }

  if (entropy >= 7.7) {
    return "High-entropy memory regions suggest packed or obfuscated payload artifacts.";
  }

  return "Low-confidence anomaly profile; manual triage is recommended for confirmation.";
}

function buildRecommendedActions({ severityLevel, rootCause, corpus }) {
  const actions = [
    "Isolate the host from network access and preserve the current volatile state.",
    "Acquire and archive a full forensic memory image with chain-of-custody metadata.",
  ];

  if (rootCause.toLowerCase().includes("credential")) {
    actions.push("Reset and rotate potentially exposed credentials for the affected user and service accounts.");
  }

  if (corpus.includes("powershell") || corpus.includes("encodedcommand")) {
    actions.push("Decode and review PowerShell command lines and block malicious script hashes in EDR policies.");
  }

  if (corpus.includes("beacon") || corpus.includes("c2") || corpus.includes("syn_sent")) {
    actions.push("Block related IPs/domains at the network edge and search for beaconing across peer hosts.");
  }

  if (severityLevel === "High" || severityLevel === "Critical") {
    actions.push("Escalate to incident response and perform scope expansion on adjacent endpoints.");
  }

  actions.push("Validate remediation with a follow-up memory scan before returning the host to production.");

  return Array.from(new Set(actions));
}

function runMemoryAnalysisPipeline(fileBuffer, fileName) {
  const printableStrings = extractPrintableStrings(fileBuffer);
  const corpus = printableStrings.join("\n").toLowerCase();
  const suspiciousProcesses = extractSuspiciousProcesses(printableStrings);
  const entropy = calculateShannonEntropy(fileBuffer.subarray(0, Math.min(fileBuffer.length, 2 * 1024 * 1024)));
  const { score: signalScore, matchedSignals } = computeSignalScore(corpus);

  let threatScore = 12;
  threatScore += Math.min(42, suspiciousProcesses.length * 11);
  threatScore += signalScore;

  if (entropy >= 7.9) threatScore += 20;
  else if (entropy >= 7.5) threatScore += 12;
  else if (entropy >= 7.1) threatScore += 6;

  if (fileBuffer.length > 80 * 1024 * 1024) threatScore += 6;
  else if (fileBuffer.length > 40 * 1024 * 1024) threatScore += 3;

  threatScore = Math.max(0, Math.min(100, threatScore));

  const severityLevel = severityFromScore(threatScore);
  const rootCause = inferRootCause({
    corpus,
    matchedSignals,
    suspiciousProcesses,
    entropy,
  });

  const outputProcesses =
    suspiciousProcesses.length > 0
      ? suspiciousProcesses
      : threatScore >= 45
        ? [
            {
              processName: "unknown_process",
              pid: "N/A",
              reason: "General anomaly score exceeded baseline threshold",
            },
          ]
        : [];

  return {
    pipelineStages: [
      "ingest",
      "feature_extraction",
      "anomaly_scoring",
      "threat_classification",
      "remediation_planning",
    ],
    fileName,
    fileSizeBytes: fileBuffer.length,
    analyzedAt: new Date().toISOString(),
    rootCause,
    severity: {
      level: severityLevel,
      score: threatScore,
      entropy,
    },
    suspiciousProcesses: outputProcesses,
    recommendedActions: buildRecommendedActions({
      severityLevel,
      rootCause,
      corpus,
    }),
  };
}

router.post("/memory", requireAuth, rawDumpParser, (req, res) => {
  try {
    const category = String(req.query.category || MEMORY_ANALYSIS_CATEGORY).trim();

    if (category !== MEMORY_ANALYSIS_CATEGORY) {
      res.status(400).json({ message: `Unsupported category: ${category}` });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: "Upload a non-empty memory dump file" });
      return;
    }

    const fileName = safelyDecode(req.header("X-File-Name"));
    const report = runMemoryAnalysisPipeline(req.body, fileName);

    res.json({
      category: MEMORY_ANALYSIS_CATEGORY,
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Memory analysis failed" });
  }
});

export default router;
