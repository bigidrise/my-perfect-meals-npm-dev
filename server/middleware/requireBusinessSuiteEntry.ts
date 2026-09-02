import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { resolveBusinessSuiteEligibility } from "../services/businessSuiteEligibility";

export function getSelectedBusinessId(req: Request): string | null {
  const header = req.get("x-business-id");
  const query = typeof req.query.businessId === "string" ? req.query.businessId : null;
  return header || query;
}

export async function requireBusinessSuiteEntry(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthenticatedRequest).authUser?.id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }
  try {
    const eligibility = await resolveBusinessSuiteEligibility({
      userId,
      selectedBusinessId: getSelectedBusinessId(req),
    });
    if (!eligibility.canEnter) {
      res.status(403).json({
        error: "You do not have access to this Business organization.",
        code: eligibility.denialReason ?? "BUSINESS_ACCESS_DENIED",
      });
      return;
    }
    (req as any).businessSuiteEligibility = eligibility;
    next();
  } catch (error) {
    console.error("[requireBusinessSuiteEntry] error:", error);
    res.status(500).json({ error: "Server error." });
  }
}