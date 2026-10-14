import { z } from "zod";
import { apiRequest } from "@/lib/apiRequest";
import { evaluateOrderedJourney, type JourneySnapshot } from "../../../../shared/guidedJourney";
import { mealBuilderGuidance } from "@shared/mealBuilderGuidance";

const action = z.object({
  kind: z.enum(["open_existing_activity", "select_builder"]), route: z.string().max(150),
}).strict().nullable();
const snapshotSchema = z.object({
  version: z.literal(1), journeyType: z.literal("personal"),
  scope: z.object({ actorId: z.string(), subjectId: z.string(), workspace: z.literal("personal") }).strict(),
  status: z.enum(["in_progress", "complete", "blocked", "not_applicable"]),
  steps: z.array(z.object({
    id: z.enum(["get_to_know_you", "nutrition_targets", "saved_meal_plan"]),
    evidence: z.object({
      state: z.enum(["complete", "incomplete", "unknown", "not_applicable"]), reason: z.string().max(200),
    }).strict(),
    action,
  }).strict()).length(3),
  nextStep: z.enum(["get_to_know_you", "nutrition_targets", "saved_meal_plan"]).nullable(),
  nextAction: action, builderKey: z.string().max(100).nullable(),
  savedPlan: z.object({ weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), namespace: z.string().max(100) }).strict().nullable(),
  completionGoal: z.enum(["personal_setup", "saved_meal_plan", "unresolved"]),
}).strict();

export function parsePersonalJourneyProgress(value: unknown, accountId: string): JourneySnapshot {
  const snapshot = snapshotSchema.parse(value);
  if (snapshot.scope.actorId !== accountId || snapshot.scope.subjectId !== accountId
    || snapshot.steps.map(step => step.id).join(",") !== "get_to_know_you,nutrition_targets,saved_meal_plan") {
    throw new Error("Progress scope could not be verified.");
  }
  const evaluated = evaluateOrderedJourney(snapshot.steps);
  if (snapshot.savedPlan && (!mealBuilderGuidance(snapshot.builderKey)
    || snapshot.savedPlan.namespace !== mealBuilderGuidance(snapshot.builderKey)?.namespace)) {
    throw new Error("Saved plan Builder scope could not be verified.");
  }
  if (evaluated.status !== snapshot.status || evaluated.nextStep !== snapshot.nextStep
    || JSON.stringify(evaluated.nextAction) !== JSON.stringify(snapshot.nextAction)) {
    throw new Error("Progress state could not be verified.");
  }
  if ((snapshot.completionGoal === "personal_setup"
      && snapshot.steps[2].evidence.state !== "not_applicable")
    || (snapshot.steps[2].evidence.state === "complete"
      && (!snapshot.savedPlan || !mealBuilderGuidance(snapshot.builderKey)
        || snapshot.savedPlan.namespace !== mealBuilderGuidance(snapshot.builderKey)?.namespace))) {
    throw new Error("Saved setup evidence could not be verified.");
  }
  return snapshot;
}

export async function fetchPersonalJourneyProgress(
  accountId: string, signal?: AbortSignal,
): Promise<JourneySnapshot> {
  const value = await apiRequest("/api/guided-journey/progress", {
    method: "GET", cache: "no-store", signal,
  });
  return parsePersonalJourneyProgress(value, accountId);
}
