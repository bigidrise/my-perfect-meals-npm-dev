// server/routes/experiences.ts
// Ultimate Experiences — multi-course meal generation with 4 hard guardrails
import express, { Request, Response } from "express";
import { z } from "zod";

const router = express.Router();

type Situation = "holiday" | "camping" | "tailgating";
type CourseType = "appetizer" | "main" | "side" | "dessert";

const HOLIDAY_FLAVOR_SEEDS: Record<string, string> = {
  thanksgiving: "warm, savory, autumn harvest, comfort food",
  christmas: "festive, rich, hearty, celebratory, cozy",
  kwanzaa: "African-inspired, bold, vibrant, communal, heritage",
  hanukkah: "traditional Jewish, celebratory, golden, comforting",
  eid: "aromatic spices, celebratory, bold herbs, festive",
  passover: "traditional, Passover-appropriate, hearty, meaningful",
  "new-years": "celebratory, elegant, sophisticated, fresh start",
};

// ─────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────
const ExperienceRequest = z.object({
  situation: z.enum(["holiday", "camping", "tailgating"]),
  eventType: z.string().optional(),
  totalCourses: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  servingSize: z.number().int().min(1).max(50),
  userId: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  allergies: z.array(z.string()).optional().default([]),
});

// ─────────────────────────────────────────────
// GUARDRAIL #1 — Course count determines structure; model never decides
// ─────────────────────────────────────────────
function deriveCourses(totalCourses: 3 | 4 | 5): CourseType[] {
  if (totalCourses === 3) return ["appetizer", "main", "dessert"];
  if (totalCourses === 4) return ["appetizer", "main", "side", "dessert"];
  return ["appetizer", "main", "side", "side", "dessert"];
}

// ─────────────────────────────────────────────
// Flavor seed — per-situation, per-event
// ─────────────────────────────────────────────
function getFlavorSeed(situation: Situation, eventType?: string): string {
  if (situation === "holiday" && eventType) {
    const key = eventType.toLowerCase().replace(/\s+/g, "-");
    return HOLIDAY_FLAVOR_SEEDS[key] || "celebratory, festive, traditional";
  }
  if (situation === "camping")
    return "simple, hearty, campfire-friendly, outdoorsy, minimal equipment";
  if (situation === "tailgating")
    return "bold, shareable, crowd-pleasing, finger-food friendly, casual";
  return "flavorful, cohesive, balanced";
}

// ─────────────────────────────────────────────
// Situation-specific constraint blocks
// ─────────────────────────────────────────────
function getSituationConstraints(
  situation: Situation,
  eventType: string | undefined,
  servingSize: number,
): string {
  if (situation === "holiday") {
    return [
      `- Celebratory ${eventType || "holiday"} dish appropriate for ${servingSize} people`,
      `- Must be traditional or culturally authentic to ${eventType || "the holiday"}`,
      "- Avoid generic dishes that could belong to any meal",
      "- Flavor must complement the other courses in this experience",
    ].join("\n");
  }
  if (situation === "camping") {
    return [
      "- Must be practical for camping — minimal equipment required",
      "- Avoid dishes requiring sustained refrigeration during prep",
      "- Cooking methods: campfire, portable grill, or no-cook only",
      "- Portable and easy to transport and serve outdoors",
    ].join("\n");
  }
  return [
    `- Must be shareable and easy to serve to a group of ${servingSize}`,
    "- Bold, simple flavors that appeal to a crowd",
    "- Finger food or easy individual portions preferred",
    "- Minimal plating complexity required",
  ].join("\n");
}

// ─────────────────────────────────────────────
// GUARDRAIL #3 — Explicit course labels injected into every prompt
// Model is told exactly what course it is generating — no guessing
// ─────────────────────────────────────────────
const COURSE_LABELS: Record<CourseType, string> = {
  appetizer: "APPETIZER (light first course, starter)",
  main: "MAIN COURSE (centerpiece of the entire meal)",
  side: "SIDE DISH (complements the main course)",
  dessert: "DESSERT (sweet final course)",
};

function buildCoursePrompt(
  courseType: CourseType,
  courseIndex: number,
  courses: CourseType[],
  situation: Situation,
  eventType: string | undefined,
  servingSize: number,
  flavorSeed: string,
  strict: boolean,
): string {
  const lines = [
    `You are generating the ${COURSE_LABELS[courseType]} for a multi-course meal.`,
    ``,
    `COURSE POSITION: ${courseIndex + 1} of ${courses.length}`,
    `SITUATION: ${situation.toUpperCase()}${eventType ? ` — ${eventType.toUpperCase()}` : ""}`,
    `SERVING SIZE: ${servingSize} people`,
    `FLAVOR PROFILE SEED: ${flavorSeed}`,
    ``,
    `REQUIREMENTS:`,
    `- Generate ONLY the ${COURSE_LABELS[courseType].split(" (")[0]} — nothing else`,
    `- All dishes in this experience share the same flavor profile: ${flavorSeed}`,
    `- This dish MUST feel like part of the SAME cohesive meal, not a standalone random meal`,
    `- Portions must be sized for ${servingSize} people`,
    `- Do NOT generate an unrelated meal — this is course ${courseIndex + 1} of a ${courses.length}-course ${situation} experience`,
  ];

  if (strict) {
    lines.push(
      `- STRICT RETRY MODE: Keep the dish simple, familiar, and reliable — avoid unusual ingredients or complex techniques`,
    );
  }

  lines.push(``);
  lines.push(`SITUATION CONSTRAINTS:`);
  lines.push(getSituationConstraints(situation, eventType, servingSize));

  return lines.join("\n");
}

// ─────────────────────────────────────────────
// Course → MealType mapping (engine uses "dinner"/"snack" etc.)
// ─────────────────────────────────────────────
const COURSE_TO_MEAL_TYPE = {
  appetizer: "dinner",
  main: "dinner",
  side: "dinner",
  dessert: "snack",
} as const;

// ─────────────────────────────────────────────
// Route: POST /api/experiences/generate
// ─────────────────────────────────────────────
router.post("/generate", async (req: Request, res: Response) => {
  const parsed = ExperienceRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      issues: parsed.error.flatten().fieldErrors,
    });
  }

  const {
    situation,
    eventType,
    totalCourses,
    servingSize,
    userId,
    dietaryRestrictions: reqDiet,
    allergies: reqAllergies,
  } = parsed.data;

  // GUARDRAIL #1: Route enforces course structure
  const courses = deriveCourses(totalCourses as 3 | 4 | 5);
  const flavorProfileSeed = getFlavorSeed(situation as Situation, eventType);

  // GUARDRAIL #2: Create shared context object ONCE and reuse it
  const experienceContext = {
    id: crypto.randomUUID(),
    situation,
    eventType: eventType || null,
    totalCourses,
    servingSize,
    flavorProfileSeed,
  };

  console.log(
    `🎪 [UltimateExperience] id=${experienceContext.id} | courses=[${courses.join(",")}] | ${situation}${eventType ? `/${eventType}` : ""} | serving=${servingSize}`,
  );

  // Merge user dietary profile from DB if userId provided
  let userDiet = [...(reqDiet || [])];
  let userAllergies = [...(reqAllergies || [])];

  if (userId) {
    try {
      const { db } = await import("../db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [user] = await db
        .select({ dietaryRestrictions: users.dietaryRestrictions })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.dietaryRestrictions) {
        userDiet = [
          ...new Set([...userDiet, ...(user.dietaryRestrictions as string[])]),
        ];
      }
    } catch (err) {
      console.warn("⚠️ [UltimateExperience] Could not fetch user profile:", err);
    }
  }

  const { generateMealFromPrompt } = await import(
    "../services/universalMealGenerator"
  );

  const generatedCourses: any[] = [];

  for (let i = 0; i < courses.length; i++) {
    const courseType = courses[i];
    let courseMeal: any = null;

    // GUARDRAIL #4: Retry once per course; never lose the whole experience
    for (let attempt = 0; attempt < 2; attempt++) {
      const strict = attempt > 0;
      if (strict) {
        console.log(
          `🔄 [UltimateExperience] Retrying ${courseType} (strict mode)`,
        );
      }

      try {
        // GUARDRAIL #3: Explicit course label in every prompt — model cannot guess
        const coursePrompt = buildCoursePrompt(
          courseType,
          i,
          courses,
          situation as Situation,
          eventType,
          servingSize,
          experienceContext.flavorProfileSeed,
          strict,
        );

        const meal = await generateMealFromPrompt(
          coursePrompt,
          COURSE_TO_MEAL_TYPE[courseType],
          {
            userId,
            dietaryRestrictions: userDiet,
            allergies: userAllergies,
            mealTypes: ["dinner"],
            medicalFlags: [],
            skipPalate: true, // shared meal — neutral seasoning, not personalized
          },
        );

        courseMeal = {
          ...meal,
          courseType,
          courseLabel:
            courseType.charAt(0).toUpperCase() + courseType.slice(1),
          servings: servingSize,
        };

        console.log(
          `✅ [UltimateExperience] ${courseType} (${i + 1}/${courses.length}): "${meal.name}"`,
        );
        break; // success — exit retry loop
      } catch (err) {
        console.error(
          `❌ [UltimateExperience] ${courseType} attempt ${attempt + 1} failed:`,
          err,
        );
      }
    }

    // GUARDRAIL #4 hard fallback — never expose "something went wrong" to the user
    if (!courseMeal) {
      console.warn(
        `⚠️ [UltimateExperience] Both attempts failed for ${courseType} — using minimal fallback`,
      );
      courseMeal = {
        id: crypto.randomUUID(),
        name: `${courseType.charAt(0).toUpperCase() + courseType.slice(1)} Course`,
        description: `A ${courseType} dish for your ${eventType || situation} experience. Tap regenerate to try again.`,
        mealType: "dinner",
        courseType,
        courseLabel:
          courseType.charAt(0).toUpperCase() + courseType.slice(1),
        ingredients: [],
        instructions: [
          "This course encountered an issue during generation. Please tap the regenerate button to retry just this course.",
        ],
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        servings: servingSize,
        medicalBadges: [],
        flags: [],
        _fallback: true,
      };
    }

    generatedCourses.push(courseMeal);
  }

  return res.json({
    experienceId: experienceContext.id,
    situation,
    eventType: eventType || null,
    totalCourses,
    servingSize,
    flavorProfileSeed,
    courses: generatedCourses,
  });
});

export default router;
