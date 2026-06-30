import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

// GET /api/pro/training/launchpad-status
// Returns the completion state for each Professional Launchpad step
router.get("/launchpad-status", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const [user] = await db
      .select({
        onboardingCompletedAt: users.onboardingCompletedAt,
        procareTrainingCompleted: users.procareTrainingCompleted,
      })
      .from(users)
      .where(eq(users.id, userId));

    const certs = await db
      .select({
        certificationType: userCertifications.certificationType,
        completedAt: userCertifications.completedAt,
      })
      .from(userCertifications)
      .where(eq(userCertifications.userId, userId));

    const academyCompleted = certs.some(
      (c) =>
        (c.certificationType === "affiliate_coaching" ||
          c.certificationType === "platform") &&
        !!c.completedAt
    );

    return res.json({
      personalAccountActive: !!user?.onboardingCompletedAt,
      academyCompleted,
      procareTrainingCompleted: user?.procareTrainingCompleted || false,
    });
  } catch (err) {
    console.error("[ProTraining] launchpad-status error:", err);
    return res.status(500).json({ error: "Failed to load launchpad status" });
  }
});

// POST /api/pro/training/complete
// Marks Phase 2 ProCare Training as complete — unlocks the studio
router.post("/complete", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    await db
      .update(users)
      .set({ procareTrainingCompleted: true })
      .where(eq(users.id, userId));

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ProTraining] complete error:", err);
    return res.status(500).json({ error: "Failed to mark training complete" });
  }
});

export default router;
