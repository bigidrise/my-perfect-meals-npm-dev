
import { Router } from "express";

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

export default router;
