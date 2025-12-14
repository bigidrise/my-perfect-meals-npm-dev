import type { Request, Response, NextFunction } from "express";

export function normalizeFridgeRescue(req: Request, _res: Response, next: NextFunction) {
  // If client sent 'ingredients', lift it to 'fridgeItems'
  if (!req.body?.fridgeItems && Array.isArray(req.body?.ingredients)) {
    req.body.fridgeItems = req.body.ingredients;
    req.body._aliasUsed = "ingredients"; // optional flag for warnings/metrics
  }
  next();
}