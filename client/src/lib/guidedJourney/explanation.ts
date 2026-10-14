import type { JourneySnapshot, JourneyStepId } from "../../../../shared/guidedJourney";
import { journeyMealBuilderAllowed, type JourneyDashboardAccount } from "./dashboardScope";
import { mealBuilderGuidance } from "@shared/mealBuilderGuidance";

const copy: Record<JourneyStepId, { title: string; description: string; primaryLabel: string }> = {
  get_to_know_you: {
    title: "Let's Get to Know You",
    description: "Tell us a little about yourself, the foods you enjoy, and your nutrition goals. We'll use this information to personalize your My Perfect Meals experience.",
    primaryLabel: "Start Setup",
  },
  nutrition_targets: {
    title: "Let's Set Your Nutrition Targets",
    description: "Now we'll calculate your daily calories, protein, carbohydrates, and fats using your information. Review your results and save them when you're ready.",
    primaryLabel: "Open Calculator",
  },
  saved_meal_plan: {
    title: "Let's Create Your First Meal",
    description: "Your nutrition information is ready. Now we'll show you how to create a meal and add it to your Meal Builder so you can start building your meal plan.",
    primaryLabel: "Create My First Meal",
  },
};

export interface GuidedJourneyExplanationModel {
  stageId: JourneyStepId;
  title: string;
  description: string;
  indicator: string;
  builderName: string | null;
  primaryLabel: string;
  canPerform: boolean;
  activityNotice: string | null;
  secondaryLabel: string | null;
}

export function explanationJourneyAllowed(
  snapshot: JourneySnapshot, account: JourneyDashboardAccount | null,
): boolean {
  if (!account || account.role !== "client" || account.professionalRole || account.isSandbox
    || snapshot.scope.workspace !== "personal" || snapshot.scope.actorId !== account.id
    || snapshot.scope.subjectId !== account.id
    || !["in_progress", "complete"].includes(snapshot.status)
    || snapshot.steps.some(step => step.evidence.state === "unknown")) return false;
  const mealStage = snapshot.steps.find(step => step.id === "saved_meal_plan");
  return mealStage?.evidence.state === "not_applicable"
    || (!!mealBuilderGuidance(snapshot.builderKey) && journeyMealBuilderAllowed(account, snapshot.builderKey ?? undefined));
}

export function explanationStages(snapshot: JourneySnapshot) {
  return snapshot.steps.filter(step => step.evidence.state !== "not_applicable");
}

export function explanationModel(
  snapshot: JourneySnapshot, stageId: JourneyStepId, replay: boolean, busy: boolean,
): GuidedJourneyExplanationModel | null {
  const stages = explanationStages(snapshot);
  const index = stages.findIndex(step => step.id === stageId);
  if (index < 0) return null;
  const stage = stages[index];
  const completed = stage.evidence.state === "complete";
  return {
    stageId, ...copy[stageId],
    indicator: `Stage ${index + 1} of ${stages.length}${replay ? " · Explanation replay" : ""}`,
    builderName: stageId === "saved_meal_plan" ? mealBuilderGuidance(snapshot.builderKey)?.name ?? null : null,
    canPerform: !busy && !completed && snapshot.nextStep === stageId,
    activityNotice: completed
      ? "This activity is already complete. Reviewing its explanation does not reset your saved work."
      : snapshot.nextStep !== stageId ? "Complete the earlier activity before opening this one." : null,
    secondaryLabel: replay
      ? index < stages.length - 1 ? "Next Explanation" : "Finish Explanations"
      : "Close & Pause",
  };
}
