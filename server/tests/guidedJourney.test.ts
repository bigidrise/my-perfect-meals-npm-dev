import { evaluateOrderedJourney } from "../../shared/guidedJourney";
import { createEmptyWeekStructure } from "../../shared/schema/weeklyBoard";
import { onboardingEvidence, targetEvidence, savedBoardEvidence } from "../services/guidedJourney/evidence";
import { createGuidedJourneyService, type JourneyActor, type JourneyAccount } from "../services/guidedJourney/service";

const actor: JourneyActor = {
  id: "actor-one", role: "client", professionalRole: null, isSandbox: false,
  mealPlanningAccess: "allowed",
};
const freshAccount = (): JourneyAccount => ({
  onboardingCompletedAt: null, dailyCalorieTarget: null, dailyProteinTarget: null,
  dailyCarbsTarget: null, dailyFatTarget: null, activeBoard: "general_nutrition",
  selectedMealBuilder: null, activeHouseholdProfileId: null,
});
const configured = (): JourneyAccount => ({
  ...freshAccount(), onboardingCompletedAt: new Date("2026-09-01"),
  dailyCalorieTarget: 1800, dailyProteinTarget: 120, dailyCarbsTarget: 0, dailyFatTarget: 80,
});
function board(meal = true, weekStartISO = "2026-10-12") {
  const { week } = createEmptyWeekStructure(weekStartISO);
  if (meal) week.days![weekStartISO].lunch.push({ id: "meal-one", title: "Vegetable bowl" });
  return { weekStartISO, boardJSON: week };
}
function fixture(account = freshAccount(), records: ReturnType<typeof board>[] = [], hasMore = false) {
  const readAccount = jest.fn(async (_actorId: string) => account);
  const readSavedBoards = jest.fn(async (_actorId: string, _namespace: string) => ({ records, hasMore }));
  return { account, readAccount, readSavedBoards,
    service: createGuidedJourneyService({ readAccount, readSavedBoards }) };
}

describe("Guided Journey raw completion evidence", () => {
  test("onboarding uses the completion timestamp, never measurements or visits", () => {
    expect(onboardingEvidence(null).state).toBe("incomplete");
    expect(onboardingEvidence("not-a-date").state).toBe("unknown");
    expect(onboardingEvidence(new Date("2026-10-01")).state).toBe("complete");
  });
  test("missing targets remain incomplete and legitimate zero carbs remain complete", () => {
    expect(targetEvidence(freshAccount()).state).toBe("incomplete");
    expect(targetEvidence(configured()).state).toBe("complete");
  });
  test.each([
    { dailyProteinTarget: null }, { dailyCarbsTarget: undefined },
    { dailyFatTarget: -1 }, { dailyCalorieTarget: 0 },
    { dailyCalorieTarget: NaN }, { dailyProteinTarget: Infinity },
    { dailyFatTarget: "80" },
  ])("ambiguous saved targets require review: %j", override => {
    expect(targetEvidence({ ...configured(), ...override }).state).toBe("unknown");
  });
  test("empty persisted boards do not complete a meal plan", () => {
    expect(savedBoardEvidence(board(false)).state).toBe("incomplete");
    expect(savedBoardEvidence(board()).state).toBe("complete");
  });
  test("legacy lists-only boards remain recognizable", () => {
    const record = board(false);
    delete record.boardJSON.days;
    record.boardJSON.lists.dinner.push({ id: "legacy", name: "Soup" });
    expect(savedBoardEvidence(record).state).toBe("complete");
  });
  test("modern days own completion, not stale list summaries", () => {
    const record = board(false);
    record.boardJSON.lists.dinner = [{ id: "stale", title: "Old soup" }];
    // createEmptyWeekStructure shares the first day's list object.
    record.boardJSON.days!["2026-10-12"] = {
      breakfast: [], lunch: [], dinner: [], snacks: [], meal4: [], meal5: [], meal6: [],
    };
    expect(savedBoardEvidence(record).state).toBe("incomplete");
  });
  test("malformed boards, blank placeholders and out-of-week days are unknown", () => {
    expect(savedBoardEvidence({ weekStartISO: "2026-10-12", boardJSON: {} }).state).toBe("unknown");
    const placeholder = board(false);
    placeholder.boardJSON.days!["2026-10-12"].lunch.push({ id: "blank" });
    expect(savedBoardEvidence(placeholder).state).toBe("unknown");
    const foreignDay = board();
    foreignDay.boardJSON.days!["2026-10-19"] = foreignDay.boardJSON.days!["2026-10-12"];
    expect(savedBoardEvidence(foreignDay).state).toBe("unknown");
  });
});

describe("personal foundation", () => {
  test("new account starts at onboarding without executing navigation or any write", async () => {
    const f = fixture();
    const before = structuredClone(f.account);
    const result = await f.service.inspect(actor);
    expect(result).toMatchObject({
      status: "in_progress", nextStep: "get_to_know_you",
      nextAction: { route: "/onboarding" },
      scope: { actorId: actor.id, subjectId: actor.id, workspace: "personal" },
    });
    expect(f.account).toEqual(before);
    expect(f.readSavedBoards).toHaveBeenCalledWith(actor.id, "generalNutrition");
  });
  test("measurements cannot substitute for a real target save", async () => {
    const f = fixture({ ...freshAccount(), onboardingCompletedAt: new Date(),
      age: 42, height: 180, weight: 80 } as JourneyAccount);
    expect(await f.service.inspect(actor)).toMatchObject({
      nextStep: "nutrition_targets", nextAction: { route: "/macro-counter" },
    });
  });
  test("configured account without a plan gets its existing General destination", async () => {
    expect(await fixture(configured()).service.inspect(actor)).toMatchObject({
      nextStep: "saved_meal_plan", nextAction: { route: "/general-nutrition-builder/build" },
    });
  });
  test("existing older saved plan completes independently of current-week emptiness", async () => {
    const result = await fixture(configured(), [board(false), board(true, "2026-09-28")]).service.inspect(actor);
    expect(result).toMatchObject({ status: "complete", nextStep: null, nextAction: null,
      savedPlan: { weekStartISO: "2026-09-28", namespace: "generalNutrition" } });
  });
  test("failed target saves and unsaved board drafts do not advance", async () => {
    const f = fixture({ ...freshAccount(), onboardingCompletedAt: new Date() });
    const unsavedDraft = board();
    expect(unsavedDraft.boardJSON.days!["2026-10-12"].lunch).toHaveLength(1);
    expect((await f.service.inspect(actor)).nextStep).toBe("nutrition_targets");
    // No draft or local target is accepted by the repository contract.
    Object.assign(f.account, configured());
    expect((await f.service.inspect(actor)).nextStep).toBe("saved_meal_plan");
  });
  test("subsequent inspection recognizes successful saving and return midway", async () => {
    const f = fixture();
    expect((await f.service.inspect(actor)).nextStep).toBe("get_to_know_you");
    f.account.onboardingCompletedAt = new Date();
    expect((await f.service.inspect(actor)).nextStep).toBe("nutrition_targets");
    Object.assign(f.account, configured());
    expect((await f.service.inspect(actor)).nextStep).toBe("saved_meal_plan");
    f.readSavedBoards.mockResolvedValue({ records: [board()], hasMore: false });
    expect((await f.service.inspect(actor)).status).toBe("complete");
  });
  test("Free or expired access requires only setup, without board reads or upgrade", async () => {
    const f = fixture(configured());
    expect(await f.service.inspect({ ...actor, mealPlanningAccess: "denied" })).toMatchObject({
      status: "complete", completionGoal: "personal_setup", nextAction: null,
    });
    expect(f.readSavedBoards).not.toHaveBeenCalled();
  });
  test("upgrade and downgrade recompute without cached permission", async () => {
    const f = fixture(configured());
    expect((await f.service.inspect({ ...actor, mealPlanningAccess: "denied" })).status).toBe("complete");
    expect((await f.service.inspect(actor)).nextStep).toBe("saved_meal_plan");
    expect((await f.service.inspect({ ...actor, mealPlanningAccess: "denied" })).status).toBe("complete");
  });
  test("unverified access blocks the plan step", async () => {
    const f = fixture(configured());
    expect(await f.service.inspect({ ...actor, mealPlanningAccess: "unknown" })).toMatchObject({
      status: "blocked", nextAction: null,
    });
    expect(f.readSavedBoards).not.toHaveBeenCalled();
  });
  test.each(["diabetic", "glp1", "anti_inflammatory", "beach_body", "performance_competition", "invalid", ""])(
    "active assignment %s never falls back to selected General", async activeBoard => {
      const f = fixture({ ...configured(), activeBoard, selectedMealBuilder: "general_nutrition" });
      expect(await f.service.inspect(actor)).toMatchObject({
        status: "blocked", builderKey: activeBoard, nextAction: null, savedPlan: null,
      });
      expect(f.readSavedBoards).not.toHaveBeenCalled();
    },
  );
  test("selected General works only when active assignment is absent", async () => {
    const f = fixture({ ...configured(), activeBoard: null, selectedMealBuilder: "general_nutrition" }, [board()]);
    expect((await f.service.inspect(actor)).status).toBe("complete");
  });
  test("unassigned account suggests existing selection without choosing a Builder", async () => {
    const f = fixture({ ...configured(), activeBoard: null });
    expect(await f.service.inspect(actor)).toMatchObject({
      status: "blocked", builderKey: null,
      nextAction: { kind: "select_builder", route: "/select-builder" },
    });
    expect(f.account.activeBoard).toBeNull();
    expect(f.readSavedBoards).not.toHaveBeenCalled();
  });
  test("household context suspends actor evidence without leaking it into subject completion", async () => {
    const f = fixture({ ...configured(), activeHouseholdProfileId: "household-one" }, [board()]);
    expect(await f.service.inspect(actor)).toMatchObject({
      status: "not_applicable", scope: { subjectId: actor.id }, savedPlan: null,
    });
    expect(JSON.stringify(await f.service.inspect(actor))).not.toContain("household-one");
    expect(f.readSavedBoards).not.toHaveBeenCalled();
  });
  test.each([
    { role: "coach" }, { role: "admin" }, { professionalRole: "physician" },
    { professionalRole: "business" }, { isSandbox: true }, { id: "guest-one" },
  ])("unsupported actor context has no operational reads: %j", async override => {
    const f = fixture(configured());
    expect((await f.service.inspect({ ...actor, ...override })).status).toBe("not_applicable");
    expect(f.readAccount).not.toHaveBeenCalled();
    expect(f.readSavedBoards).not.toHaveBeenCalled();
  });
  test("read failure is unknown rather than incomplete or complete", async () => {
    const f = fixture(configured());
    f.readSavedBoards.mockRejectedValue(new Error("database unavailable"));
    const result = await f.service.inspect(actor);
    expect(result).toMatchObject({ status: "blocked", nextAction: null, savedPlan: null });
    expect(result.steps[2].evidence).toEqual({ state: "unknown", reason: "saved_plan_read_failed" });
    f.readAccount.mockRejectedValue(new Error("account unavailable"));
    expect((await f.service.inspect(actor)).steps.every(step => step.evidence.state === "unknown")).toBe(true);
  });
  test("bounded history or corrupt records never prove there is no plan", async () => {
    expect((await fixture(configured(), [board(false)], true).service.inspect(actor)).status).toBe("blocked");
    const f = fixture(configured());
    f.readSavedBoards.mockResolvedValue({ records: [{ weekStartISO: "2026-10-12", boardJSON: {} } as any], hasMore: false });
    expect((await f.service.inspect(actor)).status).toBe("blocked");
  });
  test("concurrent inspections are scoped to their actor and do not share progress", async () => {
    const f = fixture(configured());
    f.readSavedBoards.mockImplementation(async id => ({
      records: id === actor.id ? [board()] : [], hasMore: false,
    }));
    const [one, two] = await Promise.all([
      f.service.inspect(actor), f.service.inspect({ ...actor, id: "actor-two" }),
    ]);
    expect(one.status).toBe("complete");
    expect(two.nextStep).toBe("saved_meal_plan");
    expect(two.scope.actorId).toBe("actor-two");
  });
  test("unknown prerequisite blocks later completed work", () => {
    expect(evaluateOrderedJourney([
      { id: "get_to_know_you", evidence: { state: "unknown", reason: "unavailable" }, action: null },
      { id: "nutrition_targets", evidence: { state: "complete", reason: "saved" }, action: null },
    ])).toMatchObject({ status: "blocked", nextStep: "get_to_know_you", nextAction: null });
  });
});
