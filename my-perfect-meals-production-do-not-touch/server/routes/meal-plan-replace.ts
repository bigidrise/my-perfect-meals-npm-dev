import { z } from "zod";
import { Router } from "express";
import { getCurrentPlan, setCurrentPlan } from "../services/currentPlan";

const router = Router();

const ReplaceSchema = z.object({
  dayIndex: z.number().int().min(0),
  mealIndex: z.number().int().min(0),
  meal: z.object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    course: z.enum(["breakfast","lunch","dinner","snack"]).optional(),
    imageUrl: z.string().url().optional(),
    calories: z.number().nonnegative().optional(),
    macros: z.object({
      protein: z.number().nonnegative().optional(),
      carbs:   z.number().nonnegative().optional(),
      fat:     z.number().nonnegative().optional(),
    }).partial().optional(),
    summary: z.string().optional(),
  }),
});

function courseDefaultImage(course?: string) {
  const c = course || "dinner";
  return `/assets/meals/default-${c}.jpg`;
}

router.post("/api/meal-plan/replace/custom", async (req: any, res) => {
  try {
    const parsed = ReplaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
    }
    const { dayIndex, mealIndex, meal } = parsed.data;

    // Get userId from auth/session; fallback if needed
    const userId = req.user?.id || req.headers["x-user-id"] || "00000000-0000-0000-0000-000000000001";

    const cur = await getCurrentPlan(userId);
    if (!cur?.plan) return res.status(404).json({ error: "No current plan" });

    // ✅ plan shape: { days: Array<{ meals: Meal[] }> }  
    const plan = cur.plan as any; // Type cast for meal plan structure
    if (!plan.days) return res.status(404).json({ error: "Invalid plan structure" });
    
    const day = plan.days[dayIndex];
    if (!day || !Array.isArray(day.meals) || !day.meals[mealIndex]) {
      return res.status(400).json({ error: "Invalid day or meal index" });
    }

    // Normalize meal: ensure slug, imageUrl, basic macro fields
    const safeSlug =
      meal.slug ||
      meal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const normalized = {
      ...meal,
      slug: safeSlug,
      course: meal.course ?? day.meals[mealIndex]?.course ?? "dinner",
      imageUrl: meal.imageUrl || `/meal-images/${safeSlug}.jpg`, // try slug image first
      calories: typeof meal.calories === "number" ? meal.calories : 0,
      macros: {
        protein: meal.macros?.protein ?? 0,
        carbs:   meal.macros?.carbs   ?? 0,
        fat:     meal.macros?.fat     ?? 0,
      },
    };

    // If we don't actually host /meal-images/*.jpg, fallback to course default
    if (!normalized.imageUrl?.startsWith("http") && !normalized.imageUrl?.startsWith("/assets/")) {
      normalized.imageUrl = courseDefaultImage(normalized.course);
    }

    day.meals[mealIndex] = normalized;
    await setCurrentPlan(userId, cur.plan, cur.meta);

    // Return the same shape your calendar query expects:
    // { userId, plan, meta }
    res.json({ userId, plan: cur.plan, meta: cur.meta });
  } catch (e) {
    console.error("Custom replacement error:", e);
    res.status(500).json({ error: "Replace failed" });
  }
});

export default router;