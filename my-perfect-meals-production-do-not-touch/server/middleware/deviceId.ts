import { Request, Response, NextFunction } from "express";

export function requireDeviceId(req: Request, res: Response, next: NextFunction) {
  const dev = (req.header("X-Device-Id") || "").trim();
  if (!dev) return res.status(400).json({ error: "Missing X-Device-Id header" });
  (req as any).deviceId = dev;
  next();
}