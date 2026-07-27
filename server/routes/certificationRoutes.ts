import express from "express";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { eq, and, asc, inArray, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  userCertifications,
  certificationModuleProgress,
  certificationQuizAttempts,
} from "../db/schema/certifications";
import { certModules, certQuestions, certQuestionOptions } from "../db/schema/lms";
import { users } from "../../shared/schema";
import { sendCertificationCompleteEmail } from "../services/emailService";
import { emailServiceAvailable } from "../middleware/requireEmailService";
import { generateCertificatePDF } from "../services/certificateService";
import { evaluateAffiliateActivation } from "../services/affiliateActivation";

const router = express.Router();

const DB_DRIVEN_CERT_TYPES = ["platform", "business_success"];

// ─── DB-DRIVEN CERT: MODULE LIST WITH QUESTIONS ───────────────────────────────

// GET /api/certifications/:certType/modules — DB-driven module list + questions (no correct answers)
router.get("/:certType/modules", requireAuth, async (req, res) => {
  try {
    const { certType } = req.params;
    if (!DB_DRIVEN_CERT_TYPES.includes(certType)) {
      return res.status(400).json({ error: "Not a DB-driven certification type" });
    }

    const modules = await db
      .select()
      .from(certModules)
      .where(and(eq(certModules.certType, certType), eq(certModules.isActive, true)))
      .orderBy(asc(certModules.sortOrder));

    // For each quiz/final module, fetch its questions + options (no isCorrect sent to client)
    const quizModuleSlugs = modules
      .filter((m) => m.moduleType === "quiz" || m.moduleType === "final_assessment")
      .map((m) => m.slug);

    let questions: typeof certQuestions.$inferSelect[] = [];
    let options: typeof certQuestionOptions.$inferSelect[] = [];

    if (quizModuleSlugs.length > 0) {
      if (modules.some((m) => m.moduleType === "final_assessment")) {
        // Final assessment: all active questions for this cert type (excluding final itself)
        questions = await db
          .select()
          .from(certQuestions)
          .where(and(eq(certQuestions.certType, certType), eq(certQuestions.isActive, true), ne(certQuestions.moduleSlug, "final")))
          .orderBy(asc(certQuestions.sortOrder));
      } else {
        questions = await db
          .select()
          .from(certQuestions)
          .where(and(
            eq(certQuestions.certType, certType),
            eq(certQuestions.isActive, true),
            inArray(certQuestions.moduleSlug, quizModuleSlugs)
          ))
          .orderBy(asc(certQuestions.sortOrder));
      }

      if (questions.length > 0) {
        options = (await db
          .select({ id: certQuestionOptions.id, questionId: certQuestionOptions.questionId, optionText: certQuestionOptions.optionText, sortOrder: (certQuestionOptions as any).sortOrder })
          .from(certQuestionOptions)
          .where(inArray(certQuestionOptions.questionId, questions.map((q) => q.id)))) as any;
      }
    }

    const optsByQ = options.reduce<Record<string, typeof options>>((acc, o) => {
      const k = o.questionId as string;
      if (!acc[k]) acc[k] = [];
      acc[k].push(o);
      return acc;
    }, {});

    const questionsBySlug = questions.reduce<Record<string, Array<{ id: string; questionText: string; options: Array<{ id: string; optionText: string; sortOrder: number }> }>>>((acc, q) => {
      if (!acc[q.moduleSlug]) acc[q.moduleSlug] = [];
      acc[q.moduleSlug].push({
        id: q.id,
        questionText: q.questionText,
        options: (optsByQ[q.id] ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      });
      return acc;
    }, {});

    const result = modules.map((m) => {
      const baseModule: Record<string, unknown> = { ...m };
      if (m.moduleType === "quiz") {
        baseModule.questions = questionsBySlug[m.slug] ?? [];
      } else if (m.moduleType === "final_assessment") {
        // Shuffle all questions and limit to questionLimit
        const allQ = Object.values(questionsBySlug).flat();
        const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, m.questionLimit ?? 20);
        baseModule.questions = shuffled;
      }
      return baseModule;
    });

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json({ modules: result });
  } catch (err) {
    console.error("[Cert] DB modules error:", err);
    return res.status(500).json({ error: "Failed to load modules" });
  }
});

// POST /api/certifications/:certType/modules/:moduleId/video-progress — track video watch %
router.post("/:certType/modules/:moduleId/video-progress", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;
    const { pct } = req.body as { pct: number };
    if (typeof pct !== "number") return res.status(400).json({ error: "pct required" });

    const clampedPct = Math.min(100, Math.max(0, Math.round(pct)));
    const newStatus = clampedPct >= 100 ? "completed" : "in_progress";

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: certType,
        moduleId,
        status: newStatus,
        videoWatchedPct: clampedPct,
        lastViewedAt: new Date(),
        completedAt: newStatus === "completed" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [
          certificationModuleProgress.userId,
          certificationModuleProgress.certificationType,
          certificationModuleProgress.moduleId,
        ],
        set: {
          videoWatchedPct: clampedPct,
          lastViewedAt: new Date(),
          status: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' THEN 'completed' WHEN ${clampedPct} >= 100 THEN 'completed' ELSE 'in_progress' END`,
          completedAt: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' THEN ${certificationModuleProgress.completedAt} WHEN ${clampedPct} >= 100 THEN NOW() ELSE NULL END`,
        },
      });

    return res.json({ ok: true, status: newStatus, videoWatchedPct: clampedPct });
  } catch (err) {
    console.error("[Cert] video-progress error:", err);
    return res.status(500).json({ error: "Failed to save video progress" });
  }
});

// POST /api/certifications/:certType/modules/:moduleId/quiz/evaluate — server-side quiz evaluation (DB-driven certs)
router.post("/:certType/modules/:moduleId/quiz/evaluate", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType, moduleId } = req.params;
    const { answers } = req.body as { answers: Record<string, string> }; // { questionId: optionId }

    if (!DB_DRIVEN_CERT_TYPES.includes(certType)) {
      return res.status(400).json({ error: "Not a DB-driven cert type" });
    }

    // Fetch all questions for this module (or all for final assessment)
    const isFinal = moduleId === "final";
    let questions: typeof certQuestions.$inferSelect[];
    if (isFinal) {
      questions = await db.select().from(certQuestions).where(and(eq(certQuestions.certType, certType), eq(certQuestions.isActive, true)));
    } else {
      questions = await db.select().from(certQuestions).where(and(eq(certQuestions.certType, certType), eq(certQuestions.moduleSlug, moduleId), eq(certQuestions.isActive, true)));
    }

    if (questions.length === 0) {
      return res.status(404).json({ error: "No questions found for this module" });
    }

    const questionIds = questions.map((q) => q.id);
    const correctOptions = await db
      .select({ questionId: certQuestionOptions.questionId, id: certQuestionOptions.id })
      .from(certQuestionOptions)
      .where(and(inArray(certQuestionOptions.questionId, questionIds), eq(certQuestionOptions.isCorrect, true)));

    const correctMap = new Map(correctOptions.map((o) => [o.questionId as string, o.id as string]));

    const answeredQuestionIds = Object.keys(answers);
    let correct = 0;
    const correctAnswers: Record<string, string> = {};

    for (const qId of answeredQuestionIds) {
      const correctOptionId = correctMap.get(qId);
      correctAnswers[qId] = correctOptionId ?? "";
      if (correctOptionId && answers[qId] === correctOptionId) {
        correct++;
      }
    }

    const total = answeredQuestionIds.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Get passing score from module config
    const [moduleConfig] = await db.select({ passingScorePct: certModules.passingScorePct }).from(certModules).where(and(eq(certModules.certType, certType), eq(certModules.slug, moduleId))).limit(1);
    const passingScore = moduleConfig?.passingScorePct ?? 80;
    const passed = score >= passingScore;

    const status = passed ? "completed" : "quiz_failed";

    await db
      .insert(certificationModuleProgress)
      .values({ userId, certificationType: certType, moduleId, status, score, completedAt: passed ? new Date() : null, lastViewedAt: new Date() })
      .onConflictDoUpdate({
        target: [certificationModuleProgress.userId, certificationModuleProgress.certificationType, certificationModuleProgress.moduleId],
        set: { status, score, completedAt: passed ? new Date() : null, lastViewedAt: new Date() },
      });

    return res.json({ ok: true, score, passed, total, correct, correctAnswers });
  } catch (err) {
    console.error("[Cert] quiz evaluate error:", err);
    return res.status(500).json({ error: "Failed to evaluate quiz" });
  }
});

// ─── AFFILIATE CERT STATUS (used by affiliate gating) ────────────────────────

// GET /api/certifications/affiliate-status — check both certs for affiliate unlock
router.get("/affiliate-status", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const certs = await db
      .select({ certType: userCertifications.certificationType, status: userCertifications.status })
      .from(userCertifications)
      .where(and(
        eq(userCertifications.userId, userId),
        inArray(userCertifications.certificationType, ["affiliate_social", "platform", "platform_mastery"])
      ));

    const certMap = new Map(certs.map((c) => [c.certType, c.status]));
    // businessCertified = Phase 1 (Business Success Cert = affiliate_social, shared between social & coaching paths)
    const businessCertified = certMap.get("affiliate_social") === "completed";
    const platformCertified =
      certMap.get("platform") === "completed" ||
      certMap.get("platform_mastery") === "completed";
    const eligible = businessCertified && platformCertified;

    return res.json({ eligible, businessCertified, platformCertified });
  } catch (err) {
    console.error("[Cert] affiliate-status error:", err);
    return res.status(500).json({ error: "Failed to check affiliate status" });
  }
});

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

// GET /api/certifications/assets/signature — public static asset, no auth required
// (signature appears on every certificate; it is not a user secret)
router.get("/assets/signature", async (req, res) => {
  try {
    const sigPath = path.join(process.cwd(), "server", "assets", "cert-signature.png");
    if (!fs.existsSync(sigPath)) {
      return res.status(404).json({ error: "Signature not found" });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(sigPath);
  } catch (err) {
    console.error("[Cert] signature asset error:", err);
    return res.status(500).json({ error: "Failed to serve signature" });
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

    // Never cache this response — module status changes after every quiz
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
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

// ─── MARKETING & COACHING WAITLIST ───────────────────────────────────────────

// GET /api/certifications/marketing_coaching/waitlist-count — total waitlist size (social proof)
router.get("/marketing_coaching/waitlist-count", requireAuth, async (_req, res) => {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.certificationType, "marketing_coaching"),
          eq(userCertifications.status, "waitlisted")
        )
      );
    return res.json({ count: row?.count ?? 0 });
  } catch (err) {
    console.error("[Cert] marketing_coaching waitlist-count error:", err);
    return res.status(500).json({ error: "Failed to fetch waitlist count" });
  }
});

// POST /api/certifications/marketing_coaching/waitlist — join the waitlist
router.post("/marketing_coaching/waitlist", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: "marketing_coaching",
        status: "waitlisted",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userCertifications.userId, userCertifications.certificationType],
        set: {
          status: sql`CASE WHEN ${userCertifications.status} = 'completed' THEN 'completed' WHEN ${userCertifications.status} = 'in_progress' THEN 'in_progress' ELSE 'waitlisted' END`,
          updatedAt: new Date(),
        },
      });

    return res.json({ ok: true, status: "waitlisted" });
  } catch (err) {
    console.error("[Cert] marketing_coaching waitlist error:", err);
    return res.status(500).json({ error: "Failed to join waitlist" });
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
          // Never downgrade a completed module back to in_progress
          status: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' THEN 'completed' ELSE 'in_progress' END`,
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
    const newCertNumber = `MPM-AFF-${year}-${random}`;

    // Deterministic upsert — unique constraint on (user_id, certification_type)
    // On conflict: only update name if it was previously null; never overwrite cert number or completedAt
    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: certType,
        status: "completed",
        score: avgScore,
        completedAt: new Date(),
        certificateNumber: newCertNumber,
        certificateName: certificateName ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userCertifications.userId, userCertifications.certificationType],
        set: {
          // Only update name if a name was provided and the existing row has none.
          // Resolve the conditional in TS so PostgreSQL never sees a bare untyped null.
          certificateName: certificateName
            ? sql`CASE WHEN ${userCertifications.certificateName} IS NULL THEN ${certificateName}::text ELSE ${userCertifications.certificateName} END`
            : sql`${userCertifications.certificateName}`,
          updatedAt: new Date(),
        },
      });

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

    const finalCertNumber = existing?.certificateNumber ?? newCertNumber;

    if (!emailServiceAvailable()) {
      console.warn(`[Cert] Email service not configured — completion email skipped for userId=${userId} certType=${certType}`);
    } else {
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
    }

    // Evaluate affiliate activation — non-blocking, never throws
    evaluateAffiliateActivation(userId).catch((e) =>
      console.error("[Cert] affiliate activation check failed:", e)
    );

    return res.json({ ok: true, certificateNumber: finalCertNumber, score: avgScore });
  } catch (err) {
    console.error("[Cert] complete error:", err);
    return res.status(500).json({ error: "Failed to complete certification" });
  }
});

export default router;
