import { db } from "../server/db";
import { eq, inArray } from "drizzle-orm";
import { certModules, certQuestions, certQuestionOptions } from "../server/db/schema/lms";

const certType = "platform";

const MODULES = [
  {
    certType,
    slug: "module-1",
    title: "ProCare Certification Module 1",
    description: "Dashboard, Client Invitations, and Client Folder Access",
    moduleType: "video" as const,
    sortOrder: 1,
    videoUrl: "https://youtu.be/1B16XojirXA",
    passingScorePct: 80,
    questionLimit: 0,
  },
  {
    certType,
    slug: "quiz-1",
    title: "Module 1 Knowledge Check",
    description: "10 questions — score 80% or higher to advance",
    moduleType: "quiz" as const,
    sortOrder: 2,
    videoUrl: "",
    passingScorePct: 80,
    questionLimit: 10,
  },
  {
    certType,
    slug: "module-2",
    title: "ProCare Certification Module 2",
    description: "Understanding the Client Folder",
    moduleType: "video" as const,
    sortOrder: 3,
    videoUrl: "https://youtu.be/FHnag5UVwCc",
    passingScorePct: 80,
    questionLimit: 0,
  },
  {
    certType,
    slug: "quiz-2",
    title: "Module 2 Knowledge Check",
    description: "10 questions — score 80% or higher to advance",
    moduleType: "quiz" as const,
    sortOrder: 4,
    videoUrl: "",
    passingScorePct: 80,
    questionLimit: 10,
  },
  {
    certType,
    slug: "module-3",
    title: "ProCare Certification Module 3",
    description: "Client Dashboard & Shared Meal Builder",
    moduleType: "video" as const,
    sortOrder: 5,
    videoUrl: "https://youtu.be/4KoJqfGHZ48",
    passingScorePct: 80,
    questionLimit: 0,
  },
  {
    certType,
    slug: "quiz-3",
    title: "Module 3 Knowledge Check",
    description: "10 questions — score 80% or higher to advance",
    moduleType: "quiz" as const,
    sortOrder: 6,
    videoUrl: "",
    passingScorePct: 80,
    questionLimit: 10,
  },
];

type Q = { moduleSlug: string; questionText: string; options: { text: string; isCorrect: boolean }[] };

const QUESTIONS: Q[] = [
  // ── Quiz 1 ─────────────────────────────────────────────────────────────────
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

  // ── Quiz 2 ─────────────────────────────────────────────────────────────────
  {
    moduleSlug: "quiz-2",
    questionText: "What is the primary purpose of the Client Folder?",
    options: [
      { text: "Store grocery lists only", isCorrect: false },
      { text: "Serve as the central hub for managing and supporting a client", isCorrect: true },
      { text: "Create marketing campaigns", isCorrect: false },
      { text: "Process payments", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "What type of information can typically be accessed from a Client Folder?",
    options: [
      { text: "Client profile and nutrition-related information", isCorrect: true },
      { text: "Only meal plans", isCorrect: false },
      { text: "Only billing information", isCorrect: false },
      { text: "Only workout programs", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "Why is it important to review a client's information before making recommendations?",
    options: [
      { text: "To provide more personalized support", isCorrect: true },
      { text: "To increase app speed", isCorrect: false },
      { text: "To reduce storage usage", isCorrect: false },
      { text: "To unlock features", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "The Client Folder is designed to help coaches and providers:",
    options: [
      { text: "Replace client communication", isCorrect: false },
      { text: "Better organize and support client progress", isCorrect: true },
      { text: "Sell subscriptions", isCorrect: false },
      { text: "Create advertisements", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "What should you do if client information appears incomplete?",
    options: [
      { text: "Ignore it", isCorrect: false },
      { text: "Make assumptions", isCorrect: false },
      { text: "Verify information with the client before making recommendations", isCorrect: true },
      { text: "Delete the account", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "Why is organization important when managing multiple clients?",
    options: [
      { text: "It helps provide more consistent support", isCorrect: true },
      { text: "It increases app pricing", isCorrect: false },
      { text: "It reduces login requirements", isCorrect: false },
      { text: "It changes meal generation", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "What is one benefit of having client information centralized in a folder?",
    options: [
      { text: "Easier access to relevant client information", isCorrect: true },
      { text: "Faster internet speed", isCorrect: false },
      { text: "Lower subscription costs", isCorrect: false },
      { text: "More advertisements", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "The Client Folder is intended to support:",
    options: [
      { text: "Long-term client management and accountability", isCorrect: true },
      { text: "Only meal creation", isCorrect: false },
      { text: "Social media posting", isCorrect: false },
      { text: "Affiliate recruiting", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "Before making changes to a client's plan, you should:",
    options: [
      { text: "Review available client information", isCorrect: true },
      { text: "Guess what they need", isCorrect: false },
      { text: "Skip directly to meal creation", isCorrect: false },
      { text: "Create random recommendations", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-2",
    questionText: "What is the overall goal of the Client Folder?",
    options: [
      { text: "To help professionals provide better client support through organized information and tools", isCorrect: true },
      { text: "To replace coaching", isCorrect: false },
      { text: "To eliminate communication", isCorrect: false },
      { text: "To automate all decisions", isCorrect: false },
    ],
  },

  // ── Quiz 3 ─────────────────────────────────────────────────────────────────
  {
    moduleSlug: "quiz-3",
    questionText: "What is the purpose of the Client Dashboard?",
    options: [
      { text: "To provide a central view of client activity and information", isCorrect: true },
      { text: "To create advertisements", isCorrect: false },
      { text: "To process payments", isCorrect: false },
      { text: "To manage social media", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "What is the primary purpose of the Shared Meal Builder?",
    options: [
      { text: "To collaborate with clients on meal planning and nutrition support", isCorrect: true },
      { text: "To create invoices", isCorrect: false },
      { text: "To build workout programs only", isCorrect: false },
      { text: "To manage subscriptions", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "When a provider creates a meal using the Shared Meal Builder, the goal is to:",
    options: [
      { text: "Support the client's nutrition plan", isCorrect: true },
      { text: "Replace client decision-making", isCorrect: false },
      { text: "Increase app usage only", isCorrect: false },
      { text: "Eliminate communication", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "Why is shared meal planning valuable?",
    options: [
      { text: "It creates a more collaborative coaching experience", isCorrect: true },
      { text: "It reduces account security", isCorrect: false },
      { text: "It removes accountability", isCorrect: false },
      { text: "It replaces client participation", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "What should a provider consider before sharing a meal with a client?",
    options: [
      { text: "The client's goals, preferences, and needs", isCorrect: true },
      { text: "Only the provider's preferences", isCorrect: false },
      { text: "Current marketing campaigns", isCorrect: false },
      { text: "Subscription pricing", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "The Client Dashboard helps providers:",
    options: [
      { text: "Monitor and support client progress", isCorrect: true },
      { text: "Build websites", isCorrect: false },
      { text: "Process payroll", isCorrect: false },
      { text: "Create advertisements", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "What is one benefit of sharing meals directly with clients?",
    options: [
      { text: "Improved communication and accountability", isCorrect: true },
      { text: "Increased login requirements", isCorrect: false },
      { text: "Reduced personalization", isCorrect: false },
      { text: "Less engagement", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "The Shared Meal Builder is designed to:",
    options: [
      { text: "Help providers create and share nutrition solutions with clients", isCorrect: true },
      { text: "Replace coaching relationships", isCorrect: false },
      { text: "Remove personalization", isCorrect: false },
      { text: "Limit client options", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "Successful use of the Shared Meal Builder requires:",
    options: [
      { text: "Understanding the client's goals and preferences", isCorrect: true },
      { text: "Ignoring client feedback", isCorrect: false },
      { text: "Sharing the same meals with everyone", isCorrect: false },
      { text: "Focusing only on calories", isCorrect: false },
    ],
  },
  {
    moduleSlug: "quiz-3",
    questionText: "What is the overall objective of the Client Dashboard and Shared Meal Builder?",
    options: [
      { text: "To improve collaboration between providers and clients", isCorrect: true },
      { text: "To replace communication", isCorrect: false },
      { text: "To eliminate personalization", isCorrect: false },
      { text: "To automate every coaching decision", isCorrect: false },
    ],
  },
];

async function seed() {
  console.log("Checking existing platform cert modules...");
  const existing = await db
    .select({ id: certModules.id, slug: certModules.slug })
    .from(certModules)
    .where(eq(certModules.certType, certType));
  console.log("Existing modules:", existing.map((m) => m.slug).join(", ") || "(none)");

  if (existing.length > 0) {
    console.log("Clearing existing data...");
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

  console.log("Inserting 6 modules...");
  await db.insert(certModules).values(MODULES);
  console.log("  ✓ module-1 (video) — https://youtu.be/1B16XojirXA");
  console.log("  ✓ quiz-1   (quiz)");
  console.log("  ✓ module-2 (video) — https://youtu.be/FHnag5UVwCc");
  console.log("  ✓ quiz-2   (quiz)");
  console.log("  ✓ module-3 (video) — https://youtu.be/4KoJqfGHZ48");
  console.log("  ✓ quiz-3   (quiz)");

  console.log("\nInserting 30 quiz questions...");
  let count = 0;
  for (let i = 0; i < QUESTIONS.length; i++) {
    const qd = QUESTIONS[i];
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
    count++;
    console.log(`  ✓ [${qd.moduleSlug}] Q${count}: ${qd.questionText.substring(0, 55)}...`);
  }

  console.log("\n✅ ProCare Certification fully seeded:");
  console.log("   Module 1 → Quiz 1 → Module 2 → Quiz 2 → Module 3 → Quiz 3");
  console.log("   30 questions total, 80% passing score each.");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
