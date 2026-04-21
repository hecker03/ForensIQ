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
- Added production Dockerfiles for AWS deployment.
- Added Amplify build config for the frontend.
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

## AWS / Amplify Deployment

### Frontend on Amplify
1. Connect the repo to AWS Amplify.
2. Use the root [amplify.yml](amplify.yml) build spec.
3. Set a frontend environment variable in Amplify:
  - `VITE_API_URL=https://your-backend-domain/api`
4. Add a single-page-app rewrite rule in Amplify so React Router routes like `/login` and `/dashboard` resolve to `index.html`.

### Backend on AWS
The backend is ready to run as a container with [backend/Dockerfile](backend/Dockerfile).

Set these environment variables in your AWS runtime:
- `PORT=5000`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `CLIENT_ORIGIN=https://your-amplify-domain.amplifyapp.com`
- `PUBLIC_API_URL=https://your-backend-domain/api`

### Build locally for production
Frontend:
```bash
cd frontend
npm ci
npm run build
```

Backend container image:
```bash
docker build -t forensiq-backend -f backend/Dockerfile backend
```
