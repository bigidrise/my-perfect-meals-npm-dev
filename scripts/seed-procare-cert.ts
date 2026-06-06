import { db } from "../server/db";
import { eq, inArray } from "drizzle-orm";
import { certModules, certQuestions, certQuestionOptions } from "../server/db/schema/lms";

const certType = "platform";
const MODULE1_VIDEO_URL = "https://youtu.be/1B16XojirXA";

async function seed() {
  console.log("Checking existing platform cert modules...");
  const existing = await db
    .select({ id: certModules.id, slug: certModules.slug })
    .from(certModules)
    .where(eq(certModules.certType, certType));
  console.log("Existing modules:", existing.map((m) => m.slug).join(", ") || "(none)");

  if (existing.length > 0) {
    console.log("Force-clearing existing data...");
    const existingQs = await db
      .select({ id: certQuestions.id })
      .from(certQuestions)
      .where(eq(certQuestions.certType, certType));
    if (existingQs.length > 0) {
      await db.delete(certQuestionOptions).where(
        inArray(certQuestionOptions.questionId, existingQs.map((q) => q.id))
      );
      await db.delete(certQuestions).where(eq(certQuestions.certType, certType));
    }
    await db.delete(certModules).where(eq(certModules.certType, certType));
    console.log("Cleared.");
  }

  console.log("Inserting modules...");
  await db.insert(certModules).values([
    {
      certType,
      slug: "module-1",
      title: "ProCare Certification Module 1",
      description: "Dashboard, Client Invitations, and Client Folder Access",
      moduleType: "video",
      sortOrder: 1,
      videoUrl: MODULE1_VIDEO_URL,
      passingScorePct: 80,
      questionLimit: 0,
    },
    {
      certType,
      slug: "quiz-1",
      title: "Module 1 Knowledge Check",
      description: "10 questions — score 80% or higher to advance",
      moduleType: "quiz",
      sortOrder: 2,
      passingScorePct: 80,
      questionLimit: 10,
      videoUrl: "",
    },
    {
      certType,
      slug: "module-2",
      title: "ProCare Certification Module 2",
      description: "Coming soon — locked until Module 1 is complete",
      moduleType: "video",
      sortOrder: 3,
      videoUrl: "",
      passingScorePct: 80,
      questionLimit: 0,
    },
    {
      certType,
      slug: "module-3",
      title: "ProCare Certification Module 3",
      description: "Coming soon — locked until Module 2 is complete",
      moduleType: "video",
      sortOrder: 4,
      videoUrl: "",
      passingScorePct: 80,
      questionLimit: 0,
    },
  ]);
  console.log("  ✓ 4 modules inserted");

  type Q = { moduleSlug: string; questionText: string; options: { text: string; isCorrect: boolean }[] };
  const questions: Q[] = [
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

  console.log("Inserting 10 quiz questions...");
  for (let i = 0; i < questions.length; i++) {
    const qd = questions[i];
    const [q] = await db
      .insert(certQuestions)
      .values({ certType, moduleSlug: qd.moduleSlug, questionText: qd.questionText, sortOrder: i })
      .returning();
    await db.insert(certQuestionOptions).values(
      qd.options.map((o, j) => ({
        questionId: q.id,
        optionText: o.text,
        isCorrect: o.isCorrect,
        sortOrder: j,
      }))
    );
    console.log(`  ✓ Q${i + 1}: ${qd.questionText.substring(0, 60)}...`);
  }

  console.log("\n✅ ProCare Certification Module 1 seeded successfully.");
  console.log(`   Video URL: ${MODULE1_VIDEO_URL}`);
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
