import express from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { db } from "../db";
import { eq, and, asc, inArray, ne, or } from "drizzle-orm";
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
import {
  MARKETING_COACHING_MODULE_IDS,
  SPECIALIST_CERTIFICATION_TYPE,
} from "@shared/academyProgression";
import { getAcademyProgression } from "../services/academyProgression";
import {
  buildAttemptHistoryModuleId,
  filterProCareProgress,
  getProCareAssessmentPrerequisites,
  hasLegacyProCareProgressEvidence,
  isProCareCourseStructure,
  LEGACY_PROCARE_CERTIFICATION_TYPE,
  PROCARE_CERTIFICATION_TYPE,
  PROCARE_FINAL_ASSESSMENT_ID,
  PROCARE_FINAL_QUESTION_COUNT,
  PROCARE_PASSING_SCORE,
  PROCARE_QUIZ_MODULE_IDS,
  PROCARE_REQUIRED_SEQUENCE,
  PROCARE_VIDEO_MODULE_IDS,
  scoreAssessment,
  selectProCareFinalAssessmentQuestions,
  validateCompleteAssessmentSubmission,
  validateProCareCertificationProgress,
} from "../services/procareCertification";

const router = express.Router();

const DB_DRIVEN_CERT_TYPES = [
  LEGACY_PROCARE_CERTIFICATION_TYPE,
  PROCARE_CERTIFICATION_TYPE,
  "business_success",
];

async function loadStoredModules(certType: string) {
  return db
    .select()
    .from(certModules)
    .where(and(eq(certModules.certType, certType), eq(certModules.isActive, true)))
    .orderBy(asc(certModules.sortOrder));
}

async function resolveCertificationCourse(requestedCertType: string) {
  if (requestedCertType === PROCARE_CERTIFICATION_TYPE) {
    const canonicalModules = await loadStoredModules(PROCARE_CERTIFICATION_TYPE);
    if (isProCareCourseStructure(canonicalModules)) {
      return {
        requestedCertType,
        storageCertType: PROCARE_CERTIFICATION_TYPE,
        isProCare: true,
        modules: canonicalModules,
      };
    }

    const legacyModules = await loadStoredModules(
      LEGACY_PROCARE_CERTIFICATION_TYPE,
    );
    if (isProCareCourseStructure(legacyModules)) {
      return {
        requestedCertType,
        storageCertType: LEGACY_PROCARE_CERTIFICATION_TYPE,
        isProCare: true,
        modules: legacyModules,
      };
    }

    return {
      requestedCertType,
      storageCertType: PROCARE_CERTIFICATION_TYPE,
      isProCare: true,
      modules: canonicalModules,
    };
  }

  const modules = await loadStoredModules(requestedCertType);
  return {
    requestedCertType,
    storageCertType: requestedCertType,
    isProCare:
      requestedCertType === LEGACY_PROCARE_CERTIFICATION_TYPE &&
      isProCareCourseStructure(modules),
    modules,
  };
}

function withVirtualProCareFinalAssessment(
  modules: Awaited<ReturnType<typeof loadStoredModules>>,
  requestedCertType: string,
) {
  if (modules.some((module) => module.slug === PROCARE_FINAL_ASSESSMENT_ID)) {
    return modules;
  }

  const maxSortOrder = modules.reduce(
    (maximum, module) => Math.max(maximum, module.sortOrder),
    0,
  );
  return [
    ...modules,
    {
      id: "virtual-procare-final-assessment",
      certType: requestedCertType,
      slug: PROCARE_FINAL_ASSESSMENT_ID,
      title: "Final ProCare Assessment",
      description:
        "20 cumulative questions across all three ProCare training modules",
      moduleType: "final_assessment",
      videoUrl: null,
      sortOrder: maxSortOrder + 1,
      passingScorePct: PROCARE_PASSING_SCORE,
      questionLimit: PROCARE_FINAL_QUESTION_COUNT,
      isActive: true,
      createdAt: new Date(0),
    },
  ];
}

async function recordAssessmentAttempt(params: {
  userId: string;
  certificationType: string;
  assessmentId: string;
  answers: Record<string, string>;
  status: "blocked" | "incomplete" | "failed" | "passed";
  score: number;
}) {
  const now = new Date();
  await db.insert(certificationQuizAttempts).values({
    userId: params.userId,
    certificationType: params.certificationType,
    moduleId: buildAttemptHistoryModuleId(
      params.assessmentId,
      randomUUID(),
    ),
    status: params.status,
    answersJson: {
      assessmentId: params.assessmentId,
      submittedAnswers: params.answers,
    },
    score: params.score,
    startedAt: now,
    completedAt: now,
  });
}

function proCarePrerequisiteIsComplete(
  moduleId: string,
  progress: Array<{
    moduleId: string;
    status: string;
    score: number | null;
    videoWatchedPct: number | null;
  }>,
) {
  const row = progress.find((item) => item.moduleId === moduleId);
  if (!row || row.status !== "completed") return false;
  if ((PROCARE_VIDEO_MODULE_IDS as readonly string[]).includes(moduleId)) {
    return (row.videoWatchedPct ?? 0) >= 100;
  }
  return (row.score ?? 0) >= PROCARE_PASSING_SCORE;
}

async function findCertificateForDisplay(userId: string, certType: string) {
  const [cert] = await db
    .select()
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, userId),
        eq(userCertifications.certificationType, certType),
      ),
    )
    .limit(1);

  if (cert || certType !== SPECIALIST_CERTIFICATION_TYPE) {
    return cert;
  }

  // The Specialist credential was introduced after some users had already
  // completed Marketing & Coaching. Treat that completed legacy row as the
  // source record for display/download, but never relabel or mutate it.
  const [legacyMarketingCert] = await db
    .select()
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, userId),
        eq(userCertifications.certificationType, "marketing_coaching"),
        eq(userCertifications.status, "completed"),
      ),
    )
    .limit(1);

  return legacyMarketingCert;
}

async function findProCareCertificateForDisplay(
  userId: string,
  requestedCertType: string,
  progress: Array<{
    moduleId: string;
    status: string;
    score: number | null;
    videoWatchedPct: number | null;
  }>,
) {
  const certs = await db
    .select()
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, userId),
        inArray(userCertifications.certificationType, [
          PROCARE_CERTIFICATION_TYPE,
          LEGACY_PROCARE_CERTIFICATION_TYPE,
        ]),
      ),
    );

  const canonical = certs.find(
    (cert) => cert.certificationType === PROCARE_CERTIFICATION_TYPE,
  );
  if (canonical) return canonical;

  const legacy = certs.find(
    (cert) =>
      cert.certificationType === LEGACY_PROCARE_CERTIFICATION_TYPE &&
      cert.isCertificationTrack !== true,
  );
  if (
    legacy &&
    hasLegacyProCareProgressEvidence(progress) &&
    (requestedCertType === PROCARE_CERTIFICATION_TYPE ||
      requestedCertType === LEGACY_PROCARE_CERTIFICATION_TYPE)
  ) {
    return legacy;
  }

  return undefined;
}

// ─── DB-DRIVEN CERT: MODULE LIST WITH QUESTIONS ───────────────────────────────

// GET /api/certifications/:certType/modules — DB-driven module list + questions (no correct answers)
router.get("/:certType/modules", requireAuth, async (req, res) => {
  try {
    const { certType } = req.params;
    if (!DB_DRIVEN_CERT_TYPES.includes(certType)) {
      return res.status(400).json({ error: "Not a DB-driven certification type" });
    }

    const course = await resolveCertificationCourse(certType);
    const modules = course.isProCare
      ? withVirtualProCareFinalAssessment(course.modules, certType)
      : course.modules;

    // For each quiz/final module, fetch its questions + options (no isCorrect sent to client)
    const quizModuleSlugs = modules
      .filter((m) => m.moduleType === "quiz" || m.moduleType === "final_assessment")
      .map((m) => m.slug);

    let questions: typeof certQuestions.$inferSelect[] = [];
    let options: typeof certQuestionOptions.$inferSelect[] = [];

    if (quizModuleSlugs.length > 0) {
      if (course.isProCare) {
        questions = await db
          .select()
          .from(certQuestions)
          .where(
            and(
              eq(certQuestions.certType, course.storageCertType),
              eq(certQuestions.isActive, true),
              inArray(certQuestions.moduleSlug, [...PROCARE_QUIZ_MODULE_IDS]),
            ),
          )
          .orderBy(asc(certQuestions.sortOrder));
      } else if (modules.some((m) => m.moduleType === "final_assessment")) {
        // Final assessment: all active questions for this cert type (excluding final itself)
        questions = await db
          .select()
          .from(certQuestions)
          .where(and(eq(certQuestions.certType, course.storageCertType), eq(certQuestions.isActive, true), ne(certQuestions.moduleSlug, "final")))
          .orderBy(asc(certQuestions.sortOrder));
      } else {
        questions = await db
          .select()
          .from(certQuestions)
          .where(and(
            eq(certQuestions.certType, course.storageCertType),
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
        const allQ = Object.values(questionsBySlug).flat();
        if (course.isProCare) {
          const finalQuestions = selectProCareFinalAssessmentQuestions(
            questions.map((question) => ({
              ...question,
              options:
                questionsBySlug[question.moduleSlug]?.find(
                  (item) => item.id === question.id,
                )?.options ?? [],
            })),
          );
          if (!finalQuestions) {
            return res.status(409).json({
              error:
                "The approved ProCare question bank cannot support the 20-question final assessment",
            });
          }
          baseModule.questions = finalQuestions;
        } else {
          baseModule.questions = allQ
            .sort(() => Math.random() - 0.5)
            .slice(0, m.questionLimit ?? 20);
        }
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
    if (!DB_DRIVEN_CERT_TYPES.includes(certType)) {
      return res.status(400).json({ error: "Not a DB-driven certification type" });
    }

    const course = await resolveCertificationCourse(certType);
    const moduleConfig = course.modules.find(
      (module) => module.slug === moduleId && module.moduleType === "video",
    );
    if (!moduleConfig) {
      return res.status(404).json({ error: "Training video not found" });
    }

    const clampedPct = Math.min(100, Math.max(0, Math.round(pct)));
    const newStatus = clampedPct >= 100 ? "completed" : "in_progress";

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: course.storageCertType,
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

    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ error: "answers must be an object" });
    }

    const course = await resolveCertificationCourse(certType);
    const isFinal = moduleId === PROCARE_FINAL_ASSESSMENT_ID;
    if (
      course.isProCare &&
      !(
        (PROCARE_QUIZ_MODULE_IDS as readonly string[]).includes(moduleId) ||
        isFinal
      )
    ) {
      return res.status(404).json({ error: "ProCare assessment not found" });
    }

    const progress = course.isProCare
      ? await db
          .select({
            moduleId: certificationModuleProgress.moduleId,
            status: certificationModuleProgress.status,
            score: certificationModuleProgress.score,
            videoWatchedPct: certificationModuleProgress.videoWatchedPct,
          })
          .from(certificationModuleProgress)
          .where(
            and(
              eq(certificationModuleProgress.userId, userId),
              eq(
                certificationModuleProgress.certificationType,
                course.storageCertType,
              ),
            ),
          )
      : [];
    if (course.isProCare) {
      const missingPrerequisites = getProCareAssessmentPrerequisites(
        moduleId,
      ).filter(
        (requiredModuleId) =>
          !proCarePrerequisiteIsComplete(requiredModuleId, progress),
      );
      if (missingPrerequisites.length > 0) {
        await recordAssessmentAttempt({
          userId,
          certificationType: course.storageCertType,
          assessmentId: moduleId,
          answers,
          status: "blocked",
          score: 0,
        });
        return res.status(409).json({
          error: "Complete the required ProCare training steps first",
          missingPrerequisites,
        });
      }
    }

    let questions: typeof certQuestions.$inferSelect[];
    if (isFinal && course.isProCare) {
      const questionBank = await db
        .select()
        .from(certQuestions)
        .where(
          and(
            eq(certQuestions.certType, course.storageCertType),
            eq(certQuestions.isActive, true),
            inArray(certQuestions.moduleSlug, [...PROCARE_QUIZ_MODULE_IDS]),
          ),
        )
        .orderBy(asc(certQuestions.sortOrder));
      const selected = selectProCareFinalAssessmentQuestions(questionBank);
      if (!selected) {
        return res.status(409).json({
          error:
            "The approved ProCare question bank cannot support the 20-question final assessment",
        });
      }
      questions = selected;
    } else if (isFinal) {
      questions = await db
        .select()
        .from(certQuestions)
        .where(
          and(
            eq(certQuestions.certType, course.storageCertType),
            eq(certQuestions.isActive, true),
          ),
        );
    } else {
      questions = await db
        .select()
        .from(certQuestions)
        .where(
          and(
            eq(certQuestions.certType, course.storageCertType),
            eq(certQuestions.moduleSlug, moduleId),
            eq(certQuestions.isActive, true),
          ),
        )
        .orderBy(asc(certQuestions.sortOrder));
    }

    if (questions.length === 0) {
      return res.status(404).json({ error: "No questions found for this module" });
    }

    const questionIds = questions.map((q) => q.id);
    const submission = validateCompleteAssessmentSubmission(
      questionIds,
      answers,
    );
    if (!submission.ok) {
      if (course.isProCare) {
        await recordAssessmentAttempt({
          userId,
          certificationType: course.storageCertType,
          assessmentId: moduleId,
          answers,
          status: "incomplete",
          score: 0,
        });
      }
      return res.status(400).json({
        error: "Every configured assessment question must be answered",
        missingQuestionIds: submission.missingQuestionIds,
        unexpectedQuestionIds: submission.unexpectedQuestionIds,
      });
    }

    const correctOptions = await db
      .select({ questionId: certQuestionOptions.questionId, id: certQuestionOptions.id })
      .from(certQuestionOptions)
      .where(and(inArray(certQuestionOptions.questionId, questionIds), eq(certQuestionOptions.isCorrect, true)));

    const correctMap = new Map(correctOptions.map((o) => [o.questionId as string, o.id as string]));

    // Get passing score from module config
    const moduleConfig = isFinal && course.isProCare
      ? { passingScorePct: PROCARE_PASSING_SCORE }
      : course.modules.find((module) => module.slug === moduleId);
    const passingScore =
      moduleConfig?.passingScorePct ?? PROCARE_PASSING_SCORE;
    const { score, passed, total, correct, correctAnswers } = scoreAssessment(
      questionIds,
      answers,
      correctMap,
      passingScore,
    );

    const status = passed ? "completed" : "quiz_failed";

    if (course.isProCare) {
      await recordAssessmentAttempt({
        userId,
        certificationType: course.storageCertType,
        assessmentId: moduleId,
        answers,
        status: passed ? "passed" : "failed",
        score,
      });
    }

    await db
      .insert(certificationModuleProgress)
      .values({ userId, certificationType: course.storageCertType, moduleId, status, score, completedAt: passed ? new Date() : null, lastViewedAt: new Date() })
      .onConflictDoUpdate({
        target: [certificationModuleProgress.userId, certificationModuleProgress.certificationType, certificationModuleProgress.moduleId],
        set: { status, score, completedAt: passed ? new Date() : null, lastViewedAt: new Date() },
      });

    return res.json({
      ok: true,
      score,
      passed,
      total,
      correct,
      ...(course.isProCare ? {} : { correctAnswers }),
    });
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
        inArray(userCertifications.certificationType, ["affiliate_social", "platform_mastery"])
      ));

    const certMap = new Map(certs.map((c) => [c.certType, c.status]));
    // businessCertified = Phase 1 (Business Success Cert = affiliate_social, shared between social & coaching paths)
    const businessCertified = certMap.get("affiliate_social") === "completed";
    // platformCertified = Platform Mastery Academy completion (platform_mastery).
    // Old "platform" Academy records are bridged to "platform_mastery" by the boot migration.
    const platformCertified = certMap.get("platform_mastery") === "completed";
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

// GET /api/certifications/phase1-status
// Canonical Phase 1 status. Completion comes from the authoritative Academy
// progression resolver; the parent certification row is returned only as
// compatibility metadata and is not the completion authority.
router.get("/phase1-status", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const [progression, certs] = await Promise.all([
      getAcademyProgression(userId),
      db
        .select({
          status: userCertifications.status,
          completedAt: userCertifications.completedAt,
          certificationType: userCertifications.certificationType,
          score: userCertifications.score,
        })
        .from(userCertifications)
        .where(
          and(
            eq(userCertifications.userId, userId),
            or(
              eq(userCertifications.certificationType, "platform_mastery"),
              and(
                eq(userCertifications.certificationType, "platform"),
                eq(userCertifications.isCertificationTrack, true)
              )
            )
          )
        ),
    ]);

    const completed = certs.filter((c) => c.status === "completed" && c.completedAt);
    const best =
      completed[0] ??
      certs.find((c) => c.status === "in_progress") ??
      certs[0] ??
      null;

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.json({
      phase1Complete: progression.phase1.complete,
      proCareCertificationComplete: progression.proCare.complete,
      certification: best
        ? {
            status: best.status,
            completedAt: best.completedAt ?? null,
            certificationType: best.certificationType,
            score: best.score ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("[Cert] phase1-status error:", err);
    return res.status(500).json({ error: "Failed to check Phase 1 status" });
  }
});

router.get("/academy-progression", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.json(await getAcademyProgression(userId));
  } catch (err) {
    console.error("[Cert] academy progression error:", err);
    return res.status(500).json({ error: "Failed to load Academy progression" });
  }
});

// ─── DYNAMIC ROUTES ───────────────────────────────────────────────────────────

// GET /api/certifications/:certType/progress
router.get("/:certType/progress", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { certType } = req.params;
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    const storedProgress = await db
      .select()
      .from(certificationModuleProgress)
      .where(
        and(
          eq(certificationModuleProgress.userId, userId),
          eq(
            certificationModuleProgress.certificationType,
            course?.storageCertType ?? certType,
          ),
        ),
      );
    const moduleProgress = course?.isProCare
      ? filterProCareProgress(storedProgress)
      : storedProgress;
    const certification = course?.isProCare
      ? await findProCareCertificateForDisplay(
          userId,
          certType,
          moduleProgress,
        )
      : await findCertificateForDisplay(userId, certType);

    // Never cache this response — module status changes after every quiz
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.json({
      certification: certification ?? null,
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

    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    const progress = course?.isProCare
      ? filterProCareProgress(
          await db
            .select()
            .from(certificationModuleProgress)
            .where(
              and(
                eq(certificationModuleProgress.userId, userId),
                eq(
                  certificationModuleProgress.certificationType,
                  course.storageCertType,
                ),
              ),
            ),
        )
      : [];
    const cert = course?.isProCare
      ? await findProCareCertificateForDisplay(userId, certType, progress)
      : await findCertificateForDisplay(userId, certType);

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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    if (
      course?.isProCare &&
      ![
        ...PROCARE_QUIZ_MODULE_IDS,
        PROCARE_FINAL_ASSESSMENT_ID,
      ].includes(moduleId as any)
    ) {
      return res.status(404).json({ error: "ProCare assessment not found" });
    }

    const [attempt] = await db
      .select()
      .from(certificationQuizAttempts)
      .where(
        and(
          eq(certificationQuizAttempts.userId, userId),
          eq(
            certificationQuizAttempts.certificationType,
            course?.storageCertType ?? certType,
          ),
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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    if (
      course?.isProCare &&
      ![
        ...PROCARE_QUIZ_MODULE_IDS,
        PROCARE_FINAL_ASSESSMENT_ID,
      ].includes(moduleId as any)
    ) {
      return res.status(404).json({ error: "ProCare assessment not found" });
    }

    if (!questionId || answerIndex === undefined) {
      return res.status(400).json({ error: "questionId and answerIndex required" });
    }

    const answerPatch = JSON.stringify({ [questionId]: answerIndex });

    await db
      .insert(certificationQuizAttempts)
      .values({
        userId,
        certificationType: course?.storageCertType ?? certType,
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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    if (
      course?.isProCare &&
      ![
        ...PROCARE_QUIZ_MODULE_IDS,
        PROCARE_FINAL_ASSESSMENT_ID,
      ].includes(moduleId as any)
    ) {
      return res.status(404).json({ error: "ProCare assessment not found" });
    }

    await db
      .delete(certificationQuizAttempts)
      .where(
        and(
          eq(certificationQuizAttempts.userId, userId),
          eq(
            certificationQuizAttempts.certificationType,
            course?.storageCertType ?? certType,
          ),
          eq(certificationQuizAttempts.moduleId, moduleId),
          eq(certificationQuizAttempts.status, "in_progress"),
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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    if (
      course?.isProCare &&
      !(PROCARE_REQUIRED_SEQUENCE as readonly string[]).includes(moduleId)
    ) {
      return res.status(404).json({ error: "ProCare module not found" });
    }

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: course?.storageCertType ?? certType,
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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    if (course?.isProCare) {
      return res.status(400).json({
        error:
          "ProCare quiz results must be evaluated by the server assessment endpoint",
      });
    }

    const status = passed ? "completed" : "quiz_failed";

    await db
      .insert(certificationModuleProgress)
      .values({
        userId,
        certificationType: course?.storageCertType ?? certType,
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
    const course = DB_DRIVEN_CERT_TYPES.includes(certType)
      ? await resolveCertificationCourse(certType)
      : null;
    const storageCertType = course?.storageCertType ?? certType;
    const certificateWriteType =
      certType === PROCARE_CERTIFICATION_TYPE
        ? PROCARE_CERTIFICATION_TYPE
        : storageCertType;

    const storedProgress = await db
      .select()
      .from(certificationModuleProgress)
      .where(
        and(
          eq(certificationModuleProgress.userId, userId),
          eq(certificationModuleProgress.certificationType, storageCertType),
        )
      );
    const relevantProgress = course?.isProCare
      ? filterProCareProgress(storedProgress)
      : storedProgress;
    const completedModules = relevantProgress.filter(
      (module) => module.status === "completed",
    );

    if (completedModules.length === 0) {
      return res.status(400).json({ error: "No completed modules found" });
    }

    if (course?.isProCare) {
      const integrity = validateProCareCertificationProgress(relevantProgress);
      if (!integrity.complete) {
        return res.status(400).json({
          error:
            "Complete all ProCare videos, module quizzes, and the final assessment before certification",
          missingModules: integrity.missing,
        });
      }
    }

    if (certType === "marketing_coaching") {
      const completedIds = new Set(completedModules.map((module) => module.moduleId));
      const missing = MARKETING_COACHING_MODULE_IDS.filter(
        (moduleId) => !completedIds.has(moduleId),
      );
      const progression = await getAcademyProgression(userId);
      if (missing.length > 0 && !progression.phase2.complete) {
        return res.status(400).json({
          error: "Complete all Marketing & Coaching modules before certification",
          missingModules: missing,
        });
      }

      if (!progression.phase1.complete) {
        return res.status(400).json({
          error: "Complete Platform Mastery before claiming the Specialist credential",
        });
      }
    }

    const scoredModules = course?.isProCare
      ? completedModules.filter((module) =>
          [
            ...PROCARE_QUIZ_MODULE_IDS,
            PROCARE_FINAL_ASSESSMENT_ID,
          ].includes(module.moduleId as any),
        )
      : completedModules;
    const avgScore = Math.round(
      scoredModules.reduce((acc, m) => acc + (m.score ?? 0), 0) /
        scoredModules.length
    );

    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCertNumber =
      certType === PROCARE_CERTIFICATION_TYPE
        ? `MPM-PRO-${year}-${random}`
        : `MPM-AFF-${year}-${random}`;

    // Deterministic upsert — unique constraint on (user_id, certification_type)
    // On conflict: only update name if it was previously null; never overwrite cert number or completedAt
    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: certificateWriteType,
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

    // The canonical three-video course is now the ProCare training authority.
    // Keep the existing readiness flag in sync so Studio provisioning can
    // continue to enforce training completion without using the retired page.
    if (certType === PROCARE_CERTIFICATION_TYPE) {
      await db
        .update(users)
        .set({ procareTrainingCompleted: true })
        .where(eq(users.id, userId));
    }

    const [existing] = await db
      .select()
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          eq(userCertifications.certificationType, certificateWriteType)
        )
      )
      .limit(1);

    const finalCertNumber = existing?.certificateNumber ?? newCertNumber;

    let specialistCertificateNumber: string | null = null;
    if (certType === "marketing_coaching") {
      const specialistNumber = `MPM-SPC-${year}-${random}`;
      await db
        .insert(userCertifications)
        .values({
          userId,
          certificationType: SPECIALIST_CERTIFICATION_TYPE,
          status: "completed",
          score: avgScore,
          completedAt: new Date(),
          certificateNumber: specialistNumber,
          certificateName: certificateName ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userCertifications.userId, userCertifications.certificationType],
          set: {
            certificateName: certificateName
              ? sql`CASE WHEN ${userCertifications.certificateName} IS NULL THEN ${certificateName}::text ELSE ${userCertifications.certificateName} END`
              : sql`${userCertifications.certificateName}`,
            updatedAt: new Date(),
          },
        });
      const [specialist] = await db
        .select({ certificateNumber: userCertifications.certificateNumber })
        .from(userCertifications)
        .where(
          and(
            eq(userCertifications.userId, userId),
            eq(userCertifications.certificationType, SPECIALIST_CERTIFICATION_TYPE),
          ),
        )
        .limit(1);
      specialistCertificateNumber =
        specialist?.certificateNumber ?? specialistNumber;
    }

    if (!emailServiceAvailable()) {
      console.warn(`[Cert] Email service not configured — completion email skipped for userId=${userId} certType=${certificateWriteType}`);
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
            certType: certificateWriteType,
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

    return res.json({
      ok: true,
      certificateNumber: finalCertNumber,
      specialistCertificateNumber,
      score: avgScore,
    });
  } catch (err) {
    console.error("[Cert] complete error:", err);
    return res.status(500).json({ error: "Failed to complete certification" });
  }
});

export default router;
