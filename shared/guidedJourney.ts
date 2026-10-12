/** Read-only task evidence. Presentation preferences never belong in this model. */
export type JourneyType = "personal" | "professional" | "organization";
export type CompletionState = "complete" | "incomplete" | "unknown" | "not_applicable";
export type JourneyStepId = "get_to_know_you" | "nutrition_targets" | "saved_meal_plan";
export interface JourneyEvidence {
  state: CompletionState;
  reason: string;
}
export interface JourneyAction {
  kind: "open_existing_activity" | "select_builder";
  route: string;
}
export interface JourneyStep {
  id: JourneyStepId;
  evidence: JourneyEvidence;
  action: JourneyAction | null;
}
export interface JourneyScope {
  actorId: string;
  subjectId: string;
  workspace: "personal";
}
export interface JourneySnapshot {
  version: 1;
  journeyType: JourneyType;
  scope: JourneyScope;
  status: "in_progress" | "complete" | "blocked" | "not_applicable";
  steps: JourneyStep[];
  nextStep: JourneyStepId | null;
  nextAction: JourneyAction | null;
  builderKey: string | null;
  savedPlan: { weekStartISO: string; namespace: string } | null;
  /** Completion covers existing records, not whether explanations were viewed. */
  completionGoal: "personal_setup" | "saved_meal_plan" | "unresolved";
}

/**
 * Ordered evaluation is independent of UI, routing side effects, and storage.
 * Future journey definitions may supply different ordered steps/evidence.
 * An unknown prerequisite blocks advancement, even if later tasks are complete.
 */
export function evaluateOrderedJourney<StepId extends string>(
  steps: readonly { id: StepId; evidence: JourneyEvidence; action: JourneyAction | null }[],
): {
  status: JourneySnapshot["status"];
  nextStep: StepId | null;
  nextAction: JourneyAction | null;
} {
  if (steps.every(step => step.evidence.state === "not_applicable")) {
    return { status: "not_applicable", nextStep: null, nextAction: null };
  }
  for (const step of steps) {
    if (step.evidence.state === "unknown") {
      return { status: "blocked", nextStep: step.id, nextAction: step.action };
    }
    if (step.evidence.state === "incomplete") {
      return { status: "in_progress", nextStep: step.id, nextAction: step.action };
    }
  }
  return { status: "complete", nextStep: null, nextAction: null };
}
