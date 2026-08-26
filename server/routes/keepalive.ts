
import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();
const startTime = Date.now();

// Keep-alive endpoint for deployment warming
router.get("/keepalive", (req, res) => {
  const memory = process.memoryUsage();
  res.json({ 
    status: "alive", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
    },
    bootTime: Date.now() - startTime
  });
});

// Ultra-fast health check for external monitoring
router.get("/ping", (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.send("pong");
});

// Warmup endpoint for immediate response
router.get("/warmup", (req, res) => {
  res.json({ 
    warm: true, 
    ready: Date.now(),
    version: process.env.NODE_ENV || "development"
  });
});

// This is deliberately not a general keepalive. The only accepted activity is
// an authenticated clinical Studio recording, and the client starts/stops the
// request loop with the recorder lifecycle.
router.post("/session/activity", requireAuth, (req, res) => {
  const activity = req.body?.activity;
  if (activity !== "studio_video_recording") {
    res.status(400).json({ error: "Unsupported session activity" });
    return;
  }

  const authUser = (req as AuthenticatedRequest).authUser;
  const isClinical =
    authUser.role === "coach" ||
    authUser.role === "admin" ||
    authUser.professionalRole === "trainer" ||
    authUser.professionalRole === "physician" ||
    authUser.professionalRole === "dietitian" ||
    authUser.professionalRole === "nurse_practitioner";

  if (!isClinical) {
    res.status(403).json({ error: "This session activity is limited to clinical Studio recording" });
    return;
  }

  res.json({ ok: true, activity });
});

export default router;
