# ForensIQ

Digital forensic web application with React frontend and Express + MongoDB backend.

## Stack
- Frontend: React (Vite), Tailwind CSS, React Router, Axios
- Backend: Node.js, Express, MongoDB (Mongoose), JWT auth

## Project Structure
- `frontend/` React app
- `backend/` API server
- `main.py` memory-forensics utility script (standalone)

## Run with Docker (Dev)
1. Install Docker Desktop.
2. Update Docker env files if needed:
   - `backend/.env.docker` (set `JWT_SECRET`)
   - `frontend/.env.docker` (default API URL is already set)
3. Start the full stack:

```bash
docker compose up --build
```

4. Stop containers:

```bash
docker compose down
```

5. Stop and reset MongoDB data:

```bash
docker compose down -v
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:5000`  
Health check: `http://localhost:5000/api/health`
