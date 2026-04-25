# ForensIQ

Full-stack digital forensics application with:

- React frontend (`frontend/`)
- Express + MongoDB backend (`backend/`)
- Python dump-analysis pipeline (`backend/python_pipeline/`)

## End-to-End Flow

1. User uploads a dump file from the dashboard.
2. Backend writes upload bytes to a short-lived temp file.
3. Backend runs `plugins.py` (extraction + pattern detection).
4. Backend runs `train.py` (predict stage).
5. Backend normalizes outputs into one API response.
6. Backend persists normalized outputs to `AnalysisOutput`.
7. Backend returns the normalized response to frontend.
8. Dashboard renders report + optional charts.
9. Analytics page shows persisted history + richer visualizations.

## Data Handling Rules

- Raw dump files are never stored in MongoDB.
- Raw extracted memory contents are never persisted.
- Only normalized outputs are stored.
- Local browser snapshot (`operatorSnapshot`) is UX-only and not authoritative.

## Canonical Python Source Location

Canonical runtime location:

- `backend/python_pipeline/plugins.py`
- `backend/python_pipeline/train.py`

Legacy duplicate folder `Forensiq/` was removed to avoid case-sensitive source duplication.

Root-level `plugins.py` and `train.py` now redirect to the canonical backend pipeline.

## Python Script Contract

See full contract:

- `backend/python_pipeline/CONTRACT.md`

Quick summary:

- `plugins.py` input: `--input-file`, optional metadata (`--file-name`), optional `--output-json`
- `plugins.py` output: single JSON envelope to stdout (`status: success|error`)
- `train.py predict` input: `--plugin-output-file`, optional `--file-name`
- `train.py` output: single JSON envelope to stdout (`status: success|error`)

## Backend Model: `AnalysisOutput`

File: `backend/models/AnalysisOutput.js`

Fields:

- `user`: `ObjectId | null`
- `created_at`: `Date` (required)
- `filename`: `String` (required)
- `file_size`: `Number` bytes (required)
- `file_hash`: `String | null` (SHA-256)
- `result_payload`: `JSON` (required normalized report only)
- `chart_datasets`: `JSON | null`
- `status`: enum `success | error`
- `error_message`: `String | null`
- `duration_ms`: `Number | null`

Index:

- compound index on `{ user: 1, created_at: -1 }`

## Migration

Migration script:

- `backend/migrations/20260425_create_analysis_output.js`

Run:

```bash
cd backend
npm run migrate:analysis-output
```

## API Endpoints

### `POST /api/analysis/memory`

- Auth: optional (`Bearer` token if available)
- Content-Type: `application/octet-stream`
- Headers:
  - `X-File-Name`: URL-encoded filename
- Query:
  - `category=Memory%20Analysis`

Success response:

```json
{
  "category": "Memory Analysis",
  "status": "success",
  "report": {
    "pipelineStages": ["..."],
    "fileName": "sample.dmp",
    "fileSizeBytes": 1234,
    "analyzedAt": "2026-04-25T00:00:00.000Z",
    "rootCause": "...",
    "severity": { "level": "High", "score": 72, "entropy": 7.31 },
    "suspiciousProcesses": [],
    "recommendedActions": []
  },
  "chartDatasets": { "version": 1, "charts": [] },
  "analysisId": "..."
}
```

Error response is deterministic and structured:

```json
{
  "category": "Memory Analysis",
  "status": "error",
  "message": "Memory analysis pipeline failed",
  "error": {
    "code": "SCRIPT_TIMEOUT",
    "stage": "plugins",
    "message": "plugins.py timed out",
    "details": {}
  }
}
```

Persistence failure behavior:

- The API still returns computed result/error payload.
- Persistence issues are logged server-side and surfaced only as additive metadata.

### `GET /api/analysis/history?page=1&limit=10`

- Auth: required (`Bearer` token)
- Unauthenticated response: `401 Unauthorized`

Response:

```json
{
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5,
  "results": [
    {
      "id": "...",
      "createdAt": "2026-04-25T00:00:00.000Z",
      "filename": "sample.dmp",
      "fileSize": 1234,
      "fileHash": "...",
      "status": "success",
      "errorMessage": null,
      "durationMs": 1900,
      "report": { "...": "..." },
      "chartDatasets": { "...": "..." }
    }
  ]
}
```

## Backward Compatibility Notes

- Existing dashboard response fields were kept:
  - `category`
  - `report`
  - report members (`pipelineStages`, `fileName`, `fileSizeBytes`, `analyzedAt`, `rootCause`, `severity`, `suspiciousProcesses`, `recommendedActions`)
- Added fields are additive and optional:
  - `status`
  - `chartDatasets`
  - `analysisId`
  - `persistence` (only when save fails)
- `InputRecord` model remains unchanged.

## Frontend Behavior

- Dashboard upload/report UX remains intact.
- Dashboard renders chart visuals only when `chartDatasets` is present.
- If `chartDatasets` is absent, no chart container is rendered.
- Analytics page (`/analytics`):
  - authenticated users: paginated persisted history + chart views
  - unauthenticated users: login/signup prompt (no history data shown)

## Environment Variables

Backend:

- `PORT` (example: `5000`)
- `MONGODB_URI` (example: `mongodb://127.0.0.1:27017/forensiq`)
- `JWT_SECRET` (example: `replace-with-a-strong-secret`)
- `CLIENT_ORIGIN` (example: `http://localhost:5173`)
- `PUBLIC_API_URL` (example: `http://localhost:5001/api`)
- `PYTHON_EXECUTABLE` (example: `python3`)
- `PYTHON_PIPELINE_DIR` (example: `/app/python_pipeline` in Docker, `./python_pipeline` local backend)
- `PYTHON_SCRIPT_TIMEOUT_MS` (example: `120000`)

Frontend:

- `VITE_API_URL` (example: `http://localhost:5001/api`)

## Docker

### Backend Production Image

- Base image: `node:bookworm-slim`
- Python install: minimal runtime (`python3`) only
- No Python dev toolchain in production image
- Dockerfile: `backend/Dockerfile`

### Backend Development Image

- Base image: `node:bookworm`
- Full Python toolchain installed (`python3`, `pip`, `venv`, headers, build/debug tools)
- Dev extras from `backend/python_pipeline/requirements-dev.txt`
- Dockerfile: `backend/Dockerfile.dev`

### Cache-friendly Layering

Both backend Dockerfiles install OS + Node dependencies before copying source files to preserve cache reuse.

## Local Development (Docker Compose)

Start:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Reset DB volume:

```bash
docker compose down -v
```

Access:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api`
- Health: `http://localhost:5001/api/health`

## Render Deployment Notes

### Backend (Render Web Service)

- Build command:
  - `docker build -f backend/Dockerfile -t forensiq-backend backend`
- Start command (inside container):
  - `npm start`
- Required env vars:
  - `PORT`
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `CLIENT_ORIGIN`
  - `PUBLIC_API_URL`
  - `PYTHON_EXECUTABLE` (default `python3`)
  - `PYTHON_PIPELINE_DIR` (default `/app/python_pipeline`)
  - `PYTHON_SCRIPT_TIMEOUT_MS`

### Frontend

- Continue using existing frontend build/deploy flow.
- Set `VITE_API_URL` to deployed backend `/api` URL.
