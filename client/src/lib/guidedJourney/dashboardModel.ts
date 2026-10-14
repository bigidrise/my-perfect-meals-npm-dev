import type { JourneySnapshot, JourneyStepId, CompletionState } from "../../../../shared/guidedJourney";
import type { GuidancePreferenceResult } from "./preferences";
import { mealBuilderGuidance } from "@shared/mealBuilderGuidance";

export const JOURNEY_STAGE_LABELS: Record<JourneyStepId, string> = {
  get_to_know_you: "Get to Know You",
  nutrition_targets: "Your Nutrition Targets",
  saved_meal_plan: "Create Your Meal Plan",
};
export interface GettingStartedCardModel {
  stages: { id: JourneyStepId; label: string; state: CompletionState; current: boolean }[];
  statusText: string;
  loading: boolean;
  busy: boolean;
  canContinue: boolean;
  canRetry: boolean;
  controlsReady: boolean;
  paused: boolean;
  automaticDisabled: boolean;
  replayRequested: boolean;
  preferenceNotice: string | null;
}

/** A suggestion is not authorization; caller must recheck before navigating. */
export function manualJourneyDestination(snapshot: JourneySnapshot): string | null {
  if (snapshot.status !== "in_progress" || snapshot.scope.workspace !== "personal"
    || snapshot.scope.actorId !== snapshot.scope.subjectId
    || snapshot.steps.some(step => step.evidence.state === "unknown")
    || snapshot.nextAction?.kind !== "open_existing_activity") return null;
  const routes: Record<JourneyStepId, string> = {
    get_to_know_you: "/onboarding",
    nutrition_targets: "/macro-counter",
    saved_meal_plan: mealBuilderGuidance(snapshot.builderKey)?.route ?? "",
  };
  const id = snapshot.nextStep;
  if (!id || snapshot.nextAction.route !== routes[id]
    || snapshot.steps.find(step => step.id === id)?.evidence.state !== "incomplete") return null;
  if (id === "saved_meal_plan" && (!mealBuilderGuidance(snapshot.builderKey)
    || snapshot.completionGoal !== "saved_meal_plan")) return null;
  return routes[id];
}

export function gettingStartedCardModel(
  snapshot: JourneySnapshot | null,
  preferences: GuidancePreferenceResult | null,
  options: { loading: boolean; busy: boolean; error: boolean; destinationAllowed: boolean; sessionPaused?: boolean },
): GettingStartedCardModel {
  let statusText = options.loading ? "Checking your progress…" : options.busy
    ? "Checking your current access…" : "Continue your setup when you're ready.";
  if (options.error) statusText = "We couldn't check your progress. Your saved work hasn't been reset.";
  else if (snapshot?.status === "complete") statusText = "Your setup is complete.";
  else if (snapshot && (snapshot.status === "blocked"
    || snapshot.steps.some(step => step.evidence.state === "unknown"))) {
    const reason = snapshot.steps.find(step => step.evidence.state === "unknown")?.evidence.reason;
    statusText = reason === "builder_adapter_not_enabled"
      ? "Guidance for your assigned Meal Builder isn't available yet. Your assignment is unchanged."
      : "We couldn't confirm the next step. You can keep using the app.";
  } else if (snapshot && !options.destinationAllowed && manualJourneyDestination(snapshot)) {
    statusText = "We need to confirm your access before continuing.";
  }
  const state = preferences?.preferences;
  let preferenceNotice: string | null = null;
  if (preferences?.persistence === "memory_only"
    || (preferences && preferences.issue !== "none" && preferences.issue !== "disposed")) {
    preferenceNotice = "Guidance choices couldn't be saved on this device and may reset when you reload.";
  }
  return {
    stages: snapshot?.steps.filter(step => step.evidence.state !== "not_applicable").map(step => ({
      id: step.id, label: JOURNEY_STAGE_LABELS[step.id], state: step.evidence.state,
      current: step.id === snapshot.nextStep,
    })) ?? [],
    statusText, loading: options.loading, busy: options.busy,
    canContinue: !!snapshot && !!manualJourneyDestination(snapshot) && options.destinationAllowed
      && !options.loading && !options.busy && !!preferences,
    canRetry: !options.loading && !options.busy
      && (options.error || snapshot?.status === "blocked" || (!options.destinationAllowed && snapshot?.status !== "complete")),
    controlsReady: !!preferences && preferences.issue !== "disposed" && !options.busy,
    paused: state?.mode === "paused" || options.sessionPaused === true,
    automaticDisabled: state?.automaticExplanationsEnabled === false,
    replayRequested: state?.replayRequested === true,
    preferenceNotice,
  };
}
