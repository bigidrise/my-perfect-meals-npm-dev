import express from "express";
import { db } from "../db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { users } from "../../shared/schema";
import {
  certModules,
  certQuestions,
  certQuestionOptions,
  lmsUpdateModules,
} from "../db/schema/lms";
import {
  userCertifications,
  certificationModuleProgress,
} from "../db/schema/certifications";

const router = express.Router();

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, authReq.authUser.id)).limit(1);
  if (!user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

router.use(requireAuth, requireAdmin);

// ─── CERT MODULES ─────────────────────────────────────────────────────────────

router.get("/modules/:certType", async (req, res) => {
  try {
    const { certType } = req.params;
    const modules = await db
      .select()
      .from(certModules)
      .where(eq(certModules.certType, certType))
      .orderBy(asc(certModules.sortOrder));
    return res.json({ modules });
  } catch (err) {
    console.error("[AdminCert] modules GET error:", err);
    return res.status(500).json({ error: "Failed to fetch modules" });
  }
});

router.post("/modules", async (req, res) => {
  try {
    const { certType, slug, title, description, moduleType, videoUrl, sortOrder, passingScorePct, questionLimit } = req.body;
    if (!certType || !slug || !title || !moduleType) {
      return res.status(400).json({ error: "certType, slug, title, moduleType required" });
    }
    const [created] = await db.insert(certModules).values({
      certType, slug, title, description, moduleType, videoUrl,
      sortOrder: sortOrder ?? 0,
      passingScorePct: passingScorePct ?? 80,
      questionLimit: questionLimit ?? 5,
    }).returning();
    return res.json({ module: created });
  } catch (err) {
    console.error("[AdminCert] module POST error:", err);
    return res.status(500).json({ error: "Failed to create module" });
  }
});

router.put("/modules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, sortOrder, passingScorePct, questionLimit, isActive } = req.body;
    const [updated] = await db
      .update(certModules)
      .set({ title, description, videoUrl, sortOrder, passingScorePct, questionLimit, isActive })
      .where(eq(certModules.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Module not found" });
    return res.json({ module: updated });
  } catch (err) {
    console.error("[AdminCert] module PUT error:", err);
    return res.status(500).json({ error: "Failed to update module" });
  }
});

router.delete("/modules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(certModules).where(eq(certModules.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AdminCert] module DELETE error:", err);
    return res.status(500).json({ error: "Failed to delete module" });
  }
});

// ─── CERT QUESTIONS ───────────────────────────────────────────────────────────

router.get("/questions/:certType", async (req, res) => {
  try {
    const { certType } = req.params;
    const questions = await db
      .select()
      .from(certQuestions)
      .where(eq(certQuestions.certType, certType))
      .orderBy(asc(certQuestions.moduleSlug), asc(certQuestions.sortOrder));

    const questionIds = questions.map((q) => q.id);
    let options: typeof certQuestionOptions.$inferSelect[] = [];
    if (questionIds.length > 0) {
      options = await db
        .select()
        .from(certQuestionOptions)
        .where(sql`${certQuestionOptions.questionId} = ANY(${sql`ARRAY[${sql.join(questionIds.map((id) => sql`${id}::uuid`), sql`, `)}]`})`);
    }

    const optionsByQuestion = options.reduce<Record<string, typeof certQuestionOptions.$inferSelect[]>>((acc, opt) => {
      const key = opt.questionId as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(opt);
      return acc;
    }, {});

    const result = questions.map((q) => ({
      ...q,
      options: (optionsByQuestion[q.id] ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    return res.json({ questions: result });
  } catch (err) {
    console.error("[AdminCert] questions GET error:", err);
    return res.status(500).json({ error: "Failed to fetch questions" });
  }
});

router.post("/questions", async (req, res) => {
  try {
    const { certType, moduleSlug, questionText, sortOrder, options } = req.body as {
      certType: string;
      moduleSlug: string;
      questionText: string;
      sortOrder?: number;
      options?: Array<{ text: string; isCorrect: boolean }>;
    };
    if (!certType || !moduleSlug || !questionText) {
      return res.status(400).json({ error: "certType, moduleSlug, questionText required" });
    }
    const [question] = await db.insert(certQuestions).values({
      certType, moduleSlug, questionText, sortOrder: sortOrder ?? 0,
    }).returning();

    if (options && options.length > 0) {
      await db.insert(certQuestionOptions).values(
        options.map((o, i) => ({
          questionId: question.id,
          optionText: o.text,
          isCorrect: o.isCorrect,
          sortOrder: i,
        }))
      );
    }

    return res.json({ question });
  } catch (err) {
    console.error("[AdminCert] question POST error:", err);
    return res.status(500).json({ error: "Failed to create question" });
  }
});

router.put("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { questionText, isActive, sortOrder } = req.body;
    const [updated] = await db
      .update(certQuestions)
      .set({ questionText, isActive, sortOrder })
      .where(eq(certQuestions.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Question not found" });
    return res.json({ question: updated });
  } catch (err) {
    console.error("[AdminCert] question PUT error:", err);
    return res.status(500).json({ error: "Failed to update question" });
  }
});

router.delete("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(certQuestionOptions).where(eq(certQuestionOptions.questionId, id));
    await db.delete(certQuestions).where(eq(certQuestions.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AdminCert] question DELETE error:", err);
    return res.status(500).json({ error: "Failed to delete question" });
  }
});

// ─── QUESTION OPTIONS ─────────────────────────────────────────────────────────

router.post("/questions/:questionId/options", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { optionText, isCorrect, sortOrder } = req.body;
    if (!optionText) return res.status(400).json({ error: "optionText required" });
    const [opt] = await db.insert(certQuestionOptions).values({
      questionId, optionText, isCorrect: isCorrect ?? false, sortOrder: sortOrder ?? 0,
    }).returning();
    return res.json({ option: opt });
  } catch (err) {
    console.error("[AdminCert] option POST error:", err);
    return res.status(500).json({ error: "Failed to create option" });
  }
});

router.put("/options/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { optionText, isCorrect, sortOrder } = req.body;
    const [updated] = await db
      .update(certQuestionOptions)
      .set({ optionText, isCorrect, sortOrder })
      .where(eq(certQuestionOptions.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Option not found" });
    return res.json({ option: updated });
  } catch (err) {
    console.error("[AdminCert] option PUT error:", err);
    return res.status(500).json({ error: "Failed to update option" });
  }
});

router.delete("/options/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(certQuestionOptions).where(eq(certQuestionOptions.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AdminCert] option DELETE error:", err);
    return res.status(500).json({ error: "Failed to delete option" });
  }
});

// ─── SEED PLATFORM CERT ───────────────────────────────────────────────────────

router.post("/seed/:certType", async (req, res) => {
  try {
    const { certType } = req.params;
    const force = req.query.force === "true";

    if (certType !== "platform" && certType !== "business_success") {
      return res.status(400).json({ error: "Only 'platform' and 'business_success' can be seeded" });
    }

    const existing = await db.select({ id: certModules.id }).from(certModules).where(eq(certModules.certType, certType)).limit(1);
    if (existing.length > 0 && !force) {
      return res.json({ ok: true, message: "Already seeded — use ?force=true to reseed or admin panel to edit" });
    }

    if (existing.length > 0 && force) {
      // Delete existing data for this cert type in dependency order
      const existingQs = await db.select({ id: certQuestions.id }).from(certQuestions).where(eq(certQuestions.certType, certType));
      if (existingQs.length > 0) {
        await db.delete(certQuestionOptions).where(inArray(certQuestionOptions.questionId, existingQs.map((q) => q.id)));
        await db.delete(certQuestions).where(eq(certQuestions.certType, certType));
      }
      await db.delete(certModules).where(eq(certModules.certType, certType));
    }

    type QuestionSeed = { moduleSlug: string; questionText: string; options: { text: string; isCorrect: boolean }[] };

    if (certType === "platform") {
      // Module structure: Module 1 (full), Module 2 & 3 (placeholders, locked)
      const moduleSeed = [
        {
          slug: "module-1",
          title: "ProCare Certification Module 1",
          description: "Dashboard, Client Invitations, and Client Folder Access",
          moduleType: "video",
          sortOrder: 1,
          videoUrl: "",
        },
        {
          slug: "quiz-1",
          title: "Module 1 Knowledge Check",
          description: "10 questions — score 80% or higher to advance",
          moduleType: "quiz",
          sortOrder: 2,
          passingScorePct: 80,
          questionLimit: 10,
        },
        {
          slug: "module-2",
          title: "ProCare Certification Module 2",
          description: "Coming soon — locked until Module 1 is complete",
          moduleType: "video",
          sortOrder: 3,
          videoUrl: "",
        },
        {
          slug: "module-3",
          title: "ProCare Certification Module 3",
          description: "Coming soon — locked until Module 2 is complete",
          moduleType: "video",
          sortOrder: 4,
          videoUrl: "",
        },
      ];
      await db.insert(certModules).values(moduleSeed.map((m) => ({ ...m, certType })));

      // Module 1 Knowledge Check — 10 questions from spec
      const questionSeed: QuestionSeed[] = [
        {
          moduleSlug: "quiz-1",
          questionText: "What is the primary purpose of the ProCare Dashboard?",
          options: [
            { text: "Create recipes", isCorrect: false },
            { text: "Manage and support clients", isCorrect: true },
            { text: "Build shopping lists", isCorrect: false },
            { text: "Track workouts", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "What is the first step in connecting a client to your studio?",
          options: [
            { text: "Create meal plan", isCorrect: false },
            { text: "Open client folder", isCorrect: false },
            { text: "Send invitation", isCorrect: true },
            { text: "Assign macros", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "How does a client connect to your studio?",
          options: [
            { text: "Contact support", isCorrect: false },
            { text: "Accept invitation", isCorrect: true },
            { text: "Purchase subscription", isCorrect: false },
            { text: "Complete profile", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "Where do you access client information after connection?",
          options: [
            { text: "Dashboard", isCorrect: false },
            { text: "Shopping List", isCorrect: false },
            { text: "Client Folder", isCorrect: true },
            { text: "Biometrics", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "What should you verify after sending an invitation?",
          options: [
            { text: "Client receives email", isCorrect: true },
            { text: "Client changes password", isCorrect: false },
            { text: "Client uploads photo", isCorrect: false },
            { text: "Client creates meal plan", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "What happens before you can access a client folder?",
          options: [
            { text: "Client must accept invitation", isCorrect: true },
            { text: "Client must purchase upgrade", isCorrect: false },
            { text: "Client must complete biometrics", isCorrect: false },
            { text: "Client must create recipes", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "Why is understanding the invitation process important?",
          options: [
            { text: "It connects clients to your studio", isCorrect: true },
            { text: "It changes subscription pricing", isCorrect: false },
            { text: "It creates recipes", isCorrect: false },
            { text: "It changes macros", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "Which area contains the client's information and tools?",
          options: [
            { text: "Meal Board", isCorrect: false },
            { text: "Client Folder", isCorrect: true },
            { text: "Shopping List", isCorrect: false },
            { text: "Dashboard Settings", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "What is the purpose of ProCare?",
          options: [
            { text: "Manage and support clients", isCorrect: true },
            { text: "Build websites", isCorrect: false },
            { text: "Create advertisements", isCorrect: false },
            { text: "Sell subscriptions", isCorrect: false },
          ],
        },
        {
          moduleSlug: "quiz-1",
          questionText: "What should a coach do if they are unsure how a feature works?",
          options: [
            { text: "Ignore it", isCorrect: false },
            { text: "Contact support or review training", isCorrect: true },
            { text: "Guess", isCorrect: false },
            { text: "Skip the feature", isCorrect: false },
          ],
        },
      ];

      for (let i = 0; i < questionSeed.length; i++) {
        const qData = questionSeed[i];
        const [q] = await db.insert(certQuestions).values({
          certType,
          moduleSlug: qData.moduleSlug,
          questionText: qData.questionText,
          sortOrder: i,
        }).returning();
        await db.insert(certQuestionOptions).values(
          qData.options.map((o, j) => ({
            questionId: q.id,
            optionText: o.text,
            isCorrect: o.isCorrect,
            sortOrder: j,
          }))
        );
      }
    } else if (certType === "business_success") {
      await db.insert(certModules).values([
        { certType, slug: "intro", title: "Introduction & Platform Overview", description: "Why My Perfect Meals exists and what it does", moduleType: "video", sortOrder: 1 },
        { certType, slug: "quiz-intro", title: "Introduction Quiz", moduleType: "quiz", sortOrder: 2, passingScorePct: 80, questionLimit: 5 },
        { certType, slug: "final", title: "Final Assessment", description: "Comprehensive assessment — 80% to earn certification", moduleType: "final_assessment", sortOrder: 3, passingScorePct: 80, questionLimit: 20 },
      ]);
    }

    return res.json({ ok: true, message: `${certType} cert seeded successfully` });
  } catch (err) {
    console.error("[AdminCert] seed error:", err);
    return res.status(500).json({ error: "Failed to seed certification" });
  }
});

// ─── PROGRESS REPORTING ───────────────────────────────────────────────────────

router.get("/progress", async (req, res) => {
  try {
    const { certType, limit = "50", offset = "0" } = req.query;

    const query = db
      .select({
        userId: userCertifications.userId,
        certType: userCertifications.certificationType,
        status: userCertifications.status,
        score: userCertifications.score,
        completedAt: userCertifications.completedAt,
        certificateNumber: userCertifications.certificateNumber,
        isCurrentVersion: userCertifications.isCurrentVersion,
        updatesPending: userCertifications.updatesPending,
      })
      .from(userCertifications)
      .limit(Number(limit))
      .offset(Number(offset));

    if (certType && typeof certType === "string") {
      const rows = await query.where(eq(userCertifications.certificationType, certType));
      return res.json({ progress: rows });
    }

    const rows = await query;
    return res.json({ progress: rows });
  } catch (err) {
    console.error("[AdminCert] progress GET error:", err);
    return res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// ─── LMS UPDATE MODULES ───────────────────────────────────────────────────────

router.get("/updates", async (req, res) => {
  try {
    const updates = await db.select().from(lmsUpdateModules).orderBy(asc(lmsUpdateModules.createdAt));
    return res.json({ updates });
  } catch (err) {
    console.error("[AdminCert] updates GET error:", err);
    return res.status(500).json({ error: "Failed to fetch updates" });
  }
});

router.post("/updates", async (req, res) => {
  try {
    const { title, description, videoUrl, targetRoles, isRequired, relatedCertType, releasedAt } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });
    const [update] = await db.insert(lmsUpdateModules).values({
      title, description, videoUrl,
      targetRoles: targetRoles ?? [],
      isRequired: isRequired ?? false,
      relatedCertType,
      releasedAt: releasedAt ? new Date(releasedAt) : null,
    }).returning();
    return res.json({ update });
  } catch (err) {
    console.error("[AdminCert] update POST error:", err);
    return res.status(500).json({ error: "Failed to create update" });
  }
});

router.put("/updates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, targetRoles, isRequired, relatedCertType, releasedAt } = req.body;
    const [updated] = await db
      .update(lmsUpdateModules)
      .set({ title, description, videoUrl, targetRoles, isRequired, relatedCertType, releasedAt: releasedAt ? new Date(releasedAt) : undefined })
      .where(eq(lmsUpdateModules.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Update not found" });
    return res.json({ update: updated });
  } catch (err) {
    console.error("[AdminCert] update PUT error:", err);
    return res.status(500).json({ error: "Failed to update" });
  }
});

router.delete("/updates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(lmsUpdateModules).where(eq(lmsUpdateModules.id, id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("[AdminCert] update DELETE error:", err);
    return res.status(500).json({ error: "Failed to delete update" });
  }
});

export default router;
