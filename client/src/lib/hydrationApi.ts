import { apiRequest } from "@/lib/queryClient";
import { createWaterLog } from "@/lib/waterLogsApi";
import type { HydrationProtocolRecord, LiquidNutritionProtocolInput } from "@shared/hydration/fourDoor";
export type {
  HydrationDoorKey,
  HydrationProtocolRecord,
  HydrationProtocolType,
  LiquidNutritionProtocolInput,
} from "@shared/hydration/fourDoor";

export type HydrationTargetKind = "point" | "range" | "floor" | "ceiling";
export type HydrationBarrierCode =
  | "forgetting"
  | "taste"
  | "temperature"
  | "carbonation"
  | "access"
  | "timing"
  | "bathroom_concerns"
  | "nutrition_conflicts"
  | "low_appetite";
export type HydrationBeverageClass =
  | "water"
  | "sparkling"
  | "tea"
  | "coffee"
  | "milk"
  | "juice"
  | "other";
export type HydrationPreferenceKey = "flavor" | "temperature" | "carbonation";
export type HydrationPreferences = Record<HydrationPreferenceKey, string>;

export interface HydrationNumericPolicyState {
  policyVersion: string;
  status: "TRACK_ONLY" | "NUMERIC_ACTIVE" | "PLAN_WITHHELD" | "NEEDS_REVIEW";
  targetKind: HydrationTargetKind | null;
  consumedMl: number;
  targetMl: number | null;
  minimumMl: number | null;
  maximumMl: number | null;
  remainingMl: number | null;
  remainingToMinimumMl: number | null;
  headroomToMaximumMl: number | null;
  progressPercent: number | null;
  reasonCodes: string[];
  directiveId: string | null;
}

export interface HydrationCenterState {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  totalLoggedMl: number;
  history: Array<{
    id: string;
    amountMl: number;
    unit: string;
    intakeTime: string;
  }>;
  eligibility: {
    outcome: "PLAN_ELIGIBLE" | "PLAN_WITHHELD" | "NEEDS_REVIEW";
  };
  numericPolicy: HydrationNumericPolicyState;
  featureStatus: "development_preview" | "production_inactive";
  projections?: {
    today: {
      totalFluidsMl: number;
      plainWaterMl: number;
      beverageMix: Array<{ beverageClass: HydrationBeverageClass; amountMl: number }>;
    };
    sevenDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    thirtyDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    dailyTotals: Array<{ localDate: string; totalMl: number; plainWaterMl: number }>;
  };
  todayHistory?: Array<{
    id: string;
    amountMl: number;
    unit: string;
    beverageClass: HydrationBeverageClass;
    intakeTime: string;
  }>;
  setup?: {
    consented: boolean;
    preferences: Record<string, unknown>;
    optedOutAt: string | null;
    barriers: Array<{ barrierCode: HydrationBarrierCode; note: string | null }>;
  };
  interventions?: Array<{
    id: string;
    barrierCode: HydrationBarrierCode;
    optionKey: string;
    title: string;
    description: string;
    destinationType: string;
    destinationRef?: string | null;
    createdAt: string;
  }>;
  outcomeCounts?: Record<string, number>;
  liquidProtocol?: HydrationProtocolRecord | null;
}

export function getHydrationCenterState(input: {
  date?: string;
  clientId?: string;
}) {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.clientId) params.set("clientId", input.clientId);
  return apiRequest<HydrationCenterState>(
    `/api/hydration/state?${params.toString()}`,
  );
}

export function getHydrationHubState(input: {
  date?: string;
  clientId?: string;
}) {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.clientId) params.set("clientId", input.clientId);
  return apiRequest<HydrationCenterState>(`/api/hydration/hub?${params.toString()}`);
}

export function saveHydrationHubPreferences(input: {
  consented: boolean;
  optedOut?: boolean;
  preferences: Record<string, unknown>;
}) {
  return apiRequest<{ ok: boolean; consented: boolean }>("/api/hydration/hub/preferences", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function saveHydrationHubBarriers(input: {
  barriers: Array<{ barrierCode: HydrationBarrierCode; note?: string }>;
}) {
  return apiRequest<{ ok: boolean }>("/api/hydration/hub/barriers", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function createHydrationHelp(input: {
  barriers: HydrationBarrierCode[];
  preferences: Record<string, unknown>;
}) {
  return apiRequest<{ options: Array<{
    id: string;
    barrierCode: HydrationBarrierCode;
    optionKey: string;
    title: string;
    description: string;
    destinationType: string;
    destinationRef?: string | null;
    createdAt: string;
  }> }>("/api/hydration/hub/help", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function recordHydrationInterventionEvent(
  interventionId: string,
  eventType: "accepted" | "dismissed" | "opened" | "completed" | "logged" | "rated",
  metadata?: Record<string, unknown>,
) {
  return apiRequest<{ ok: boolean }>(`/api/hydration/hub/interventions/${interventionId}/events`, {
    method: "POST",
    body: JSON.stringify({ eventType, metadata }),
  });
}

export function createHydrationLiquidProtocol(input: LiquidNutritionProtocolInput) {
  return apiRequest<{ protocol: HydrationProtocolRecord }>("/api/hydration/hub/liquid-protocol", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function activateHydrationLiquidProtocol(protocolId: string) {
  return apiRequest<{ protocol: HydrationProtocolRecord }>(
    `/api/hydration/hub/liquid-protocol/${encodeURIComponent(protocolId)}/activate`,
    {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    },
  );
}

export async function addHydrationWater(input: {
  amount: number;
  unit: "oz" | "ml";
  clientId?: string;
  beverageClass?: HydrationBeverageClass;
}) {
  return createWaterLog(input);
}
