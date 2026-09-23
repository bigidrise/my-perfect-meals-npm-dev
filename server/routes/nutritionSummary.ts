/**
 * nutritionSummary.ts
 *
 * GET /api/nutrition-summary
 *
 * Returns a NutritionPersonalizationSummary DTO for the authenticated user.
 * Read-only. Reuses the Protocol Envelope — no new protocol logic.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { macroProgramHistory, mealPlansCurrent } from "@shared/schema";
import { and, eq, desc, ne } from "drizzle-orm";
import { loadSelfNutritionSummary } from "../services/nutritionSummary/loadSelfSummary";
import type { NutritionPersonalizationSummary } from "../services/nutritionSummary/buildNutritionSummary";
import { resolveHydrationDay } from "../services/hydration/hydrationDay";
import { resolveHydrationCenterState } from "../services/hydration/hydrationCenterService";
import { hydrationClinicianDirectives } from "../db/schema/hydration";

const router = Router();

type Summary = NutritionPersonalizationSummary;

export function pickDynamicNutritionContext(summary: Summary, enriched: Summary) {
  // Use the same server-local clock as buildNutritionSummary's weekday selection.
  const nextServerMidnight = new Date();
  nextServerMidnight.setHours(24, 0, 0, 0);
  return {
    performance: summary.activeInputs.performance,
    pregnancy: summary.activeInputs.pregnancy,
    liveMetrics: summary.nutritionDrivers?.liveMetrics.filter(
      metric => metric.label === "Blood Glucose" || metric.label === "Pregnancy Week",
    ) ?? [],
    compositeExplanation: summary.compositeExplanation,
    hydration: enriched.hydration,
    professionalUpdates: enriched.professionalUpdates,
    nextDayBoundaryAt: nextServerMidnight.toISOString(),
  };
}

async function enrichSummary(userId: string, summary: Summary): Promise<Summary> {
    const startedAt = performance.now();
    const [hydrationDay, [latestMacroUpdate], [latestMealPlan]] = await Promise.all([
      resolveHydrationDay({ subjectUserId: userId }),
      db.select().from(macroProgramHistory).where(and(
        eq(macroProgramHistory.clientUserId, userId),
        ne(macroProgramHistory.coachUserId, userId),
      )).orderBy(desc(macroProgramHistory.createdAt)).limit(1),
      db.select().from(mealPlansCurrent).where(eq(mealPlansCurrent.userId, userId)).limit(1),
    ]);
    const independentMs = Math.round(performance.now() - startedAt);
    const hydrationState = await resolveHydrationCenterState({
      subjectUserId: userId,
      localDate: hydrationDay.localDate,
      timezone: hydrationDay.timezone,
      access: {
        authenticatedUserId: userId,
        subjectUserId: userId,
        mode: "self",
        authorizationStatus: "allowed",
      },
    });
    const hydrationMs = Math.round(performance.now() - startedAt) - independentMs;
    const directiveId = hydrationState.numericPolicy.directiveId;
    const [directiveRow] = directiveId
      ? await db
          .select({
            id: hydrationClinicianDirectives.id,
            authorUserId: hydrationClinicianDirectives.authorUserId,
            createdAt: hydrationClinicianDirectives.createdAt,
            expiresAt: hydrationClinicianDirectives.expiresAt,
          })
          .from(hydrationClinicianDirectives)
          .where(eq(hydrationClinicianDirectives.id, directiveId))
          .limit(1)
      : [];
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[NutritionSummaryTiming] context.parallel=${independentMs}ms ` +
        `context.hydration=${hydrationMs}ms context.directive=${Math.round(performance.now() - startedAt) - independentMs - hydrationMs}ms`,
      );
    }

    const professionalUpdates: NonNullable<typeof summary.professionalUpdates> = [];
    if (directiveRow?.authorUserId && directiveRow.authorUserId !== userId) {
      professionalUpdates.push({
        id: `hydration:${directiveRow.id}`,
        kind: "hydration",
        title: "Hydration Plan updated",
        detail: "Your care team changed your authorized Hydration guidance.",
        changedAt: directiveRow.createdAt.toISOString(),
        href: "/hydration",
      });
    }
    if (latestMacroUpdate?.coachUserId && latestMacroUpdate.coachUserId !== userId) {
      professionalUpdates.push({
        id: `macros:${latestMacroUpdate.id}`,
        kind: "macros",
        title: "Nutrition targets updated",
        detail: "Your care team changed your macro targets.",
        changedAt: latestMacroUpdate.createdAt.toISOString(),
        href: "/dashboard",
      });
    }
    const mealPlanMeta = latestMealPlan?.meta as Record<string, unknown> | undefined;
    const mealPlanActor = typeof mealPlanMeta?.updatedByUserId === "string"
      ? mealPlanMeta.updatedByUserId
      : typeof mealPlanMeta?.assignedByUserId === "string"
        ? mealPlanMeta.assignedByUserId
        : null;
    if (latestMealPlan && mealPlanActor && mealPlanActor !== userId) {
      professionalUpdates.push({
        id: `meal_plan:${latestMealPlan.updatedAt.toISOString()}`,
        kind: "meal_plan",
        title: "Meal plan updated",
        detail: "Your care team changed your current meal plan.",
        changedAt: latestMealPlan.updatedAt.toISOString(),
        href: "/weekly-meal-planner",
      });
    }
    professionalUpdates.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    const liquid = hydrationState.liquidProtocol;
    const currentDay = liquid && liquid.status === "active"
      ? Math.max(
          1,
          Math.floor(
            (Date.parse(`${hydrationState.localDate}T12:00:00Z`) -
              Date.parse(`${liquid.startsOn}T12:00:00Z`)) /
              86_400_000,
          ) + 1,
        )
      : null;

    return {
      ...summary,
      hydration: {
        tracking: {
          status: hydrationState.numericPolicy.status,
          targetKind: hydrationState.numericPolicy.targetKind,
          targetMl: hydrationState.numericPolicy.targetMl,
          minimumMl: hydrationState.numericPolicy.minimumMl,
          maximumMl: hydrationState.numericPolicy.maximumMl,
          validThrough: directiveRow?.expiresAt?.toISOString() ?? null,
        },
        liquidNutrition: liquid
          ? {
              status: liquid.status,
              startsOn: liquid.startsOn,
              endsOn: liquid.endsOn,
              currentDay,
              verificationStatus: liquid.verificationStatus,
            }
          : null,
        href: "/hydration",
      },
      professionalUpdates: professionalUpdates.slice(0, 3),
    };
}

router.get("/baseline", requireAuth, async (req, res) => {
  const startedAt = performance.now();
  try {
    const summary = await loadSelfNutritionSummary((req as any).authUser.id, false);
    if (!summary) return res.status(404).json({ error: "User not found" });
    if (process.env.NODE_ENV === "development") {
      console.log(`[NutritionSummaryTiming] baseline=${Math.round(performance.now() - startedAt)}ms`);
    }
    return res.json(summary);
  } catch (err) {
    console.error("[NutritionSummary] Baseline error:", err);
    return res.status(500).json({ error: "Failed to build nutrition summary" });
  }
});

router.get("/dynamic", requireAuth, async (req, res) => {
  const startedAt = performance.now();
  try {
    const userId = (req as any).authUser.id as string;
    const summary = await loadSelfNutritionSummary(userId, true);
    if (!summary) return res.status(404).json({ error: "User not found" });
    const coreMs = Math.round(performance.now() - startedAt);
    const enriched = await enrichSummary(userId, summary);
    if (process.env.NODE_ENV === "development") {
      console.log(`[NutritionSummaryTiming] dynamic.core=${coreMs}ms dynamic.total=${Math.round(performance.now() - startedAt)}ms`);
    }
    return res.json(pickDynamicNutritionContext(summary, enriched));
  } catch (err) {
    console.error("[NutritionSummary] Dynamic error:", err);
    return res.status(500).json({ error: "Failed to build nutrition context" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const startedAt = performance.now();
  try {
    const userId = (req as any).authUser.id as string;
    const summary = await loadSelfNutritionSummary(userId, true);
    if (!summary) return res.status(404).json({ error: "User not found" });
    const coreMs = Math.round(performance.now() - startedAt);
    const enriched = await enrichSummary(userId, summary);
    if (process.env.NODE_ENV === "development") {
      console.log(`[NutritionSummaryTiming] combined.core=${coreMs}ms combined.total=${Math.round(performance.now() - startedAt)}ms`);
    }
    return res.json(enriched);
  } catch (err) {
    console.error("[NutritionSummary] Error:", err);
    return res.status(500).json({ error: "Failed to build nutrition summary" });
  }
});

export default router;
