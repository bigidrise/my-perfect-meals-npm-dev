import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { userCertifications } from "../db/schema/certifications";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireMfa } from "../middleware/requireMfa";
import { ensureProviderStudioReady, getProviderStudioReadiness } from "../services/procareStudioReadiness";

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

// POST /api/pro/training/complete
// Marks Phase 2 ProCare Training as complete — unlocks the studio.
// Writes to both users.procareTrainingCompleted (fast flag) and
// userCertifications (so ProLaunchpad's cert-progress check resolves correctly).
router.post("/complete", requireAuth, requireMfa, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const now = new Date();

    // Training is the final provider setup milestone. Validate every other
    // Studio prerequisite before recording completion.
    const readinessBeforeTraining = await getProviderStudioReadiness(userId, {
      requireTraining: false,
    });
    if (!readinessBeforeTraining.ok) {
      return res.status(403).json({
        error: readinessBeforeTraining.message,
        code: readinessBeforeTraining.code,
        flow: readinessBeforeTraining.flow,
        missing: readinessBeforeTraining.missing,
      });
    }

    await Promise.all([
      db
        .update(users)
        .set({ procareTrainingCompleted: true })
        .where(eq(users.id, userId)),

      db
        .insert(userCertifications)
        .values({
          userId,
          certificationType: "procare_training",
          status: "completed",
          completedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [userCertifications.userId, userCertifications.certificationType],
          set: {
            status: "completed",
            completedAt: now,
            updatedAt: now,
          },
        }),
    ]);

    const provisioned = await ensureProviderStudioReady(userId, { requireTraining: true });
    if (!provisioned.ok || !provisioned.studio) {
      return res.status(500).json({
        error: provisioned.message || "Training completed, but your Studio could not be prepared. Please try again.",
        code: provisioned.code || "STUDIO_PROVISION_FAILED",
      });
    }

    return res.json({
      ok: true,
      studio: {
        id: provisioned.studio.studioId,
        name: provisioned.studio.studioName,
        type: provisioned.studio.studioType,
      },
    });
  } catch (err) {
    console.error("[ProTraining] complete error:", err);
    return res.status(500).json({ error: "Failed to mark training complete" });
  }
});

export default router;
