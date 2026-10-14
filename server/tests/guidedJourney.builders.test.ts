import { createGuidedJourneyService } from "../services/guidedJourney/service";
import { MEAL_BUILDER_GUIDANCE, type GuidedMealBuilderKey } from "../../shared/mealBuilderGuidance";
import { manualJourneyDestination } from "../../client/src/lib/guidedJourney/dashboardModel";
import { parsePersonalJourneyProgress } from "../../client/src/lib/guidedJourney/progress";

jest.mock("../../client/src/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const actor = { id: "synthetic-builder-owner", role: "client", professionalRole: null, isSandbox: false, mealPlanningAccess: "allowed" as const };
function service(builderKey: string, boards: unknown[] = []) {
  const readSavedBoards = jest.fn(async () => ({ records: boards, hasMore: false }));
  const inspect = createGuidedJourneyService({
    readAccount: async () => ({
      onboardingCompletedAt: "2026-10-01", dailyCalorieTarget: 1800, dailyProteinTarget: 120,
      dailyCarbsTarget: 130, dailyFatTarget: 65,
      activeBoard: builderKey, selectedMealBuilder: "general_nutrition", activeHouseholdProfileId: null,
    }),
    readSavedBoards: readSavedBoards as any,
  });
  return { inspect, readSavedBoards };
}

test.each(Object.keys(MEAL_BUILDER_GUIDANCE) as GuidedMealBuilderKey[])(
  "%s handoff uses its own route and exact saved-board namespace, never General Nutrition fallback",
  async key => {
    const fixture = service(key);
    const progress = await fixture.inspect.inspect(actor);
    const definition = MEAL_BUILDER_GUIDANCE[key];
    expect(fixture.readSavedBoards).toHaveBeenCalledWith(actor.id, definition.namespace);
    expect(progress.nextStep).toBe("saved_meal_plan");
    expect(manualJourneyDestination(progress)).toBe(definition.route);
    expect(parsePersonalJourneyProgress(progress, actor.id).builderKey).toBe(key);
  },
);

test("unknown builders remain unresolved rather than being silently substituted", async () => {
  const fixture = service("unsupported_builder");
  const progress = await fixture.inspect.inspect(actor);
  expect(fixture.readSavedBoards).not.toHaveBeenCalled();
  expect(manualJourneyDestination(progress)).toBeNull();
});

test("saved-plan metadata cannot use another builder's namespace", async () => {
  const fixture = service("diabetic");
  const progress = await fixture.inspect.inspect(actor);
  expect(() => parsePersonalJourneyProgress({
    ...progress, savedPlan: { weekStartISO: "2026-10-12", namespace: "generalNutrition" },
  }, actor.id)).toThrow("Builder scope");
});

test("professional actors never inherit the personal owner's setup or board evidence", async () => {
  const fixture = service("diabetic");
  const progress = await fixture.inspect.inspect({ ...actor, role: "physician", professionalRole: "physician" });
  expect(progress.status).toBe("not_applicable");
  expect(fixture.readSavedBoards).not.toHaveBeenCalled();
});
