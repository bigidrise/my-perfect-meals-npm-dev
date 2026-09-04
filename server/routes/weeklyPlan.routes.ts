import express from "express";
import { getWeeklyPlan, upsertWeeklyPlan, deleteWeeklyPlan, checkPlanExpiry } from "../db/repo.weeklyPlan";
import { requireAuth } from "../middleware/requireAuth";
import {
  generateCanonicalWeeklyMealPlan,
  regenerateCanonicalWeeklyDay,
  WeeklyMealGenerationError,
} from "../services/canonicalWeeklyMealPlanning";

const router = express.Router();

function generationError(res: express.Response, error: unknown, fallback: string) {
  const typed = error instanceof WeeklyMealGenerationError ? error : null;
  return res.status(typed?.status ?? 500).json({ error: typed?.code ?? fallback });
}

router.post("/meal-plan/save", requireAuth, async (req, res) => {
  try {
    const userId: string = (req as any).authUser.id;
    const { plan, params, planStartDate, planEndDate } = req.body;
    if (!plan) return res.status(400).json({ error: "plan required" });
    await upsertWeeklyPlan(userId, plan, params || {},
      planStartDate ? new Date(planStartDate) : new Date(),
      planEndDate ? new Date(planEndDate) : new Date(Date.now() + 7 * 86400000));
    return res.json({ ok: true });
  } catch (error) {
    return generationError(res, error, "Failed to save weekly plan");
  }
});

router.post("/meal-plan/regenerate", requireAuth, async (req, res) => {
  try {
    const userId: string = (req as any).authUser.id;
    const seed: any = (await getWeeklyPlan(userId))?.params || {};
    const generated = await generateCanonicalWeeklyMealPlan({
      userId, weeks: 1, mealsPerDay: seed.mealsPerDay, snacksPerDay: seed.snacksPerDay,
      targets: seed.targets, dietOverride: typeof seed.diet === "string" ? seed.diet : undefined,
      correlationId: (req as any).id,
    });
    const start = new Date(`${generated.plan.weekStartDate}T00:00:00.000Z`);
    await upsertWeeklyPlan(userId, generated.plan, { ...seed, canonicalMeta: generated.meta, regeneratedAt: new Date().toISOString() },
      start, new Date(start.getTime() + 6 * 86400000));
    return res.json(generated);
  } catch (error) {
    return generationError(res, error, "Failed to regenerate weekly plan");
  }
});

router.post("/meal-plan/regenerate/day", requireAuth, async (req, res) => {
  try {
    const userId: string = (req as any).authUser.id;
    const existing = await getWeeklyPlan(userId);
    if (!existing?.plan) return res.status(404).json({ error: "No current plan" });
    const result = await regenerateCanonicalWeeklyDay({
      userId, existingPlan: existing.plan, dayIndex: Number(req.body?.dayIndex),
      targets: (existing.params as any)?.targets,
      dietOverride: typeof (existing.params as any)?.diet === "string" ? (existing.params as any).diet : undefined,
      correlationId: (req as any).id,
    });
    await upsertWeeklyPlan(userId, result.plan, { ...(existing.params as any ?? {}), canonicalMeta: result.meta },
      existing.planStartDate ?? undefined, existing.planEndDate ?? undefined);
    return res.json(result);
  } catch (error) {
    return generationError(res, error, "DAY_REGENERATION_FAILED");
  }
});

router.post("/meal-plan/delete", requireAuth, async (req, res) => {
  try {
    await deleteWeeklyPlan((req as any).authUser.id);
    return res.json({ ok: true });
  } catch (error) {
    return generationError(res, error, "Failed to delete weekly plan");
  }
});

router.get("/meal-plan/status", requireAuth, async (req, res) => {
  try {
    return res.json(await checkPlanExpiry((req as any).authUser.id));
  } catch (error) {
    return generationError(res, error, "Failed to check plan status");
  }
});

router.post("/meal-plan/immediate", requireAuth, async (req, res) => {
  try {
    const userId: string = (req as any).authUser.id;
    const onboarding = req.body?.onboardingData ?? {};
    const generated = await generateCanonicalWeeklyMealPlan({
      userId, weeks: 1, mealsPerDay: onboarding.mealsPerDay, snacksPerDay: onboarding.snacksPerDay,
      targets: onboarding.targets, dietOverride: typeof onboarding.diet === "string" ? onboarding.diet : undefined,
      correlationId: (req as any).id,
    });
    const start = new Date(`${generated.plan.weekStartDate}T00:00:00.000Z`);
    await upsertWeeklyPlan(userId, generated.plan, { ...onboarding, canonicalMeta: generated.meta },
      start, new Date(start.getTime() + 6 * 86400000));
    return res.json({ ok: true, ...generated, startDate: generated.plan.weekStartDate,
      endDate: new Date(start.getTime() + 6 * 86400000).toISOString().slice(0, 10) });
  } catch (error) {
    return generationError(res, error, "Failed to generate immediate plan");
  }
});

export default router;