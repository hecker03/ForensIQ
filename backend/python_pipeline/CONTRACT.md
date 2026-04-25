# Python Pipeline Contract

This directory is the canonical Python pipeline location used by the backend.

## Stage 1: `plugins.py`

Purpose: extraction and pattern detection from uploaded dump bytes.

### Inputs

Run command:

```bash
python3 plugins.py --input-file <absolute_or_relative_path> --file-name <original_name> --output-json <path>
```

Arguments:

- `--input-file` (required): filesystem path to the uploaded dump file.
- `--file-name` (optional): original filename metadata from the client.
- `--output-json` (optional): path where the script writes the same JSON envelope sent to stdout.

### Output schema (stdout JSON)

Success:

```json
{
  "status": "success",
  "data": {
    "category": "Memory Analysis",
    "pipeline_stages": ["ingest", "feature_extraction", "pattern_detection"],
    "file_name": "sample.dmp",
    "file_size_bytes": 1048576,
    "analysis_timestamp": "2026-04-25T00:00:00+00:00",
    "metrics": {
      "entropy": 7.321,
      "signal_score": 42,
      "matched_signals": ["powershell", "encodedcommand"]
    },
    "threat_score": 67,
    "severity_level": "High",
    "root_cause": "Likely script-driven execution chain with encoded PowerShell payload staging.",
    "suspicious_processes": [
      {
        "process_name": "powershell.exe",
        "pid": 1234,
        "reason": "Encoded PowerShell execution pattern detected"
      }
    ],
    "recommended_actions": ["..."],
    "chart_datasets": {
      "charts": [
        {
          "id": "threat_score_breakdown",
          "type": "bar",
          "title": "Threat Score",
          "description": "Overall score produced by extraction and pattern signals.",
          "labels": ["Threat Score", "Remaining"],
          "values": [67, 33]
        }
      ]
    }
  }
}
```

Error:

```json
{
  "status": "error",
  "error": {
    "code": "PLUGIN_EXECUTION_ERROR",
    "message": "Extraction and pattern detection failed",
    "details": {}
  }
}
```

## Stage 2: `train.py`

Purpose: train/predict interface. Backend uses `predict`.

### Inputs

Run command:

```bash
python3 train.py predict --plugin-output-file <path> --file-name <original_name>
```

Arguments:

- `predict` command:
  - `--plugin-output-file` (required): JSON output path produced by `plugins.py`.
  - `--file-name` (optional): original filename metadata from the client.
- `train` command:
  - `--dataset-file` (optional): dataset metadata source for model bookkeeping.

### Output schema (stdout JSON)

Success:

```json
{
  "status": "success",
  "data": {
    "pipeline_stages": ["prediction"],
    "file_name": "sample.dmp",
    "prediction": {
      "label": "Malicious",
      "confidence": 0.87,
      "risk_score": 87,
      "model_version": "heuristic-logistic-v1",
      "primary_reason": "Extraction stage threat score is elevated.",
      "rationale": ["..."]
    },
    "recommended_actions": ["..."],
    "chart_datasets": {
      "charts": [
        {
          "id": "prediction_probability",
          "type": "bar",
          "title": "Prediction Probability",
          "description": "Probability split produced by train.py prediction stage.",
          "labels": ["Malicious Probability", "Benign Probability"],
          "values": [87.0, 13.0]
        }
      ]
    }
  }
}
```

Error:

```json
{
  "status": "error",
  "error": {
    "code": "TRAIN_EXECUTION_ERROR",
    "message": "Prediction stage failed",
    "details": {}
  }
}
```

## Determinism rules

- Scripts print exactly one JSON envelope to stdout.
- Failure uses non-zero exit code and the `status: "error"` envelope.
- Backend treats this contract as authoritative and maps failures to structured API errors.
