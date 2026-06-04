import express from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  userCertifications,
  certificationModuleProgress,
  certificationQuizAttempts,
} from "../db/schema/certifications";
import { users } from "../../shared/schema";
import { sendCertificationCompleteEmail } from "../services/emailService";
import { generateCertificatePDF } from "../services/certificateService";

const router = express.Router();

// ─── STATIC ROUTES (before /:certType dynamic routes) ────────────────────────

// GET /api/certifications/certificate-name
router.get("/certificate-name", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const existing = await db
      .select({ certificateName: userCertifications.certificateName })
      .from(userCertifications)
      .where(eq(userCertifications.userId, userId))
      .limit(10);

    const found = existing.find((r) => r.certificateName);
    return res.json({ certificateName: found?.certificateName ?? null });
  } catch (err) {
    console.error("[Cert] certificate-name GET error:", err);
    return res.status(500).json({ error: "Failed to fetch certificate name" });
  }
});

// ─── DYNAMIC ROUTES ───────────────────────────────────────────────────────────

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

// GET /api/certifications/:certType/certificate — stream PDF
router.get("/:certType/certificate", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType } = req.params;

    const [cert] = await db
      .select()
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          eq(userCertifications.certificationType, certType)
        )
      )
      .limit(1);

    if (!cert || cert.status !== "completed") {
      return res.status(404).json({ error: "Certification not found" });
    }

    if (!cert.certificateName) {
      return res.status(400).json({ error: "Certificate name not set" });
    }

    const pdfBuffer = await generateCertificatePDF({
      name: cert.certificateName,
      certType,
      certificateNumber: cert.certificateNumber ?? "MPM-AFF-XXXXXX",
      completedAt: cert.completedAt ?? new Date(),
    });

    const safeNum = (cert.certificateNumber ?? "certificate").replace(/[^a-zA-Z0-9-]/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="MPM-Certificate-${safeNum}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("[Cert] certificate PDF error:", err);
    return res.status(500).json({ error: "Failed to generate certificate" });
  }
});

// ─── QUIZ ATTEMPT ROUTES ──────────────────────────────────────────────────────

// GET /api/certifications/:certType/modules/:moduleId/quiz-attempt
router.get("/:certType/modules/:moduleId/quiz-attempt", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;

    const [attempt] = await db
      .select()
      .from(certificationQuizAttempts)
      .where(
        and(
          eq(certificationQuizAttempts.userId, userId),
          eq(certificationQuizAttempts.certificationType, certType),
          eq(certificationQuizAttempts.moduleId, moduleId),
          eq(certificationQuizAttempts.status, "in_progress")
        )
      )
      .limit(1);

    return res.json({ attempt: attempt ?? null });
  } catch (err) {
    console.error("[Cert] quiz-attempt GET error:", err);
    return res.status(500).json({ error: "Failed to fetch quiz attempt" });
  }
});

// POST /api/certifications/:certType/modules/:moduleId/quiz-attempt/answer
router.post("/:certType/modules/:moduleId/quiz-attempt/answer", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;
    const { questionId, answerIndex } = req.body as { questionId: string; answerIndex: number };

    if (!questionId || answerIndex === undefined) {
      return res.status(400).json({ error: "questionId and answerIndex required" });
    }

    const answerPatch = JSON.stringify({ [questionId]: answerIndex });

    await db
      .insert(certificationQuizAttempts)
      .values({
        userId,
        certificationType: certType,
        moduleId,
        status: "in_progress",
        answersJson: { [questionId]: answerIndex },
        startedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          certificationQuizAttempts.userId,
          certificationQuizAttempts.certificationType,
          certificationQuizAttempts.moduleId,
        ],
        set: {
          answersJson: sql`COALESCE(${certificationQuizAttempts.answersJson}, '{}') || ${answerPatch}::jsonb`,
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Cert] quiz-attempt answer error:", err);
    return res.status(500).json({ error: "Failed to save answer" });
  }
});

// DELETE /api/certifications/:certType/modules/:moduleId/quiz-attempt
router.delete("/:certType/modules/:moduleId/quiz-attempt", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;

    await db
      .delete(certificationQuizAttempts)
      .where(
        and(
          eq(certificationQuizAttempts.userId, userId),
          eq(certificationQuizAttempts.certificationType, certType),
          eq(certificationQuizAttempts.moduleId, moduleId)
        )
      );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Cert] quiz-attempt DELETE error:", err);
    return res.status(500).json({ error: "Failed to clear quiz attempt" });
  }
});

// ─── MODULE ROUTES ────────────────────────────────────────────────────────────

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
    const { certificateName } = req.body as { certificateName?: string };

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
        certificateName: certificateName ?? null,
      })
      .onConflictDoNothing();

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

    if (existing && !existing.certificateName && certificateName) {
      await db
        .update(userCertifications)
        .set({ certificateName })
        .where(eq(userCertifications.id, existing.id));
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user?.email) {
        await sendCertificationCompleteEmail({
          to: user.email,
          userName: certificateName ?? (user as any).name ?? user.email,
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
