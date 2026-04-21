# ForensIQ

Digital forensic web application with React frontend and Express + MongoDB backend.

## Stack
- Frontend: React (Vite), Tailwind CSS, React Router, Axios
- Backend: Node.js, Express, MongoDB (Mongoose), JWT auth

## Project Structure
- `frontend/` React app
- `backend/` API server
- `main.py` memory-forensics utility script (standalone)

## What Is Done
- Dockerized the development stack using Docker Compose (`frontend` + `backend` + `mongo`).
- Added dev Dockerfiles for frontend and backend.
- Added `.dockerignore` files for clean image builds.
- Added Docker env files for container-specific values.
- Enabled reliable hot reload in containers:
  - Backend uses `nodemon --legacy-watch`.
  - Frontend uses Vite on `0.0.0.0:5173` with polling enabled.
- Added startup link logging in backend console (frontend, login, signup, API, health).
- Configured backend host mapping as `5001:5000` to avoid common local conflicts on port `5000`.

## Run with Docker (Dev)
1. Install and start Docker Desktop.
2. Set `JWT_SECRET` in `backend/.env.docker`.
3. Start the full stack:

```bash
docker compose up --build -d
```

4. Open:
- Frontend: `http://localhost:5173`
- API Base: `http://localhost:5001/api`
- Health Check: `http://localhost:5001/api/health`

5. Stop containers:

```bash
docker compose down
```

6. Stop and reset MongoDB data:

```bash
docker compose down -v
```

## Useful Commands
```bash
# Run in background
docker compose up --build -d

# Follow logs
docker compose logs -f

# Follow only backend logs
docker compose logs -f backend
```
