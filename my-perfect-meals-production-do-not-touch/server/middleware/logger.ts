import type { Request, Response, NextFunction } from "express";

export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const id = (req as any).id ?? "-";
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${id} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}