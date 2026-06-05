import express from "express";
import { db } from "../db";
import { eq, and, asc } from "drizzle-orm";
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
    if (certType !== "platform" && certType !== "business_success") {
      return res.status(400).json({ error: "Only 'platform' and 'business_success' can be seeded" });
    }

    const existing = await db.select({ id: certModules.id }).from(certModules).where(eq(certModules.certType, certType)).limit(1);
    if (existing.length > 0) {
      return res.json({ ok: true, message: "Already seeded — use admin panel to edit content" });
    }

    if (certType === "platform") {
      const moduleSeed = [
        { slug: "video-1", title: "Dashboard Overview", description: "Dashboard → Business Center → ProCare Studio → Provider Dashboard", moduleType: "video", sortOrder: 1 },
        { slug: "quiz-1", title: "Dashboard Overview Quiz", description: "5 questions — 80% to advance", moduleType: "quiz", sortOrder: 2, passingScorePct: 80, questionLimit: 5 },
        { slug: "video-2", title: "Provider Dashboard & Client Management", description: "Provider Dashboard → Client Management → Folder Sections → Client Dashboard", moduleType: "video", sortOrder: 3 },
        { slug: "quiz-2", title: "Client Management Quiz", description: "5 questions — 80% to advance", moduleType: "quiz", sortOrder: 4, passingScorePct: 80, questionLimit: 5 },
        { slug: "video-3", title: "Client Dashboard & Meal Creation", description: "Client Dashboard → Scheduling → Meal Builders → AI Creative Chef → Creating and Sending Meals", moduleType: "video", sortOrder: 5 },
        { slug: "quiz-3", title: "Meal Creation Quiz", description: "5 questions — 80% to advance", moduleType: "quiz", sortOrder: 6, passingScorePct: 80, questionLimit: 5 },
        { slug: "final", title: "Final Assessment", description: "20 questions from all three modules — 80% (16/20) to pass", moduleType: "final_assessment", sortOrder: 7, passingScorePct: 80, questionLimit: 20 },
      ];
      await db.insert(certModules).values(moduleSeed.map((m) => ({ ...m, certType })));

      type QuestionSeed = { moduleSlug: string; questionText: string; options: { text: string; isCorrect: boolean }[] };
      const questionSeed: QuestionSeed[] = [
        // Quiz 1 — Video 1
        { moduleSlug: "quiz-1", questionText: "What is the primary purpose of the Business Center?", options: [
          { text: "Track personal health goals", isCorrect: false },
          { text: "Access coaching tools and business management features", isCorrect: true },
          { text: "Create meal plans for clients", isCorrect: false },
          { text: "Manage billing only", isCorrect: false },
        ]},
        { moduleSlug: "quiz-1", questionText: "Which area of the platform is used to access coaching tools and client management?", options: [
          { text: "Meal Builder", isCorrect: false },
          { text: "Biometrics", isCorrect: false },
          { text: "ProCare Studio", isCorrect: true },
          { text: "Profile Settings", isCorrect: false },
        ]},
        { moduleSlug: "quiz-1", questionText: "What is the first step a provider takes before working with clients inside ProCare?", options: [
          { text: "Create a meal plan", isCorrect: false },
          { text: "Set up the Provider Dashboard", isCorrect: true },
          { text: "Add billing details", isCorrect: false },
          { text: "Complete a quiz", isCorrect: false },
        ]},
        { moduleSlug: "quiz-1", questionText: "True or False: The Provider Dashboard is where coaches manage client relationships and nutrition workflows.", options: [
          { text: "True", isCorrect: true },
          { text: "False", isCorrect: false },
        ]},
        { moduleSlug: "quiz-1", questionText: "Why is it important to understand the dashboard before working with clients?", options: [
          { text: "It is required by law", isCorrect: false },
          { text: "It ensures providers can navigate the platform efficiently to support clients", isCorrect: true },
          { text: "It unlocks additional meal templates", isCorrect: false },
          { text: "It is optional", isCorrect: false },
        ]},
        // Quiz 2 — Video 2
        { moduleSlug: "quiz-2", questionText: "What is the purpose of the client management area?", options: [
          { text: "To manage billing", isCorrect: false },
          { text: "To organize and review information for each individual client", isCorrect: true },
          { text: "To create AI meal plans", isCorrect: false },
          { text: "To send marketing emails", isCorrect: false },
        ]},
        { moduleSlug: "quiz-2", questionText: "Where can a provider review information related to a specific client?", options: [
          { text: "In the Business Center settings", isCorrect: false },
          { text: "In the individual client's dashboard", isCorrect: true },
          { text: "In the admin portal", isCorrect: false },
          { text: "On the home screen", isCorrect: false },
        ]},
        { moduleSlug: "quiz-2", questionText: "True or False: A provider must connect with a client before accessing the client dashboard.", options: [
          { text: "True", isCorrect: true },
          { text: "False", isCorrect: false },
        ]},
        { moduleSlug: "quiz-2", questionText: "What is the benefit of keeping client information organized within the platform?", options: [
          { text: "It speeds up AI meal generation", isCorrect: false },
          { text: "It allows providers to quickly access and act on each client's data", isCorrect: true },
          { text: "It automatically sends reports", isCorrect: false },
          { text: "It reduces subscription costs", isCorrect: false },
        ]},
        { moduleSlug: "quiz-2", questionText: "What action takes you from the provider workspace into an individual client's dashboard?", options: [
          { text: "Clicking 'New Meal Plan'", isCorrect: false },
          { text: "Searching the meal library", isCorrect: false },
          { text: "Opening the specific client from the client management area", isCorrect: true },
          { text: "Logging biometrics", isCorrect: false },
        ]},
        // Quiz 3 — Video 3
        { moduleSlug: "quiz-3", questionText: "What is the purpose of the client dashboard?", options: [
          { text: "To manage the provider's billing", isCorrect: false },
          { text: "To give the provider a centralized view of a client's health and nutrition data", isCorrect: true },
          { text: "To create new provider accounts", isCorrect: false },
          { text: "To access global settings", isCorrect: false },
        ]},
        { moduleSlug: "quiz-3", questionText: "Where can providers schedule activities and follow-up actions for clients?", options: [
          { text: "In the Business Center", isCorrect: false },
          { text: "In the Scheduling section of the client dashboard", isCorrect: true },
          { text: "In the Meal Builder", isCorrect: false },
          { text: "In the profile settings", isCorrect: false },
        ]},
        { moduleSlug: "quiz-3", questionText: "Which tool is used to create customized meals for a client?", options: [
          { text: "The Shopping List", isCorrect: false },
          { text: "The Meal Builder", isCorrect: true },
          { text: "The Progress Tracker", isCorrect: false },
          { text: "The Biometrics Chart", isCorrect: false },
        ]},
        { moduleSlug: "quiz-3", questionText: "True or False: The AI Creative Chef helps generate meal options based on client information and preferences.", options: [
          { text: "True", isCorrect: true },
          { text: "False", isCorrect: false },
        ]},
        { moduleSlug: "quiz-3", questionText: "What is the final step after creating a meal before it becomes available to the client?", options: [
          { text: "Printing the meal plan", isCorrect: false },
          { text: "Sending or saving the meal to the client's board", isCorrect: true },
          { text: "Adjusting the macro targets", isCorrect: false },
          { text: "Reloading the page", isCorrect: false },
        ]},
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
