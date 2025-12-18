// server/routes/assistant-health.ts
import { Router } from "express";

const r = Router();

// Health check for avatar pipeline
r.get("/health", (req, res) => {
  const flags = {
    AVATAR_PIPELINE_ENABLED: process.env.AVATAR_PIPELINE_ENABLED === "true",
    AVATAR_PIPELINE_USERS: (process.env.AVATAR_PIPELINE_USERS || "").split(",").filter(Boolean),
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  };

  const status = {
    timestamp: new Date().toISOString(),
    flags,
    status: "ok"
  };

  res.json(status);
});

// Simple log viewer for intent/tool telemetry
let logs: any[] = [];

r.post("/log", (req, res) => {
  const { userId, intent, toolsUsed, navigateTo, error } = req.body;
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    intent,
    toolsUsed,
    hasNavigateTo: !!navigateTo,
    error: error || null
  };
  
  logs.push(logEntry);
  // Keep last 100 entries
  if (logs.length > 100) logs = logs.slice(-100);
  
  res.json({ logged: true });
});

r.get("/logs", (req, res) => {
  res.json({ logs: logs.slice(-20) }); // Last 20 entries
});

export default r;