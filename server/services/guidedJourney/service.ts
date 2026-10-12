import { BUILDER_NS } from "../../../shared/builderNamespaces";
import { evaluateOrderedJourney, type JourneySnapshot, type JourneyStep } from "../../../shared/guidedJourney";
import {
  onboardingEvidence, targetEvidence, savedBoardEvidence,
  incomplete, unknown, notApplicable, type TargetRecord, type SavedBoardRecord,
} from "./evidence";

export interface JourneyAccount extends TargetRecord {
  onboardingCompletedAt: unknown;
  activeBoard: string | null;
  selectedMealBuilder: string | null;
  activeHouseholdProfileId: string | null;
}
export interface JourneyActor {
  id: string;
  role: string;
  professionalRole: string | null;
  isSandbox: boolean;
  /** Supplied by existing server authentication/access resolution, never client input. */
  mealPlanningAccess: "allowed" | "denied" | "unknown";
}
export interface JourneyRepository {
  readAccount(actorId: string): Promise<JourneyAccount | null>;
  readSavedBoards(actorId: string, namespace: string): Promise<{
    records: SavedBoardRecord[];
    hasMore: boolean;
  }>;
}

/** No target/board writes, cache reads, generated recipes, or Favorites. */
export function createGuidedJourneyService(repository: JourneyRepository) {
  return {
    async inspect(actor: JourneyActor): Promise<JourneySnapshot> {
      const scope = { actorId: actor.id, subjectId: actor.id, workspace: "personal" as const };
      let steps: JourneyStep[] = [
        { id: "get_to_know_you", evidence: unknown("account_read_failed"), action: null },
        { id: "nutrition_targets", evidence: unknown("account_read_failed"), action: null },
        { id: "saved_meal_plan", evidence: unknown("account_read_failed"), action: null },
      ];
      let builderKey: string | null = null;
      let savedPlan: JourneySnapshot["savedPlan"] = null;
      let completionGoal: JourneySnapshot["completionGoal"] = "unresolved";
      const result = (): JourneySnapshot => ({
        version: 1, journeyType: "personal", scope, steps,
        ...evaluateOrderedJourney(steps), builderKey, savedPlan, completionGoal,
      });
      if (!actor.id || actor.id.startsWith("guest-") || actor.role !== "client"
        || actor.professionalRole || actor.isSandbox
        || actor.id === "00000000-0000-0000-0000-000000000001") {
        steps = steps.map(step => ({ ...step, evidence: notApplicable("unsupported_account_context") }));
        return result();
      }
      let account: JourneyAccount | null;
      try { account = await repository.readAccount(actor.id); }
      catch { return result(); }
      if (!account) {
        steps = steps.map(step => ({ ...step, evidence: unknown("account_not_found") }));
        return result();
      }
      if (account.activeHouseholdProfileId) {
        scope.subjectId = account.activeHouseholdProfileId;
        steps = steps.map(step => ({ ...step, evidence: notApplicable("household_adapter_not_enabled") }));
        return result();
      }
      steps[0] = { ...steps[0], evidence: onboardingEvidence(account.onboardingCompletedAt),
        action: { kind: "open_existing_activity", route: "/onboarding" } };
      steps[1] = { ...steps[1], evidence: targetEvidence(account),
        action: { kind: "open_existing_activity", route: "/macro-counter" } };
      // Clear activities when reads are ambiguous; no forced recalculation/re-entry.
      for (const step of steps.slice(0, 2)) {
        if (step.evidence.state !== "incomplete") step.action = null;
      }
      builderKey = account.activeBoard ?? account.selectedMealBuilder;
      if (actor.mealPlanningAccess === "denied") {
        completionGoal = "personal_setup";
        steps[2].evidence = notApplicable("meal_planning_not_available");
        return result();
      }
      if (actor.mealPlanningAccess === "unknown") {
        steps[2].evidence = unknown("access_unverified");
        return result();
      }
      completionGoal = "saved_meal_plan";
      if (builderKey == null) {
        steps[2].evidence = unknown("builder_selection_required");
        steps[2].action = { kind: "select_builder", route: "/select-builder" };
        return result();
      }
      if (builderKey !== "general_nutrition") {
        steps[2].evidence = unknown(builderKey ? "builder_adapter_not_enabled" : "invalid_builder_assignment");
        return result();
      }
      try {
        const history = await repository.readSavedBoards(actor.id, BUILDER_NS.GENERAL_NUTRITION);
        let uncertain = history.hasMore;
        for (const record of history.records) {
          const evidence = savedBoardEvidence(record);
          if (evidence.state === "complete") {
            steps[2].evidence = evidence;
            savedPlan = { weekStartISO: record.weekStartISO, namespace: BUILDER_NS.GENERAL_NUTRITION };
            return result();
          }
          if (evidence.state === "unknown") uncertain = true;
        }
        steps[2].evidence = uncertain ? unknown("saved_plan_history_unresolved")
          : incomplete("no_saved_meal_plan");
        if (!uncertain) steps[2].action = {
          kind: "open_existing_activity", route: "/general-nutrition-builder/build",
        };
      } catch { steps[2].evidence = unknown("saved_plan_read_failed"); }
      return result();
    },
  };
}
