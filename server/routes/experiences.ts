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

// ─────────────────────────────────────────────
// Dish type classifier — used for balance rules
// ─────────────────────────────────────────────
function classifyDishType(name: string): string {
  const n = name.toLowerCase();
  if (/\b(potato|latke|kugel|rice|bread|pasta|corn|yam|noodle|dumpling|roll|biscuit|tortilla|stuffing|dressing|grits|couscous|quinoa|barley|lentil)\b/.test(n)) return "starch";
  if (/\b(chicken|turkey|beef|brisket|salmon|fish|shrimp|lamb|pork|steak|rib|sausage|ham|duck|crab|lobster|tuna|venison|tofu|tempeh)\b/.test(n)) return "protein";
  if (/\b(salad|slaw|greens|kale|spinach|carrot|broccoli|cauliflower|asparagus|bean|pea|cabbage|cucumber|tomato|pepper|mushroom|zucchini|squash|brussels|beet|artichoke)\b/.test(n)) return "vegetable";
  if (/\b(cake|pie|cookie|brownie|doughnut|sufganiyot|pudding|tart|mousse|ice cream|sorbet|candy|fudge|cheesecake|cobbler|crisp|custard|crepe|macaron|baklava|halva)\b/.test(n)) return "dessert";
  if (/\b(soup|stew|chowder|bisque|broth|chili)\b/.test(n)) return "soup";
  return "other";
}

// ─────────────────────────────────────────────
// Cooking method extractor — for camping diversity
// ─────────────────────────────────────────────
function extractCookingMethod(name: string): string {
  const n = name.toLowerCase();
  if (/campfire/.test(n)) return "campfire";
  if (/\b(grilled|grill)\b/.test(n)) return "grilled";
  if (/foil/.test(n)) return "foil-packet";
  if (/skillet/.test(n)) return "skillet";
  if (/\b(raw|no.cook|fresh)\b/.test(n)) return "no-cook";
  if (/\b(boil|boiled|simmered)\b/.test(n)) return "boiled";
  if (/\bsmoked\b/.test(n)) return "smoked";
  if (/\bfried\b/.test(n)) return "fried";
  if (/\bbaked\b/.test(n)) return "baked";
  return "other";
}

// ─────────────────────────────────────────────
// Server-side duplicate detector
// ─────────────────────────────────────────────
function isDuplicateDish(newName: string, previousNames: string[]): boolean {
  if (!newName || previousNames.length === 0) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const newWords = normalize(newName).split(/\s+/).filter(w => w.length > 3);
  for (const prev of previousNames) {
    const prevWords = normalize(prev).split(/\s+/).filter(w => w.length > 3);
    const shared = newWords.filter(w => prevWords.includes(w));
    if (shared.length >= 2) return true; // 2+ meaningful shared words = duplicate
    if (normalize(newName) === normalize(prev)) return true;
  }
  return false;
}

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
  alreadyGeneratedTypes: string[] = [],
  alreadyGeneratedMethods: string[] = [],
): string {
  const lines = [
    `You are generating the ${COURSE_LABELS[courseType]} for a multi-course meal.`,
    ``,
    `COURSE POSITION: ${courseIndex + 1} of ${courses.length}`,
    `SITUATION: ${situation.toUpperCase()}${eventType ? ` — ${eventType.toUpperCase()}` : ""}`,
    `SERVING SIZE: ${servingSize} people`,
    `FLAVOR PROFILE SEED: ${flavorSeed}`,
    ``,
    `COURSE ROLE — MUST BE ENFORCED:`,
  ];

  if (courseType === "appetizer") lines.push(`- This is the APPETIZER: small, light, and designed to open the meal — NOT a main dish`);
  if (courseType === "main")      lines.push(`- This is the MAIN COURSE: protein-centered, substantial, the centerpiece of the entire meal`);
  if (courseType === "side")      lines.push(`- This is a SIDE DISH: complements the main course without duplicating it — NOT a standalone meal`);
  if (courseType === "dessert")   lines.push(`- This is the DESSERT: clearly sweet, the final course — NOT a savory dish`);

  lines.push(``);
  lines.push(`REQUIREMENTS:`);
  lines.push(`- Generate ONLY the ${COURSE_LABELS[courseType].split(" (")[0]} — nothing else`);
  lines.push(`- All dishes in this experience share the same flavor profile: ${flavorSeed}`);
  lines.push(`- This dish MUST feel like part of the SAME cohesive meal, not a standalone random meal`);
  lines.push(`- Portions must be sized for ${servingSize} people`);
  lines.push(`- Do NOT generate an unrelated meal — this is course ${courseIndex + 1} of a ${courses.length}-course ${situation} experience`);

  lines.push(``);
  lines.push(`MEAL BALANCE RULES (mandatory):`);
  lines.push(`- The overall meal may only have ONE heavy starch dish — if a starch already appears below, choose something else`);
  lines.push(`- At least one course in the entire meal must be vegetable-based`);
  lines.push(`- The main course MUST be protein-centered`);
  lines.push(`- Do NOT stack similar textures, flavors, or ingredients across courses`);

  if (alreadyGeneratedNames.length > 0) {
    lines.push(``);
    lines.push(`STRICT DUPLICATION RULES (CRITICAL — violation is not allowed):`);
    lines.push(`Previously generated dishes for this experience: ${alreadyGeneratedNames.map(n => `"${n}"`).join(", ")}`);
    lines.push(`Already-used dish types: ${alreadyGeneratedTypes.join(", ") || "none"}`);
    lines.push(`- Do NOT generate the same dish as any listed above`);
    lines.push(`- Do NOT generate a renamed version of any listed dish (e.g. if "Potato Latkes" is listed, do NOT generate "Potato Pancakes" or "Fried Potato Cakes")`);
    lines.push(`- Do NOT reuse the same base ingredient in the same form as any listed dish`);
    if (alreadyGeneratedTypes.filter(t => t === "starch").length >= 1) {
      lines.push(`- A starch dish is already included — do NOT generate another starch-based dish`);
    }
    if (alreadyGeneratedTypes.filter(t => t === "protein").length >= 1 && courseType !== "main") {
      lines.push(`- A protein dish is already included — if this is not the main course, choose a non-protein focus`);
    }
    lines.push(`- You MUST generate something clearly and obviously different from every listed dish above`);
  }

  if (situation === "camping" && alreadyGeneratedMethods.length > 0) {
    lines.push(``);
    lines.push(`COOKING METHOD DIVERSITY (camping rule):`);
    lines.push(`Already-used cooking methods: ${alreadyGeneratedMethods.join(", ")}`);
    lines.push(`- Each course MUST use a DIFFERENT cooking method`);
    lines.push(`- Available methods: campfire, grilled, foil packet, skillet, no-cook`);
    lines.push(`- Do NOT repeat any cooking method already used above`);
    lines.push(`- Do NOT prefix every dish name with the same word (e.g. "Campfire X" every time)`);
  }

  if (strict) {
    lines.push(``);
    lines.push(`STRICT RETRY MODE: Keep the dish simple, familiar, and reliable — avoid unusual ingredients or complex techniques`);
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

    // GUARDRAIL #4: Up to 3 attempts per course — first duplicate triggers strict retry
    for (let attempt = 0; attempt < 3; attempt++) {
      const strict = attempt > 0;
      if (attempt === 1) {
        console.log(`🔄 [UltimateExperience] Retrying ${courseType} (strict mode)`);
      }
      if (attempt === 2) {
        console.log(`🔄 [UltimateExperience] Retrying ${courseType} (duplicate detected — final attempt)`);
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

        const alreadyGeneratedNames = generatedCourses.map((c: any) => c.name).filter(Boolean);
        const alreadyGeneratedTypes = generatedCourses.map((c: any) => classifyDishType(c.name || "")).filter(Boolean);
        const alreadyGeneratedMethods = generatedCourses.map((c: any) => extractCookingMethod(c.name || "")).filter(Boolean);

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
          alreadyGeneratedTypes,
          alreadyGeneratedMethods,
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
            skipImage: true, // Images fetched in parallel by client after text is returned
          },
        );

        // Server-side duplicate detection — if AI still produced a duplicate, force another attempt
        const existingNames = generatedCourses.map((c: any) => c.name).filter(Boolean);
        if (!assignedDish && isDuplicateDish(meal.name, existingNames)) {
          console.warn(`⚠️ [UltimateExperience] Duplicate detected: "${meal.name}" matches previous courses — retrying`);
          continue; // trigger next attempt with stricter prompt
        }

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

// ─────────────────────────────────────────────
// Image generation endpoint — called in parallel by client for each course
// 1 retry with simplified prompt, then graceful fallback
// ─────────────────────────────────────────────
router.post("/generate-image", async (req: Request, res: Response) => {
  const { mealName, mealType = "dinner" } = req.body || {};
  if (!mealName) return res.status(400).json({ imageUrl: null, error: "mealName required" });

  const { genImage } = await import("../utils/openaiSafe");

  const fullPrompt = `${mealName}, healthy ${mealType}, professional food photography, overhead view, clean plate presentation, natural lighting`;
  let imageUrl: string | null = (await genImage(fullPrompt)) ?? null;

  if (!imageUrl) {
    console.log(`🔄 [ExperienceImage] Retrying image for "${mealName}" with simplified prompt`);
    imageUrl = (await genImage(`${mealName}, professional food photography, clean background`)) ?? null;
  }

  if (!imageUrl) {
    console.warn(`⚠️ [ExperienceImage] Both attempts failed for "${mealName}" — returning null`);
  }

  return res.json({ imageUrl });
});

export default router;
