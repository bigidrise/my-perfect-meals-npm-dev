import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const verificationUnavailable = {
  code: "APP_STORE_SERVER_VERIFICATION_REQUIRED",
  error:
    "Paid iOS access is temporarily unavailable until App Store Server API verification and signed transaction ownership validation are configured.",
};

router.post("/verify-purchase", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).authUser?.id as string | undefined;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // Security: the userId in the request body must match the authenticated session
    if (authUserId !== userId) {
      console.error(`[iOS Verify] Auth mismatch — auth: ${authUserId}, body: ${userId}`);
      return res.status(403).json({ error: "User ID does not match authenticated session" });
    }

    console.warn(`[iOS Verify] Rejected unverified client purchase claim for user ${userId}`);
    return res.status(503).json(verificationUnavailable);
  } catch (error: any) {
    console.error("[iOS Verify] Error:", error);
    return res.status(500).json({ error: error.message || "Verification failed" });
  }
});

router.post("/restore-purchases", requireAuth, async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).authUser?.id as string | undefined;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // Security: the userId in the request body must match the authenticated session
    if (authUserId !== userId) {
      console.error(`[iOS Restore] Auth mismatch — auth: ${authUserId}, body: ${userId}`);
      return res.status(403).json({ error: "User ID does not match authenticated session" });
    }

    console.warn(`[iOS Restore] Rejected unverified client restore claim for user ${userId}`);
    return res.status(503).json(verificationUnavailable);
  } catch (error: any) {
    console.error("[iOS Restore] Error:", error);
    return res.status(500).json({ error: error.message || "Restore failed" });
  }
});

export default router;
