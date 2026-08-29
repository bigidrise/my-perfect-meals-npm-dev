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
}>;

export async function resolveHydrationCenterState(input: {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  access: HydrationPlanningEligibilityAccess;
  now?: Date;
}): Promise<HydrationCenterState> {
  const now = input.now ?? new Date();
  const { start, end } = await resolveHydrationDay({
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    now,
  });
  const rows = await db
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

  const events = rows.map(mapLegacyWaterLogToHydrationEvent);
  const snapshot = createHydrationCanonicalIntakeSnapshot({
    subjectUserId: input.subjectUserId,
    localDate: input.localDate,
    timezone: input.timezone,
    status: "complete",
    observedAt: now.toISOString(),
    events,
  });
  const directiveResolution =
    await getHydrationClinicianDirectiveResolution(input.subjectUserId, now);
  const numericContextCoverageAvailable = !directiveResolution.directive;
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
      provenanceComplete: numericContextCoverageAvailable,
      missingDataCodes: numericContextCoverageAvailable
        ? []
        : ["GOVERNED_MODIFIER_CONTEXT_UNAVAILABLE"],
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
  const liquidProtocol = await getCurrentLiquidNutritionProtocol({
    userId: input.subjectUserId,
    localDate: input.localDate,
  });

  return {
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
    featureStatus: developmentAuthorized
      ? "development_preview"
      : "production_inactive",
  };
}