import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import recordRoutes from "./routes/recordRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const frontendUrl = allowedOrigins[0] || "http://localhost:5173";
const apiBaseUrl = (process.env.PUBLIC_API_URL || `http://localhost:${port}/api`).replace(/\/+$/, "");
const healthUrl = apiBaseUrl.endsWith("/api") ? `${apiBaseUrl}/health` : `${apiBaseUrl}/api/health`;

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/analysis", analysisRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`ForensIQ API listening on port ${port}`);
      console.log(`Frontend: ${frontendUrl}`);
      console.log(`Login: ${frontendUrl}/login`);
      console.log(`Signup: ${frontendUrl}/signup`);
      console.log(`API Base: ${apiBaseUrl}`);
      console.log(`Health: ${healthUrl}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
