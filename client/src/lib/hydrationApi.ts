import { apiRequest } from "@/lib/queryClient";
import { createWaterLog } from "@/lib/waterLogsApi";

export type HydrationTargetKind = "point" | "range" | "floor" | "ceiling";

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
      beverageMix: Array<{ beverageClass: string; amountMl: number }>;
    };
    sevenDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    thirtyDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    dailyTotals: Array<{ localDate: string; totalMl: number; plainWaterMl: number }>;
  };
  todayHistory?: Array<{
    id: string;
    amountMl: number;
    unit: string;
    beverageClass: string;
    intakeTime: string;
  }>;
  setup?: {
    consented: boolean;
    preferences: Record<string, unknown>;
    optedOutAt: string | null;
    barriers: Array<{ barrierCode: string; note: string | null }>;
  };
  interventions?: Array<{
    id: string;
    barrierCode: string;
    optionKey: string;
    title: string;
    description: string;
    destinationType: string;
    destinationRef?: string | null;
    createdAt: string;
  }>;
  outcomeCounts?: Record<string, number>;
}

export function getHydrationCenterState(input: {
  date: string;
  timezone: string;
  clientId?: string;
}) {
  const params = new URLSearchParams({
    date: input.date,
    timezone: input.timezone,
  });
  if (input.clientId) params.set("clientId", input.clientId);
  return apiRequest<HydrationCenterState>(
    `/api/hydration/state?${params.toString()}`,
  );
}

export function getHydrationHubState(input: {
  date: string;
  timezone: string;
  clientId?: string;
}) {
  const params = new URLSearchParams({ date: input.date, timezone: input.timezone });
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
  barriers: Array<{ barrierCode: string; note?: string }>;
}) {
  return apiRequest<{ ok: boolean }>("/api/hydration/hub/barriers", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function createHydrationHelp(input: {
  barriers: string[];
  preferences: Record<string, unknown>;
}) {
  return apiRequest<{ options: Array<{
    id: string;
    barrierCode: string;
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

export async function addHydrationWater(input: {
  amount: number;
  unit: "oz" | "ml";
  clientId?: string;
  beverageClass?: string;
}) {
  return createWaterLog(input);
}