#!/usr/bin/env python3
"""ForensIQ plugins stage: extraction and pattern detection.

Contract:
  Input arguments:
    --input-file <path>        Required. Path to memory dump file.
    --file-name <string>       Optional display filename from uploader.
    --output-json <path>       Optional. If provided, writes the same JSON envelope to disk.

  Output on stdout (JSON envelope):
    Success:
      {"status":"success","data":{...}}
    Error:
      {"status":"error","error":{"code":"...","message":"...","details":{...}}}
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

MEMORY_ANALYSIS_CATEGORY = "Memory Analysis"

PROCESS_SIGNATURES = [
    {
        "process_name": "powershell.exe",
        "indicators": ["powershell", "encodedcommand", "-enc"],
        "reason": "Encoded PowerShell execution pattern detected",
    },
    {
        "process_name": "cmd.exe",
        "indicators": ["cmd.exe", " /c ", " /k "],
        "reason": "Command shell execution chain identified",
    },
    {
        "process_name": "rundll32.exe",
        "indicators": ["rundll32", ".dll"],
        "reason": "Suspicious DLL execution pattern via rundll32",
    },
    {
        "process_name": "wmic.exe",
        "indicators": ["wmic", "process call create"],
        "reason": "WMI-based process creation activity detected",
    },
    {
        "process_name": "procdump.exe",
        "indicators": ["procdump", "-ma", "lsass"],
        "reason": "Potential credential dumping tooling observed",
    },
    {
        "process_name": "mimikatz.exe",
        "indicators": ["mimikatz", "sekurlsa", "logonpasswords"],
        "reason": "Credential theft signature matched",
    },
    {
        "process_name": "svchost.exe",
        "indicators": ["svchost", "syn_sent", "beacon"],
        "reason": "Possible beaconing from service host context",
    },
    {
        "process_name": "unknown_process",
        "indicators": ["malfind", "page_execute_readwrite", "inject"],
        "reason": "Memory injection indicators detected",
    },
]

KEYWORD_SIGNALS = [
    {"token": "lsass", "weight": 18},
    {"token": "mimikatz", "weight": 22},
    {"token": "sekurlsa", "weight": 18},
    {"token": "procdump", "weight": 14},
    {"token": "encodedcommand", "weight": 14},
    {"token": "powershell", "weight": 10},
    {"token": "rundll32", "weight": 10},
    {"token": "inject", "weight": 12},
    {"token": "malfind", "weight": 16},
    {"token": "c2", "weight": 12},
    {"token": "beacon", "weight": 12},
    {"token": "syn_sent", "weight": 8},
    {"token": "credential", "weight": 10},
    {"token": "page_execute_readwrite", "weight": 12},
]


def emit(payload: Dict[str, Any], output_path: str | None = None, exit_code: int = 0) -> None:
    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    if output_path:
        Path(output_path).write_text(serialized, encoding="utf-8")
    print(serialized)
    raise SystemExit(exit_code)


def emit_error(
    code: str, message: str, details: Dict[str, Any] | None = None, output_path: str | None = None
) -> None:
    payload = {
        "status": "error",
        "error": {"code": code, "message": message, "details": details or {}},
    }
    emit(payload, output_path=output_path, exit_code=1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ForensIQ extraction and pattern detection")
    parser.add_argument("--input-file", required=True, help="Path to uploaded dump file")
    parser.add_argument("--file-name", required=False, default="", help="Original filename metadata")
    parser.add_argument(
        "--output-json",
        required=False,
        default="",
        help="Optional path where the JSON envelope should also be written",
    )
    return parser.parse_args()


def extract_printable_strings(file_bytes: bytes) -> List[str]:
    sample_size = min(len(file_bytes), 8 * 1024 * 1024)
    sample = file_bytes[:sample_size].decode("latin1", errors="ignore")
    matches = re.findall(r"[\x20-\x7E]{4,}", sample)
    return matches[:20000]


def calculate_shannon_entropy(file_bytes: bytes) -> float:
    if not file_bytes:
        return 0.0

    sample = file_bytes[: min(len(file_bytes), 2 * 1024 * 1024)]
    frequencies = [0] * 256
    for byte in sample:
        frequencies[byte] += 1

    entropy = 0.0
    sample_len = len(sample)
    for count in frequencies:
        if count == 0:
            continue
        probability = count / sample_len
        entropy -= probability * math.log2(probability)
    return round(entropy, 3)


def extract_pid(line: str) -> int | str:
    explicit = re.search(r"\bpid(?:\s*[:=]\s*|\s+)(\d{2,6})\b", line, flags=re.IGNORECASE)
    if explicit:
        return int(explicit.group(1))
    fallback = re.search(r"\b(\d{2,6})\b", line)
    return int(fallback.group(1)) if fallback else "N/A"


def extract_suspicious_processes(printable_strings: List[str]) -> List[Dict[str, Any]]:
    suspicious_processes: List[Dict[str, Any]] = []
    seen = set()

    for line in printable_strings:
        normalized_line = line.lower()
        for signature in PROCESS_SIGNATURES:
            if not any(indicator in normalized_line for indicator in signature["indicators"]):
                continue

            pid = extract_pid(line)
            key = f"{signature['process_name']}|{pid}|{signature['reason']}"
            if key in seen:
                continue

            seen.add(key)
            suspicious_processes.append(
                {
                    "process_name": signature["process_name"],
                    "pid": pid,
                    "reason": signature["reason"],
                }
            )

            if len(suspicious_processes) >= 12:
                return suspicious_processes

    return suspicious_processes


def compute_signal_score(corpus: str) -> Dict[str, Any]:
    score = 0
    matched_signals: List[str] = []
    weighted_matches: List[Dict[str, Any]] = []

    for signal in KEYWORD_SIGNALS:
        if signal["token"] not in corpus:
            continue
        score += signal["weight"]
        matched_signals.append(signal["token"])
        weighted_matches.append({"token": signal["token"], "weight": signal["weight"]})

    return {"score": score, "matched_signals": matched_signals, "weighted_matches": weighted_matches}


def severity_from_score(score: int) -> str:
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 35:
        return "Medium"
    return "Low"


def infer_root_cause(
    corpus: str,
    matched_signals: List[str],
    suspicious_processes: List[Dict[str, Any]],
    entropy: float,
) -> str:
    def has_signal(token: str) -> bool:
        return token in corpus or token in matched_signals

    if has_signal("lsass") or has_signal("mimikatz") or has_signal("sekurlsa") or has_signal("procdump"):
        return "Probable credential dumping behavior targeting LSASS memory structures."

    if has_signal("encodedcommand") or has_signal("powershell") or has_signal("-enc"):
        return "Likely script-driven execution chain with encoded PowerShell payload staging."

    if has_signal("beacon") or has_signal("c2") or has_signal("syn_sent"):
        return "Potential command-and-control beaconing from memory-resident process context."

    if has_signal("inject") or has_signal("malfind") or has_signal("page_execute_readwrite"):
        return "Possible code injection activity with executable memory region anomalies."

    if suspicious_processes:
        return "Anomalous process execution patterns indicate suspicious in-memory activity."

    if entropy >= 7.7:
        return "High-entropy memory regions suggest packed or obfuscated payload artifacts."

    return "Low-confidence anomaly profile; manual triage is recommended for confirmation."


def build_recommended_actions(severity_level: str, root_cause: str, corpus: str) -> List[str]:
    actions = [
        "Isolate the host from network access and preserve the current volatile state.",
        "Acquire and archive a full forensic memory image with chain-of-custody metadata.",
    ]

    if "credential" in root_cause.lower():
        actions.append(
            "Reset and rotate potentially exposed credentials for the affected user and service accounts."
        )

    if "powershell" in corpus or "encodedcommand" in corpus:
        actions.append(
            "Decode and review PowerShell command lines and block malicious script hashes in EDR policies."
        )

    if "beacon" in corpus or "c2" in corpus or "syn_sent" in corpus:
        actions.append(
            "Block related IPs and domains at the network edge and hunt for beaconing across peer hosts."
        )

    if severity_level in ("High", "Critical"):
        actions.append("Escalate to incident response and perform scope expansion on adjacent endpoints.")

    actions.append("Validate remediation with a follow-up memory scan before returning the host to production.")
    return list(dict.fromkeys(actions))


def build_chart_datasets(
    threat_score: int,
    entropy: float,
    weighted_matches: List[Dict[str, Any]],
    suspicious_processes: List[Dict[str, Any]],
) -> Dict[str, Any]:
    process_counter = Counter([entry["process_name"] for entry in suspicious_processes])
    process_labels = list(process_counter.keys())
    process_values = [process_counter[label] for label in process_labels]

    match_labels = [entry["token"] for entry in weighted_matches]
    match_values = [entry["weight"] for entry in weighted_matches]

    return {
        "charts": [
            {
                "id": "threat_score_breakdown",
                "type": "bar",
                "title": "Threat Score",
                "description": "Overall score produced by extraction and pattern signals.",
                "labels": ["Threat Score", "Remaining"],
                "values": [threat_score, max(0, 100 - threat_score)],
            },
            {
                "id": "matched_signal_weights",
                "type": "bar",
                "title": "Matched Signal Weights",
                "description": "Keyword signals found in extracted printable strings.",
                "labels": match_labels if match_labels else ["No matched signals"],
                "values": match_values if match_values else [0],
            },
            {
                "id": "suspicious_process_frequency",
                "type": "bar",
                "title": "Suspicious Process Frequency",
                "description": "Frequency of suspicious process signatures detected in the sample.",
                "labels": process_labels if process_labels else ["No suspicious processes"],
                "values": process_values if process_values else [0],
            },
            {
                "id": "entropy_profile",
                "type": "bar",
                "title": "Entropy Profile",
                "description": "Entropy compared to baseline and high-risk threshold.",
                "labels": ["Observed", "Baseline", "High Risk Threshold"],
                "values": [round(entropy, 3), 6.8, 7.7],
            },
        ]
    }


def run_pipeline(input_path: Path, file_name: str) -> Dict[str, Any]:
    file_bytes = input_path.read_bytes()
    printable_strings = extract_printable_strings(file_bytes)
    corpus = "\n".join(printable_strings).lower()
    suspicious_processes = extract_suspicious_processes(printable_strings)
    entropy = calculate_shannon_entropy(file_bytes)
    signals = compute_signal_score(corpus)

    threat_score = 12
    threat_score += min(42, len(suspicious_processes) * 11)
    threat_score += signals["score"]

    if entropy >= 7.9:
        threat_score += 20
    elif entropy >= 7.5:
        threat_score += 12
    elif entropy >= 7.1:
        threat_score += 6

    if len(file_bytes) > 80 * 1024 * 1024:
        threat_score += 6
    elif len(file_bytes) > 40 * 1024 * 1024:
        threat_score += 3

    threat_score = max(0, min(100, int(round(threat_score))))
    severity_level = severity_from_score(threat_score)
    root_cause = infer_root_cause(corpus, signals["matched_signals"], suspicious_processes, entropy)

    if not suspicious_processes and threat_score >= 45:
        suspicious_processes = [
            {
                "process_name": "unknown_process",
                "pid": "N/A",
                "reason": "General anomaly score exceeded baseline threshold",
            }
        ]

    return {
        "category": MEMORY_ANALYSIS_CATEGORY,
        "pipeline_stages": ["ingest", "feature_extraction", "pattern_detection"],
        "file_name": file_name,
        "file_size_bytes": len(file_bytes),
        "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "entropy": entropy,
            "signal_score": signals["score"],
            "matched_signals": signals["matched_signals"],
        },
        "threat_score": threat_score,
        "severity_level": severity_level,
        "root_cause": root_cause,
        "suspicious_processes": suspicious_processes,
        "recommended_actions": build_recommended_actions(severity_level, root_cause, corpus),
        "chart_datasets": build_chart_datasets(
            threat_score, entropy, signals["weighted_matches"], suspicious_processes
        ),
    }


def main() -> None:
    args = parse_args()
    output_path = args.output_json or None

    try:
        input_path = Path(args.input_file)
        if not input_path.exists():
            emit_error(
                "PLUGIN_INPUT_NOT_FOUND",
                "Input file does not exist",
                {"input_file": str(input_path)},
                output_path=output_path,
            )

        if not input_path.is_file():
            emit_error(
                "PLUGIN_INPUT_INVALID",
                "Input path is not a file",
                {"input_file": str(input_path)},
                output_path=output_path,
            )

        file_name = args.file_name.strip() or input_path.name
        data = run_pipeline(input_path, file_name)
        emit({"status": "success", "data": data}, output_path=output_path, exit_code=0)
    except SystemExit:
        raise
    except Exception as exc:  # pragma: no cover - defensive error mapping
        emit_error(
            "PLUGIN_EXECUTION_ERROR",
            "Extraction and pattern detection failed",
            {"exception_type": exc.__class__.__name__, "exception_message": str(exc)},
            output_path=output_path,
        )


if __name__ == "__main__":
    main()
