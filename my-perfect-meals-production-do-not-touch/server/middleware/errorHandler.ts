import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const id = (req as any).id ?? "-";
  const code = err.status ?? 500;
  console.error("ERR", id, code, err?.message ?? err);
  res.status(code).json({ error: err?.message ?? "Internal error", requestId: id });
}