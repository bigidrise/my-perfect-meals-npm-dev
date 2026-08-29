import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db";
import { waterLogs } from "@shared/schema";
import { HYDRATION_MODIFIER_REGISTRY_VERSION } from "@shared/hydration/modifierRegistry";
import {
  evaluateHydrationNumericPolicy,
  type HydrationNumericPolicyResult,
} from "@shared/hydration/numericPolicy";
import type {
  HydrationPlanningEligibilityAccess,
  HydrationPlanningEligibilityResult,
} from "@shared/hydration/contracts";
import { resolveHydrationDay } from "./hydrationDay";
import { mapLegacyWaterLogToHydrationEvent } from "./legacyWaterLogHydrationBridge";
import {
  createHydrationCanonicalIntakeSnapshot,
  evaluateHydrationPlanningEligibility,
} from "./hydrationPlanningEligibility";
import { getHydrationClinicianDirectiveResolution } from "./hydrationClinicianDirectiveService";
import { getCurrentLiquidNutritionProtocol } from "./liquidNutritionProtocolService";
import type { HydrationProtocolRecord } from "@shared/hydration/fourDoor";
import { getActiveNutritionContext } from "../nutritionContext/getActiveNutritionContext";
import {
  buildHydrationConsideredForYou,
  type ConsideredForYouItem,
} from "./hydrationContextService";

export type HydrationCenterHistoryItem = Readonly<{
  id: string;
  amountMl: number;
  unit: string;
  intakeTime: string;
}>;

export type HydrationCenterState = Readonly<{
  subjectUserId: string;
  localDate: string;
  timezone: string;
  totalLoggedMl: number;
  history: HydrationCenterHistoryItem[];
  eligibility: HydrationPlanningEligibilityResult;
  numericPolicy: HydrationNumericPolicyResult;
  featureStatus: "development_preview" | "production_inactive";
  liquidProtocol: HydrationProtocolRecord | null;
  consideredForYou: ConsideredForYouItem[];
}>;

export async function resolveHydrationCenterState(input: {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  access: HydrationPlanningEligibilityAccess;
  now?: Date;
  preloadedRows?: Array<typeof waterLogs.$inferSelect>;
  preloadedLiquidProtocol?: HydrationProtocolRecord | null;
}): Promise<HydrationCenterState> {
  const startedAt = performance.now();
  const now = input.now ?? new Date();
  const waterStartedAt = performance.now();
  const rows = input.preloadedRows ?? await (async () => {
    const { start, end } = await resolveHydrationDay({
      subjectUserId: input.subjectUserId,
      localDate: input.localDate,
      timezone: input.timezone,
      now,
    });
    return db
      .select()
      .from(waterLogs)
      .where(
        and(
          eq(waterLogs.userId, input.subjectUserId),
          gte(waterLogs.intakeTime, start),
          lte(waterLogs.intakeTime, end),
        ),
      )
      .orderBy(asc(waterLogs.intakeTime));
  })();
  const waterMs = performance.now() - waterStartedAt;

  const events = rows.map(mapLegacyWaterLogToHydrationEvent);
  const snapshot = createHydrationCanonicalIntakeSnapshot({
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    status: "complete",
    observedAt: now.toISOString(),
    events,
  });
  let directiveMs = 0;
  let liquidProtocolMs = 0;
  let nutritionContextMs = 0;
  const [directiveResolution, liquidProtocol, nutritionContext] = await Promise.all([
    (async () => {
      const operationStartedAt = performance.now();
      const result = await getHydrationClinicianDirectiveResolution(input.subjectUserId, now);
      directiveMs = performance.now() - operationStartedAt;
      return result;
    })(),
    (async () => {
      const operationStartedAt = performance.now();
      const result = Object.prototype.hasOwnProperty.call(input, "preloadedLiquidProtocol")
        ? input.preloadedLiquidProtocol ?? null
        : await getCurrentLiquidNutritionProtocol({
            userId: input.subjectUserId,
            localDate: input.localDate,
          });
      liquidProtocolMs = performance.now() - operationStartedAt;
      return result;
    })(),
    (async () => {
      const operationStartedAt = performance.now();
      const result = await getActiveNutritionContext(input.subjectUserId);
      nutritionContextMs = performance.now() - operationStartedAt;
      return result;
    })(),
  ]);
  const eligibility = evaluateHydrationPlanningEligibility({
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    policyVersion: HYDRATION_MODIFIER_REGISTRY_VERSION,
    access: input.access,
    intake: snapshot,
    modifiers: [],
    dataQuality: {
      stale: false,
      provenanceComplete: true,
      missingDataCodes: [],
      unsupportedContextCodes: [],
    },
  });
  const totalLoggedMl = rows.reduce((sum, row) => sum + row.amountMl, 0);
  const developmentAuthorized = process.env.NODE_ENV !== "production";
  const numericPolicy = evaluateHydrationNumericPolicy({
    eligibility,
    consumedMl: totalLoggedMl,
    directive: directiveResolution.directive,
    directiveConflict: directiveResolution.conflict,
    activationStatus: developmentAuthorized
      ? "development_authorized"
      : "inactive",
    evaluatedAt: now.toISOString(),
  });
  const consideredForYou = buildHydrationConsideredForYou({
    envelope: nutritionContext.envelope,
    builder: nutritionContext.builder,
    liquidProtocol,
  });

  const result: HydrationCenterState = {
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    totalLoggedMl,
    history: rows.map((row) => ({
      id: row.id,
      amountMl: row.amountMl,
      unit: row.unit,
      intakeTime: row.intakeTime.toISOString(),
    })),
    eligibility,
    numericPolicy,
    liquidProtocol,
    consideredForYou,
    featureStatus: developmentAuthorized
      ? "development_preview"
      : "production_inactive",
  };
  if (process.env.NODE_ENV !== "production") {
    console.info("[hydration:timing] center-state", {
      totalMs: Math.round(performance.now() - startedAt),
      waterMs: Math.round(waterMs),
      waterSource: input.preloadedRows ? "preloaded" : "database",
      directiveMs: Math.round(directiveMs),
      liquidProtocolMs: Math.round(liquidProtocolMs),
      liquidProtocolSource: Object.prototype.hasOwnProperty.call(input, "preloadedLiquidProtocol") ? "preloaded" : "database",
      nutritionContextMs: Math.round(nutritionContextMs),
    });
  }
  return result;
}