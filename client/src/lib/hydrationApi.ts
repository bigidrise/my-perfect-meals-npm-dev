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

export async function addHydrationWater(input: {
  amount: number;
  unit: "oz" | "ml";
  clientId?: string;
}) {
  return createWaterLog(input);
}