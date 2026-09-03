import type { Request, Response, NextFunction } from "express";
import { captureException } from "../lib/sentry";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const id = (req as any).id ?? "-";
  const code = err.status ?? 500;
  console.error("ERR", id, code, err?.message ?? err);

  // Report server errors (5xx) to Sentry — skip expected client errors (4xx)
  if (code >= 500) {
    captureException(err, {
      requestId: id,
      method: req.method,
      path: req.path,
      statusCode: code,
    });
  }

  res.status(code).json({ error: err?.message ?? "Internal error", requestId: id });
}
