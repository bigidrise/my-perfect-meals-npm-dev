import express from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { userCertifications, certificationModuleProgress } from "../db/schema/certifications";
import { users } from "../../shared/schema";
import { sendCertificationCompleteEmail } from "../services/emailService";

const router = express.Router();

// GET /api/certifications/:certType/progress
router.get("/:certType/progress", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType } = req.params;

    const [certification, moduleProgress] = await Promise.all([
      db
        .select()
        .from(userCertifications)
        .where(
          and(
            eq(userCertifications.userId, userId),
            eq(userCertifications.certificationType, certType)
          )
        )
        .limit(1),
      db
        .select()
        .from(certificationModuleProgress)
        .where(
          and(
            eq(certificationModuleProgress.userId, userId),
            eq(certificationModuleProgress.certificationType, certType)
          )
        ),
    ]);

    return res.json({
      certification: certification[0] ?? null,
      moduleProgress,
    });
  } catch (err) {
    console.error("[Cert] progress error:", err);
    return res.status(500).json({ error: "Failed to load progress" });
  }
});

// POST /api/certifications/:certType/modules/:moduleId/view
router.post("/:certType/modules/:moduleId/view", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: certType,
        moduleId,
        status: "in_progress",
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          certificationModuleProgress.userId,
          certificationModuleProgress.certificationType,
          certificationModuleProgress.moduleId,
        ],
        set: {
          lastViewedAt: new Date(),
          status: "in_progress",
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Cert] view error:", err);
    return res.status(500).json({ error: "Failed to record view" });
  }
});

// POST /api/certifications/:certType/modules/:moduleId/quiz
router.post("/:certType/modules/:moduleId/quiz", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;
    const { score, passed } = req.body as { score: number; passed: boolean };

    const status = passed ? "completed" : "quiz_failed";

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: certType,
        moduleId,
        status,
        score,
        completedAt: passed ? new Date() : null,
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          certificationModuleProgress.userId,
          certificationModuleProgress.certificationType,
          certificationModuleProgress.moduleId,
        ],
        set: {
          status,
          score,
          completedAt: passed ? new Date() : null,
          lastViewedAt: new Date(),
        },
      });

    return res.json({ ok: true, status, score });
  } catch (err) {
    console.error("[Cert] quiz error:", err);
    return res.status(500).json({ error: "Failed to save quiz result" });
  }
});

// POST /api/certifications/:certType/complete
router.post("/:certType/complete", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType } = req.params;

    const completedModules = await db
      .select()
      .from(certificationModuleProgress)
      .where(
        and(
          eq(certificationModuleProgress.userId, userId),
          eq(certificationModuleProgress.certificationType, certType),
          eq(certificationModuleProgress.status, "completed")
        )
      );

    if (completedModules.length === 0) {
      return res.status(400).json({ error: "No completed modules found" });
    }

    const avgScore = Math.round(
      completedModules.reduce((acc, m) => acc + (m.score ?? 0), 0) /
        completedModules.length
    );

    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certificateNumber = `MPM-AFF-${year}-${random}`;

    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: certType,
        status: "completed",
        score: avgScore,
        completedAt: new Date(),
        certificateNumber,
      })
      .onConflictDoNothing();

    // Check if already completed (conflict = already issued)
    const [existing] = await db
      .select()
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          eq(userCertifications.certificationType, certType)
        )
      )
      .limit(1);

    const finalCertNumber = existing?.certificateNumber ?? certificateNumber;

    // Send completion email (best effort)
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user?.email) {
        await sendCertificationCompleteEmail({
          to: user.email,
          userName: (user as any).name ?? user.email,
          certType,
          certificateNumber: finalCertNumber,
        });
      }
    } catch (emailErr) {
      console.error("[Cert] completion email failed:", emailErr);
    }

    return res.json({ ok: true, certificateNumber: finalCertNumber, score: avgScore });
  } catch (err) {
    console.error("[Cert] complete error:", err);
    return res.status(500).json({ error: "Failed to complete certification" });
  }
});

export default router;
