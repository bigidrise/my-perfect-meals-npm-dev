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
  "fourth-of-july": "smoky BBQ, bold, summery, backyard celebration, patriotic",
};

// ─────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────
const ExperienceRequest = z.object({
  situation: z.enum(["holiday", "camping", "tailgating"]),
  eventType: z.string().optional(),
  selectedDishes: z
    .array(
      z.object({
        name: z.string(),
        category: z.enum(["appetizer", "main", "side", "dessert"]),
      }),
    )
    .optional()
    .default([]),
  familySpecialty: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  totalCourses: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  servingSize: z.number().int().min(1).max(50),
  userId: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  allergies: z.array(z.string()).optional().default([]),
  sweetenerPreferences: z.array(z.string()).optional().default([]),
  dietAdaptOverride: z.boolean().optional().default(false),
  flavorPersonal: z.boolean().optional().default(true),
  keepItSimple: z.boolean().optional().default(false),
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
    const key = eventType.toLowerCase().replace(/[''\s]+/g, "-").replace(/[^a-z0-9-]/g, "");
    return HOLIDAY_FLAVOR_SEEDS[key] || "celebratory, festive, traditional";
  }
  if (situation === "camping")
    return "simple, hearty, campfire-friendly, outdoorsy, minimal equipment";
  if (situation === "tailgating")
    return "bold, shareable, crowd-pleasing, finger-food friendly, casual";
  return "flavorful, cohesive, balanced";
}

// ─────────────────────────────────────────────
// Dish assignment — maps selected dishes to course slots BEFORE AI
// Model never guesses which dish goes where
// ─────────────────────────────────────────────
interface SelectedDish {
  name: string;
  category: "appetizer" | "main" | "side" | "dessert";
}

function assignDishToCourse(
  courseType: CourseType,
  courseIndex: number,
  courses: CourseType[],
  selectedDishes: SelectedDish[],
  familySpecialty: string | undefined,
): { assignedDish?: string; isFamilySpecialty?: boolean } {
  // Count how many of this courseType appear before this index
  const sameTypesBefore = courses
    .slice(0, courseIndex)
    .filter((c) => c === courseType).length;

  const dishesOfType = selectedDishes.filter((d) => d.category === courseType);

  if (dishesOfType[sameTypesBefore]) {
    return { assignedDish: dishesOfType[sameTypesBefore].name };
  }

  // Family specialty goes to main course if no main dish selected
  if (
    courseType === "main" &&
    familySpecialty &&
    dishesOfType.length === 0
  ) {
    return { assignedDish: familySpecialty, isFamilySpecialty: true };
  }

  return {};
}

// ─────────────────────────────────────────────
// Situation-specific constraint blocks (hard inject)
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
      "- CAMPING REQUIREMENT: Minimal equipment — maximum two cooking tools",
      "- No refrigeration required during preparation",
      "- Cooking methods: campfire, portable grill, or no-cook ONLY",
      "- Portable and easy to transport and serve outdoors",
      "- Avoid dishes that require sustained temperature control",
    ].join("\n");
  }
  // tailgating
  return [
    `- TAILGATING REQUIREMENT: Shareable and easy to serve to ${servingSize} people`,
    "- Finger food or individual portions — minimal plating complexity",
    "- Bold, crowd-pleasing flavors that work for a diverse group",
    "- Grill-friendly or no-cook preferred — fast prep required",
    "- Must hold up at room temperature for at least 30 minutes",
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
  assignedDish: string | undefined,
  isFamilySpecialty: boolean | undefined,
  familySpecialty: string | undefined,
  notes: string | undefined,
  alreadyGeneratedNames: string[] = [],
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

  if (alreadyGeneratedNames.length > 0) {
    lines.push(``);
    lines.push(`DIVERSITY RULES (CRITICAL — do NOT violate):`);
    lines.push(`- These dishes have already been generated for this experience: ${alreadyGeneratedNames.map(n => `"${n}"`).join(", ")}`);
    lines.push(`- You MUST NOT repeat any of these dish names or their primary ingredient`);
    lines.push(`- You MUST NOT give every dish the same cooking-method prefix (e.g. "campfire X", "grilled X", "holiday X")`);
    lines.push(`- Each course must feature a DIFFERENT primary protein, vegetable, or starch from the others`);
    lines.push(`- Choose a completely different dish — variety is the goal`);
  }

  if (strict) {
    lines.push(
      `- STRICT RETRY MODE: Keep the dish simple, familiar, and reliable — avoid unusual ingredients or complex techniques`,
    );
  }

  lines.push(``);
  lines.push(`SITUATION CONSTRAINTS:`);
  lines.push(getSituationConstraints(situation, eventType, servingSize));

  // Dish assignment — injected BEFORE AI call so model knows exactly what to cook
  if (assignedDish) {
    lines.push(``);
    if (isFamilySpecialty) {
      lines.push(`FAMILY SPECIALTY — MANDATORY (HIGHEST PRIORITY):`);
      lines.push(`User has provided a custom family dish: "${assignedDish}"`);
      lines.push(`You MUST prepare this exact dish. DO NOT replace it with something else.`);
      lines.push(`You may ONLY adapt it to meet dietary restrictions while preserving its essential character, ingredients, and cooking method.`);
    } else {
      lines.push(`SPECIFIC DISH REQUESTED:`);
      lines.push(`You MUST prepare: ${assignedDish}`);
      lines.push(
        `Adapt it to meet dietary restrictions while preserving its traditional ${eventType || situation} character and authentic flavor.`,
      );
    }
  } else if (!assignedDish && situation === "holiday" && eventType) {
    lines.push(``);
    lines.push(`DISH SELECTION:`);
    lines.push(
      `No specific dish was selected for this course. Generate a traditional ${eventType} ${courseType} that authentically represents this holiday and complements the rest of the meal.`,
    );
  }

  // Family specialty note on non-main courses
  if (familySpecialty && !isFamilySpecialty && courseType !== "main") {
    lines.push(``);
    lines.push(`FAMILY CONTEXT: This meal features a family specialty: "${familySpecialty}". Design this ${courseType} to complement it.`);
  }

  if (notes) {
    lines.push(``);
    lines.push(`USER NOTES: ${notes}`);
  }

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
// Ingredient deduplication — combines same-named ingredients across courses
// ─────────────────────────────────────────────
function deduplicateIngredients(
  allIngredients: Array<{ name: string; quantity?: number | string; unit?: string }>,
): Array<{ name: string; quantity?: number | string; unit?: string }> {
  const map = new Map<
    string,
    { name: string; quantity: number; unit: string }
  >();

  for (const ing of allIngredients) {
    const key = ing.name.toLowerCase().trim();
    const qty =
      typeof ing.quantity === "number"
        ? ing.quantity
        : parseFloat(String(ing.quantity ?? "0")) || 0;
    const unit = (ing.unit || "").toLowerCase().trim();

    if (map.has(key)) {
      const existing = map.get(key)!;
      if (existing.unit === unit && qty > 0) {
        existing.quantity += qty;
      }
    } else {
      map.set(key, { name: ing.name, quantity: qty, unit });
    }
  }

  return Array.from(map.values()).map((i) => ({
    name: i.name,
    quantity: i.quantity > 0 ? i.quantity : undefined,
    unit: i.unit || undefined,
  }));
}

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
    selectedDishes,
    familySpecialty,
    notes,
    totalCourses,
    servingSize,
    userId,
    dietaryRestrictions: reqDiet,
    allergies: reqAllergies,
    flavorPersonal,
    keepItSimple,
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
    `🎪 [UltimateExperience] id=${experienceContext.id} | courses=[${courses.join(",")}] | ${situation}${eventType ? `/${eventType}` : ""} | serving=${servingSize} | selectedDishes=${selectedDishes.length} | familySpecialty=${!!familySpecialty}`,
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
        // Dish assignment happens BEFORE the AI call — model is told exactly what to cook
        const { assignedDish, isFamilySpecialty } = assignDishToCourse(
          courseType,
          i,
          courses,
          selectedDishes,
          familySpecialty,
        );

        const alreadyGeneratedNames = generatedCourses
          .map((c: any) => c.name)
          .filter(Boolean);

        const coursePrompt = buildCoursePrompt(
          courseType,
          i,
          courses,
          situation as Situation,
          eventType,
          servingSize,
          experienceContext.flavorProfileSeed,
          strict,
          assignedDish,
          isFamilySpecialty,
          familySpecialty,
          notes,
          alreadyGeneratedNames,
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
            skipPalate: !flavorPersonal,
            strictMode: keepItSimple,
          },
        );

        courseMeal = {
          ...meal,
          courseType,
          courseLabel:
            courseType === "side"
              ? `Side Dish`
              : courseType.charAt(0).toUpperCase() + courseType.slice(1),
          assignedDish: assignedDish || null,
          isFamilySpecialty: isFamilySpecialty || false,
          servings: servingSize,
        };

        console.log(
          `✅ [UltimateExperience] ${courseType} (${i + 1}/${courses.length}): "${meal.name}"${assignedDish ? ` [requested: ${assignedDish}]` : ""}`,
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
          courseType === "side"
            ? "Side Dish"
            : courseType.charAt(0).toUpperCase() + courseType.slice(1),
        assignedDish: null,
        isFamilySpecialty: false,
        ingredients: [],
        instructions: [
          "This course encountered an issue during generation. Please try again.",
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

  // Aggregate all ingredients across courses for shopping list
  const allIngredients = generatedCourses.flatMap((c) =>
    (c.ingredients || []).map((ing: any) => ({
      name: ing.name || ing.item,
      quantity: ing.quantity || ing.amount,
      unit: ing.unit,
    })),
  );
  const aggregatedIngredients = deduplicateIngredients(allIngredients);

  return res.json({
    experienceId: experienceContext.id,
    situation,
    eventType: eventType || null,
    totalCourses,
    servingSize,
    flavorProfileSeed,
    courses: generatedCourses,
    aggregatedIngredients,
  });
});

export default router;
