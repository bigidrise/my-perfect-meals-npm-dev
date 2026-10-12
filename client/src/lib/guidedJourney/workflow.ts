import type { JourneySnapshot } from "../../../../shared/guidedJourney";
import { apiRequest } from "@/lib/apiRequest";
import { explanationJourneyAllowed } from "./explanation";
import { isPersonalJourneyWorkflow, type JourneyDashboardAccount } from "./dashboardScope";

export type WorkflowStage = "get_to_know_you" | "nutrition_targets";
export interface SavedTargetValues {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
interface SaveAttempt {
  stage: WorkflowStage;
  status: "saving" | "saved" | "confirmed" | "failed";
  expected?: SavedTargetValues;
}
// Wake-up/expected-value hints only. These never supply completion evidence,
// survive a reload, write preferences, authorize access, or trigger navigation.
const attempts = new Map<string, SaveAttempt>();
const listeners = new Set<(accountId: string) => void>();
export function personalWorkflowSaveEnabled(
  development: boolean, account: JourneyDashboardAccount | null,
  householdProfileId: string | null, professionalSession = false,
) {
  try {
    return !professionalSession && isPersonalJourneyWorkflow(account, {
      development, path: "/macro-counter", householdProfileId,
      workspace: localStorage.getItem("mpm_active_space"),
    });
  } catch { return false; } // Optional guidance must not break a native save.
}
export function workflowAttempt(accountId: string) { return attempts.get(accountId); }
export function observeWorkflowSaves(listener: (accountId: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function beginWorkflowSave(
  accountId: string | undefined, stage: WorkflowStage, enabled: boolean,
  expected?: SavedTargetValues,
) {
  if (!enabled || !accountId || accountId.startsWith("guest-")) return { saved() {}, failed() {} };
  const attempt: SaveAttempt = { stage, status: "saving", expected: expected ? { ...expected } : undefined };
  attempts.set(accountId, attempt);
  const notify = () => listeners.forEach(listener => {
    try { listener(accountId); }
    catch { console.warn("[Guided Journey] progress observer unavailable."); }
  });
  notify();
  function finish(status: "saved" | "failed") {
    if (attempts.get(accountId!) !== attempt || attempt.status !== "saving") return;
    attempt.status = status;
    notify();
  }
  return { saved: () => finish("saved"), failed: () => finish("failed") };
}

/** Successful HTTP writes are hints; raw progress AND saved values are authority. */
export async function confirmWorkflowSave(
  snapshot: JourneySnapshot, accountId: string, signal?: AbortSignal,
) {
  const attempt = attempts.get(accountId);
  if (attempt?.status !== "saved") return;
  if (snapshot.steps.find(step => step.id === attempt.stage)?.evidence.state !== "complete") {
    throw new Error("The saved activity could not be confirmed.");
  }
  if (attempt.stage === "nutrition_targets" && attempt.expected) {
    const stored = await apiRequest(`/api/users/${encodeURIComponent(accountId)}/macro-targets`, {
      method: "GET", cache: "no-store", signal,
    });
    if (!stored || stored.hasTargets !== true
      || (Object.keys(attempt.expected) as (keyof SavedTargetValues)[]).some(key =>
        !Number.isFinite(stored[key]) || stored[key] !== attempt.expected![key])) {
      throw new Error("The saved nutrition values could not be confirmed.");
    }
  }
  if (attempts.get(accountId) === attempt) {
    attempt.status = "confirmed";
    attempt.expected = undefined; // Do not pin later valid server changes to this receipt.
  }
}

export function workflowHandoff(snapshot: JourneySnapshot | null, account: JourneyDashboardAccount | null) {
  if (!snapshot || !explanationJourneyAllowed(snapshot, account)
    || snapshot.steps[0].evidence.state !== "complete"
    || workflowAttempt(account!.id)?.status === "saving") return null;
  const latest = workflowAttempt(account!.id);
  const previousSaveNotice = latest?.status === "failed"
    ? "The latest save wasn't confirmed. Previously saved work hasn't been reset. " : "";
  if (snapshot.status === "complete") return {
    message: `${previousSaveNotice}Your saved setup is confirmed. You can return to the Dashboard.`,
    destination: "dashboard" as const,
  };
  if (snapshot.nextStep === "nutrition_targets") return {
    message: `${previousSaveNotice}Your onboarding is confirmed. Next: review and save your nutrition targets.`,
    destination: "explanation" as const,
  };
  if (snapshot.nextStep === "saved_meal_plan") return {
    message: `${previousSaveNotice}${latest?.status === "failed" ? "Previously saved nutrition targets remain available." : "Your saved nutrition targets are confirmed."} Next: create your first meal in General Nutrition Meal Builder.`,
    destination: "explanation" as const,
  };
  return null;
}
