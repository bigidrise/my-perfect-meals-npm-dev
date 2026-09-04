import { z } from "zod";
import { Router } from "express";
import { getCurrentPlan, setCurrentPlan } from "../services/currentPlan";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { rerollCanonicalWeeklyMeal, WeeklyMealGenerationError } from "../services/canonicalWeeklyMealPlanning";

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

router.post("/api/meal-plan/replace/custom", requireAuth, async (req: any, res) => {
  try {
    const parsed = ReplaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
    }
    const { dayIndex, mealIndex } = parsed.data;

    const userId = getAuthUserId(req);
    const cur = await getCurrentPlan(userId);
    if (!cur?.plan) return res.status(404).json({ error: "No current plan" });
    // The submitted meal is intentionally not consumed: clients request a
    // slot reroll, while only the server chooses and validates the candidate.
    const rerolled = await rerollCanonicalWeeklyMeal({
      userId, existingPlan: cur.plan, dayIndex, mealIndex,
      excludeItemId: (cur.plan as any)?.days?.[dayIndex]?.meals?.[mealIndex]?.id,
      correlationId: req.id,
    });
    const currentMeta = cur.meta !== null && typeof cur.meta === "object" && !Array.isArray(cur.meta)
      ? cur.meta
      : {};
    const mergedMeta = { ...currentMeta, ...rerolled.meta };
    await setCurrentPlan(userId, rerolled.plan, mergedMeta);
    res.json({ userId, plan: rerolled.plan, meta: mergedMeta });
  } catch (e) {
    console.error("Custom replacement error:", e);
    const typed = e instanceof WeeklyMealGenerationError ? e : null;
    res.status(typed?.status ?? 500).json({ error: typed?.code ?? "Replace failed" });
  }
});

export default router;