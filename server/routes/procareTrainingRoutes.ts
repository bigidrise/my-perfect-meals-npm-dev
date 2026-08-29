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
          c.certificationType === "platform" ||
          c.certificationType === "platform_mastery") &&
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

// The retired five-page experience cannot grant training or certification.
router.post("/complete", requireAuth, (_req, res) => {
  return res.status(410).json({
    error: "This training path has been retired. Complete the ProCare Certification course instead.",
    code: "PROCARE_LEGACY_TRAINING_RETIRED",
    route: "/certifications/procare_certification",
  });
});

export default router;
