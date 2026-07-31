import express from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  userCertifications,
  certificationModuleProgress,
} from "../db/schema/certifications";
import { QUIZ_ANSWER_KEYS } from "../data/platformMasteryQuizKeys";

const router = express.Router();

const CERT_TYPE = "platform_mastery";
import { LESSON_IDS, getPrerequisiteId } from "./academyLessonIds";
export { LESSON_IDS, getPrerequisiteId };

// Helper: fetch enrollment + progress for a user
async function getUserState(userId: string) {
  const [enrollment, allProgress] = await Promise.all([
    db
      .select()
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          eq(userCertifications.certificationType, CERT_TYPE)
        )
      )
      .limit(1),
    db
      .select()
      .from(certificationModuleProgress)
      .where(
        and(
          eq(certificationModuleProgress.userId, userId),
          eq(certificationModuleProgress.certificationType, CERT_TYPE)
        )
      ),
  ]);

  const enrollmentRecord = enrollment[0] ?? null;
  const progressMap = new Map(allProgress.map((p) => [p.moduleId, p]));

  return { enrollmentRecord, progressMap };
}

// Helper: upsert a module progress record
async function upsertProgress(
  userId: string,
  moduleId: string,
  status: string,
  score?: number | null
) {
  const now = new Date();
  await db
    .insert(certificationModuleProgress)
    .values({
      userId,
      certificationType: CERT_TYPE,
      moduleId,
      status,
      score: score ?? null,
      completedAt: status === "completed" ? now : null,
      lastViewedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        certificationModuleProgress.userId,
        certificationModuleProgress.certificationType,
        certificationModuleProgress.moduleId,
      ],
      set: {
        status: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' AND ${status} != 'completed' THEN 'completed' ELSE ${status} END`,
        score: score !== undefined ? score : sql`${certificationModuleProgress.score}`,
        completedAt: sql`CASE WHEN ${status} = 'completed' AND ${certificationModuleProgress.completedAt} IS NULL THEN NOW() WHEN ${status} = 'completed' THEN ${certificationModuleProgress.completedAt} ELSE ${certificationModuleProgress.completedAt} END`,
        lastViewedAt: now,
      },
    });
}

// GET /api/academy/platform-mastery/status
router.get("/platform-mastery/status", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { enrollmentRecord, progressMap } = await getUserState(userId);

    const progress: Record<string, { status: string; score: number | null }> = {};
    for (const [moduleId, p] of progressMap.entries()) {
      progress[moduleId] = { status: p.status, score: p.score ?? null };
    }

    const isCertificationTrack = enrollmentRecord?.isCertificationTrack ?? false;

    return res.json({
      enrolled: !!enrollmentRecord,
      isCertificationTrack,
      certStatus: enrollmentRecord?.status ?? "not_started",
      certificateNumber: enrollmentRecord?.certificateNumber ?? null,
      certificateName: enrollmentRecord?.certificateName ?? null,
      completedAt: enrollmentRecord?.completedAt ?? null,
      progress,
    });
  } catch (err) {
    console.error("[Academy] status error:", err);
    return res.status(500).json({ error: "Failed to load status" });
  }
});

// POST /api/academy/platform-mastery/enroll
router.post("/platform-mastery/enroll", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { isCertificationTrack = false } = req.body as {
      isCertificationTrack?: boolean;
    };

    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: CERT_TYPE,
        status: "in_progress",
        isCertificationTrack,
      })
      .onConflictDoUpdate({
        target: [
          userCertifications.userId,
          userCertifications.certificationType,
        ],
        set: {
          // Preserve isCertificationTrack when status is already completed so
          // re-enrolling in Learning Mode doesn't strip a certified user's cert track flag.
          isCertificationTrack: sql`CASE WHEN ${userCertifications.status} = 'completed' THEN ${userCertifications.isCertificationTrack} ELSE ${isCertificationTrack} END`,
          status: sql`CASE WHEN ${userCertifications.status} = 'completed' THEN 'completed' ELSE 'in_progress' END`,
        },
      });

    return res.json({ ok: true, isCertificationTrack });
  } catch (err) {
    console.error("[Academy] enroll error:", err);
    return res.status(500).json({ error: "Failed to enroll" });
  }
});

// POST /api/academy/platform-mastery/lessons/:lessonId/read
router.post(
  "/platform-mastery/lessons/:lessonId/read",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).authUser.id;
      const { lessonId } = req.params;

      if (!LESSON_IDS.includes(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }

      // Sequential unlock: cert-mode users cannot read a lesson until the prior one is done
      const { enrollmentRecord, progressMap } = await getUserState(userId);
      const isCertificationTrack = enrollmentRecord?.isCertificationTrack ?? false;
      if (isCertificationTrack) {
        const prereq = getPrerequisiteId(lessonId);
        if (prereq && progressMap.get(prereq)?.status !== "completed") {
          return res.status(403).json({ error: "Complete the previous lesson first" });
        }
      }

      // Only set in_progress — never downgrade a completed lesson
      await db
        .insert(certificationModuleProgress)
        .values({
          userId,
          certificationType: CERT_TYPE,
          moduleId: lessonId,
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
            status: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' THEN 'completed' ELSE 'in_progress' END`,
          },
        });

      return res.json({ ok: true });
    } catch (err) {
      console.error("[Academy] lesson read error:", err);
      return res.status(500).json({ error: "Failed to mark lesson read" });
    }
  }
);

// POST /api/academy/platform-mastery/lessons/:lessonId/exercise
// Mark exercise as complete ("I'm Back" button)
// Completion model:
//   Learning mode: exercise done → lesson complete (exercise is the gate)
//   Cert mode: exercise done ≠ lesson complete; quiz must also pass (≥80%)
router.post(
  "/platform-mastery/lessons/:lessonId/exercise",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).authUser.id;
      const { lessonId } = req.params;

      if (!LESSON_IDS.includes(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }

      const { enrollmentRecord, progressMap } = await getUserState(userId);
      const isCertificationTrack = enrollmentRecord?.isCertificationTrack ?? false;

      // Sequential unlock: cert-mode users cannot submit exercise for a locked lesson
      if (isCertificationTrack) {
        const prereq = getPrerequisiteId(lessonId);
        if (prereq && progressMap.get(prereq)?.status !== "completed") {
          return res.status(403).json({ error: "Complete the previous lesson first" });
        }
      }

      // Always mark the exercise itself as completed
      await upsertProgress(userId, `${lessonId}-exercise`, "completed");

      if (!isCertificationTrack) {
        // Learning mode: exercise alone completes the lesson
        await upsertProgress(userId, lessonId, "completed");
      } else {
        // Cert mode: lesson only completes if quiz is also already passed
        const quizRecord = progressMap.get(`${lessonId}-quiz`);
        const quizAlreadyPassed = quizRecord?.status === "completed";
        if (quizAlreadyPassed) {
          await upsertProgress(userId, lessonId, "completed");
        }
        // If quiz not yet passed, leave lesson in_progress — don't upgrade it
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("[Academy] exercise complete error:", err);
      return res.status(500).json({ error: "Failed to mark exercise complete" });
    }
  }
);

// POST /api/academy/platform-mastery/lessons/:lessonId/quiz
// Submit quiz result.
// Completion model:
//   Learning mode: quiz passed alone → lesson complete
//   Cert mode: quiz passed + exercise done → lesson complete; quiz passed alone → quiz complete only
router.post(
  "/platform-mastery/lessons/:lessonId/quiz",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as AuthenticatedRequest).authUser.id;
      const { lessonId } = req.params;

      if (!LESSON_IDS.includes(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }

      // Accept submitted answers keyed by question index (0-based)
      const { answers } = req.body as { answers: Record<number, number> };

      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ error: "answers required" });
      }

      // Compute score server-side from the authoritative answer key
      const answerKey = QUIZ_ANSWER_KEYS[lessonId];
      if (!answerKey) {
        return res.status(400).json({ error: "No answer key for this lesson" });
      }

      const totalQuestions = answerKey.length;
      let correctCount = 0;
      for (let i = 0; i < totalQuestions; i++) {
        if (Number(answers[i]) === answerKey[i]) correctCount++;
      }
      const serverScore = Math.round((correctCount / totalQuestions) * 100);
      const serverPassed = serverScore >= 80;

      const { enrollmentRecord, progressMap } = await getUserState(userId);
      const isCertificationTrack = enrollmentRecord?.isCertificationTrack ?? false;

      // Sequential unlock: cert-mode users cannot submit quiz for a locked lesson
      if (isCertificationTrack) {
        const prereq = getPrerequisiteId(lessonId);
        if (prereq && progressMap.get(prereq)?.status !== "completed") {
          return res.status(403).json({ error: "Complete the previous lesson first" });
        }
      }

      const quizStatus = serverPassed ? "completed" : "quiz_failed";

      // Record quiz result — never downgrade a previously passed quiz
      const now = new Date();
      await db
        .insert(certificationModuleProgress)
        .values({
          userId,
          certificationType: CERT_TYPE,
          moduleId: `${lessonId}-quiz`,
          status: quizStatus,
          score: serverScore,
          completedAt: serverPassed ? now : null,
          lastViewedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            certificationModuleProgress.userId,
            certificationModuleProgress.certificationType,
            certificationModuleProgress.moduleId,
          ],
          set: {
            // Never downgrade a previously completed quiz
            status: sql`CASE WHEN ${certificationModuleProgress.status} = 'completed' THEN 'completed' ELSE ${quizStatus} END`,
            score: serverScore,
            completedAt: serverPassed
              ? sql`COALESCE(${certificationModuleProgress.completedAt}, NOW())`
              : sql`${certificationModuleProgress.completedAt}`,
            lastViewedAt: now,
          },
        });

      // Determine if base lesson should be marked complete
      if (serverPassed) {
        const exerciseRecord = progressMap.get(`${lessonId}-exercise`);
        const exerciseDone = exerciseRecord?.status === "completed";

        if (!isCertificationTrack) {
          // Learning mode: quiz pass alone is sufficient
          await upsertProgress(userId, lessonId, "completed");
        } else if (exerciseDone) {
          // Cert mode: quiz pass + exercise done = lesson complete
          await upsertProgress(userId, lessonId, "completed");
        }
        // Cert mode + exercise not done: lesson stays in_progress (will complete when exercise is done)
      }

      return res.json({ ok: true, score: serverScore, passed: serverPassed });
    } catch (err) {
      console.error("[Academy] quiz submit error:", err);
      return res.status(500).json({ error: "Failed to submit quiz" });
    }
  }
);

// POST /api/academy/platform-mastery/complete
// Claim the Platform Mastery certificate.
// Cert mode users: must have all 6 base lessons completed AND all 6 quizzes passed.
// Learning mode users: must have all 6 base lessons completed.
router.post("/platform-mastery/complete", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certificateName } = req.body as { certificateName: string };

    if (!certificateName?.trim()) {
      return res.status(400).json({ error: "certificateName required" });
    }

    const { enrollmentRecord, progressMap } = await getUserState(userId);

    if (!enrollmentRecord) {
      return res.status(400).json({ error: "Not enrolled" });
    }

    const isCertificationTrack = enrollmentRecord.isCertificationTrack ?? false;

    // Certificates are only issued to users on the certification track
    if (!isCertificationTrack) {
      return res.status(403).json({
        error:
          "Certificates are issued in Certification Mode only. Re-enroll in Certification Mode to earn a certificate.",
      });
    }

    // Already certified — short-circuit so new lessons added after the fact
    // never re-block an existing certificate holder.
    if (enrollmentRecord.status === "completed" && enrollmentRecord.certificateNumber) {
      return res.json({
        ok: true,
        certificateNumber: enrollmentRecord.certificateNumber,
      });
    }

    // All base lessons must be completed for everyone
    const allLessonsDone = LESSON_IDS.every(
      (id) => progressMap.get(id)?.status === "completed"
    );

    if (!allLessonsDone) {
      return res.status(400).json({ error: "All lessons must be completed first" });
    }

    // Cert mode: additionally require all 6 quiz passes
    if (isCertificationTrack) {
      const allQuizzesPassed = LESSON_IDS.every(
        (id) => progressMap.get(`${id}-quiz`)?.status === "completed"
      );
      if (!allQuizzesPassed) {
        return res.status(400).json({
          error:
            "All lesson quizzes must be passed (80%) before issuing a Certification Mode certificate",
        });
      }
    }

    const certNumber = `MPM-PM-${Date.now().toString(36).toUpperCase()}`;

    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: CERT_TYPE,
        status: "completed",
        certificateNumber: certNumber,
        certificateName: certificateName.trim(),
        completedAt: new Date(),
        isCertificationTrack,
      })
      .onConflictDoUpdate({
        target: [
          userCertifications.userId,
          userCertifications.certificationType,
        ],
        set: {
          status: "completed",
          certificateNumber: certNumber,
          certificateName: certificateName.trim(),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    return res.json({ ok: true, certificateNumber: certNumber });
  } catch (err) {
    console.error("[Academy] complete error:", err);
    return res.status(500).json({ error: "Failed to issue certificate" });
  }
});

// GET /api/academy/platform-mastery/certificate
router.get("/platform-mastery/certificate", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const [cert] = await db
      .select()
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          eq(userCertifications.certificationType, CERT_TYPE),
          eq(userCertifications.status, "completed")
        )
      )
      .limit(1);

    if (!cert) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    return res.json({
      certificateNumber: cert.certificateNumber,
      certificateName: cert.certificateName,
      completedAt: cert.completedAt,
    });
  } catch (err) {
    console.error("[Academy] certificate error:", err);
    return res.status(500).json({ error: "Failed to load certificate" });
  }
});

export default router;
