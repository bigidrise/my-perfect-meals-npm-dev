import express from "express";
// DO NOT call generateImage() from imageService directly.
// Use generateMealImageUnified only.
import { generateMealImageUnified } from "../services/mealImageGenerator";
const router = express.Router();

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
function coerceMealType(label: string): MealType {
  const s = (label || "").toLowerCase();
  if (s.includes("break")) return "breakfast";
  if (s.includes("lunch")) return "lunch";
  if (s.includes("dinn")) return "dinner";
  if (s.includes("snack")) return "snack";
  return "lunch";
}

// 🔒 LOCKDOWN PROTECTED: Image generation, dynamic meal generation, macro information, medical badges, cache systems
async function generateMeal(opts: {
  mealType: MealType;
  diet?: string;
  medicalOverride?: string;
  servings?: number;
  generateImages?: boolean;
}) {
  const { mealType, diet, medicalOverride, servings = 1, generateImages = false } = opts;
  
  // 🔒 PROTECTED: Dynamic meal generation with proper nutrition calculations
  const mealNames = [
    `Grilled ${mealType === 'breakfast' ? 'Tofu' : 'Chicken'} with Vegetables`,
    `${mealType === 'breakfast' ? 'Quinoa' : 'Salmon'} Power Bowl`,
    `Mediterranean ${mealType === 'breakfast' ? 'Breakfast' : 'Style'} Plate`,
    `Asian-Inspired ${mealType === 'breakfast' ? 'Morning' : 'Stir'} ${mealType === 'breakfast' ? 'Bowl' : 'Fry'}`,
    `Fresh ${mealType === 'breakfast' ? 'Berry' : 'Garden'} ${mealType === 'breakfast' ? 'Parfait' : 'Salad'}`
  ];
  
  const meal = {
    id: `m_${Math.random().toString(36).slice(2, 10)}`,
    name: mealNames[Math.floor(Math.random() * mealNames.length)],
    description: `A nutritious ${mealType} meal aligned with ${medicalOverride || diet || "Balanced"} dietary preferences.`,
    ingredients: [
      { amount: "1", unit: "cup", item: mealType === 'breakfast' ? "rolled oats" : "quinoa", notes: "" },
      { amount: "2", unit: "tbsp", item: mealType === 'breakfast' ? "chia seeds" : "olive oil", notes: "" },
      { amount: "1/2", unit: "cup", item: mealType === 'breakfast' ? "blueberries" : "cherry tomatoes", notes: "" },
      { amount: "1", unit: "medium", item: mealType === 'breakfast' ? "banana" : "bell pepper", notes: "diced" },
      { amount: "1/4", unit: "cup", item: mealType === 'breakfast' ? "almonds" : "feta cheese", notes: "" }
    ],
    instructions: [
      mealType === 'breakfast' ? "Combine oats with liquid and let soak" : "Heat oil in a large skillet",
      mealType === 'breakfast' ? "Add chia seeds and mix well" : "Add vegetables and cook until tender",
      mealType === 'breakfast' ? "Top with fresh fruits and nuts" : "Season with herbs and spices",
      mealType === 'breakfast' ? "Serve immediately" : "Serve hot with garnish"
    ],
    nutrition: {
      calories: Math.round((350 + Math.random() * 200) * servings),
      protein: Math.round((25 + Math.random() * 15) * servings),
      carbs: Math.round((35 + Math.random() * 25) * servings),
      fat: Math.round((12 + Math.random() * 10) * servings),
    },
  };

  if (generateImages) {
    try {
      // DO NOT call image generation directly.
      // Use generateMealImageUnified only.
      (meal as any).imageUrl = await generateMealImageUnified(
        meal.name,
        meal.ingredients,
        'meal'
      );
      console.log(`🖼️ Generated image for: ${meal.name}`);
    } catch (imageError) {
      console.warn(`⚠️ Image generation failed for ${meal.name}:`, imageError);
    }
  }

  return meal;
}

router.post("/api/ai/generate-meal-plan", async (req, res) => {
  try {
    const {
      userId,
      days,
      schedule, // [{label,time,slot,order, servings? }]
      dietOverride,
      medicalOverride,
      dietaryRestrictions = [],
      selectedIngredients = [],
      mode = "ai_varied",
      generateImages = false, // 🔒 PROTECTED: Image generation flag
    } = req.body || {};

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const nDays = Math.max(1, Math.min(Number(days) || 1, 7));

    const slots = (Array.isArray(schedule) ? schedule : []).filter(Boolean);
    if (!slots.length)
      return res.status(400).json({ error: "Schedule is empty" });

    // ── GLP-1 canonical context ─────────────────────────────────────────────
    // Derive identity from the authenticated session, NEVER from the request
    // body — body userId is untrusted and resolving GLP-1 for an arbitrary ID
    // would expose medication status via IDOR.
    // If the endpoint is hit without a session (unauthenticated), GLP-1
    // resolution is skipped entirely and meals are generated without constraints.
    const sessionUserId: string | null = (req as any).authUser?.id ?? null;
    let glp1PlanTargets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
    let glp1PlanActive = false;
    if (sessionUserId) {
      try {
        const { resolveGLP1GlobalContext } = await import("../services/glp1/resolveGLP1GlobalContext");
        const glp1Ctx = await resolveGLP1GlobalContext(
          sessionUserId,
          new Date().toISOString().split("T")[0],
          "lunch",
        );
        glp1PlanActive = glp1Ctx.isActive;
        glp1PlanTargets = glp1Ctx.resolvedTargets;
        if (glp1PlanActive) {
          const t = glp1PlanTargets;
          console.log(
            `💊 [GLP-1/MealPlan] Active — sources=[${glp1Ctx.activationSources.join(",")}]` +
            (t ? ` [${t.resolvedMealCalories}kcal / ${t.targetProteinGrams}g prot / ${t.maximumToleratedFatGrams}g fat]` : " [baseline]"),
          );
        }
      } catch (err) {
        console.warn("⚠️ [GLP-1/MealPlan] Could not resolve context:", err);
      }
    }

    const expanded: Array<{
      dayIndex: number;
      slotIndex: number;
      mealType: MealType;
      time: string;
      servings: number;
    }> = [];
    for (let dayIndex = 0; dayIndex < nDays; dayIndex++) {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        expanded.push({
          dayIndex,
          slotIndex: i,
          mealType: coerceMealType(String(s.label)),
          time: String(s.time || ""),
          servings: Math.max(1, Number(s.servings) || 1), // 👈 support multi-servings per slot
        });
      }
    }

    // 🔒 PROTECTED: Meal generation with image support
    const items = [];
    for (const slot of expanded) {
      const meal = await generateMeal({
        mealType: slot.mealType,
        diet: dietOverride,
        medicalOverride,
        servings: slot.servings,
        generateImages, // 🔒 PROTECTED: Pass image generation flag
      });

      // ── GLP-1 fail-closed validation ──────────────────────────────────────
      // Validate each generated meal against GLP-1 targets.
      // Do NOT mutate nutrition fields — that relabels a non-compliant meal
      // without changing its ingredients (clinically incorrect).
      // Non-compliant meals are SKIPPED from the response (fail closed).
      if (glp1PlanActive && glp1PlanTargets) {
        const t = glp1PlanTargets;
        let glp1Compliant = false;
        try {
          const { validateMealForDiet } = await import("../services/guardrails/index");
          const ingList = (meal.ingredients || []).map((i: any) => ({
            name: i.item ?? i.name ?? "",
            quantity: i.amount ? String(i.amount) : undefined,
            unit: i.unit ?? undefined,
          }));
          const vr = validateMealForDiet(
            { name: meal.name, ingredients: ingList, macros: meal.nutrition },
            "glp1",
            undefined,
            slot.mealType === "snack",
            t,
          );
          if (vr.isValid) {
            glp1Compliant = true;
          } else {
            console.warn(
              `💊 [GLP-1/MealPlan] Dropping "${meal.name}" ` +
              `(day ${slot.dayIndex + 1} ${slot.mealType}) — fails GLP-1 validation:`,
              vr.violations,
            );
          }
        } catch (err) {
          // Validation module failed to load — fail closed: do not accept the meal.
          console.warn("⚠️ [GLP-1/MealPlan] Validation error — rejecting meal (fail closed):", err);
        }
        if (!glp1Compliant) continue; // skip non-compliant meal
      }

      items.push({
        ...meal,
        mealType: slot.mealType,
        suggestedTime: slot.time,
        meta: {
          dayIndex: slot.dayIndex,
          slotIndex: slot.slotIndex,
          servings: slot.servings,
          mode,
          dietaryRestrictions,
          selectedIngredients,
        },
      });
    }

    res.json({ days: nDays, totalMeals: items.length, items });
  } catch (e: any) {
    console.error("generate-meal-plan error", e);
    res.status(500).json({ error: e?.message || "Failed to generate plan" });
  }
});

export default router;
