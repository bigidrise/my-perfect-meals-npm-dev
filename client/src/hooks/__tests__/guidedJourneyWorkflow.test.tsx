/** @jest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { useGuidedJourneyDashboard } from "../useGuidedJourneyDashboard";
import { apiRequest } from "@/lib/apiRequest";
import { beginWorkflowSave, confirmWorkflowSave, personalWorkflowSaveEnabled, workflowHandoff } from "@/lib/guidedJourney/workflow";
import { isPersonalJourneyWorkflow, journeyDashboardContextKey, type JourneyDashboardAccount } from "@/lib/guidedJourney/dashboardScope";
import { createGuidancePreferenceStore } from "@/lib/guidedJourney/preferences";
import { acquireGuidanceInteractionBlock } from "@/lib/guidedJourney/presentation";
import { createGuidedJourneyService } from "../../../../server/services/guidedJourney/service";
import type { JourneySnapshot } from "../../../../shared/guidedJourney";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
let number = 0;
let account: JourneyDashboardAccount;
const context = { development: true, path: "/macro-counter", workspace: "personal", householdProfileId: null };
const targets = { calories: 1800, protein_g: 120, carbs_g: 0, fat_g: 80 };
async function snapshot(options: { onboarded?: boolean; targets?: boolean; partial?: boolean; free?: boolean } = {}): Promise<JourneySnapshot> {
  return createGuidedJourneyService({
    readAccount: async () => ({
      onboardingCompletedAt: options.onboarded ? new Date("2026-10-12") : null,
      dailyCalorieTarget: options.targets ? 1800 : null,
      dailyProteinTarget: options.targets && !options.partial ? 120 : null,
      dailyCarbsTarget: options.targets ? 0 : null, dailyFatTarget: options.targets ? 80 : null,
      activeBoard: "general_nutrition", selectedMealBuilder: null, activeHouseholdProfileId: null,
    }),
    readSavedBoards: async () => ({ records: [], hasMore: false }),
  }).inspect({ id: account.id, role: "client", professionalRole: null, isSandbox: false,
    mealPlanningAccess: options.free ? "denied" : "allowed" });
}
function input() {
  return { account, contextKey: journeyDashboardContextKey(account, context), eligible: true,
    isCurrentContextPersonal: jest.fn(() => true), refreshAccount: jest.fn(async () => account), navigate: jest.fn() };
}
beforeEach(() => {
  account = { id: `workflow-${++number}`, role: "client", professionalRole: null, accessTier: "PAID_FULL",
    activeBoard: "general_nutrition", isSandbox: false };
  request.mockReset(); localStorage.clear();
});
afterEach(cleanup);

test.each([false, true])("new/interrupted onboarding offers no completed handoff (%s)", async savedTargets => {
  expect(workflowHandoff(await snapshot({ targets: savedTargets }), account)).toBeNull();
});
test("existing completed onboarding offers calculator without repeating onboarding", async () => {
  const state = await snapshot({ onboarded: true });
  expect(workflowHandoff(state, account)?.message).toContain("onboarding is confirmed");
  expect(state.nextStep).toBe("nutrition_targets");
});
test("existing zero-carb saved targets count without a new calculation or save", async () => {
  expect(workflowHandoff(await snapshot({ onboarded: true, targets: true }), account)?.message).toContain("saved nutrition targets are confirmed");
  expect(request).not.toHaveBeenCalled();
});
test("ambiguous legacy targets do not offer success or a next destination", async () => {
  expect(workflowHandoff(await snapshot({ onboarded: true, targets: true, partial: true }), account)).toBeNull();
});
test("Free completed setup offers Dashboard instead of a paid meal stage", async () => {
  account.accessTier = "FREE";
  const state = await snapshot({ onboarded: true, targets: true, free: true });
  expect(workflowHandoff(state, account)?.destination).toBe("dashboard");
  expect(state.steps[2].evidence.state).toBe("not_applicable");
});
test("confirmed target save compares exact server values including zero carbs", async () => {
  beginWorkflowSave(account.id, "nutrition_targets", true, targets).saved();
  request.mockResolvedValue({ ...targets, hasTargets: true });
  await expect(confirmWorkflowSave(await snapshot({ onboarded: true, targets: true }), account.id)).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledWith(`/api/users/${account.id}/macro-targets`, expect.objectContaining({ cache: "no-store" }));
  request.mockClear();
  await confirmWorkflowSave(await snapshot({ onboarded: true, targets: true }), account.id);
  expect(request).not.toHaveBeenCalled(); // Later authority must not be pinned to old expected values.
});
test.each([
  { ...targets, carbs_g: 30, hasTargets: true },
  { ...targets, protein_g: null, hasTargets: true },
  { ...targets, hasTargets: false },
])("old/defaulted/mismatched target response cannot confirm a replacement", async stored => {
  beginWorkflowSave(account.id, "nutrition_targets", true, targets).saved();
  request.mockResolvedValue(stored);
  await expect(confirmWorkflowSave(await snapshot({ onboarded: true, targets: true }), account.id)).rejects.toThrow();
});
test("success HTTP hint without saved onboarding evidence is not completion", async () => {
  beginWorkflowSave(account.id, "get_to_know_you", true).saved();
  await expect(confirmWorkflowSave(await snapshot(), account.id)).rejects.toThrow();
});
test("failed target save never produces current-save success; existing saved evidence is retained", async () => {
  beginWorkflowSave(account.id, "nutrition_targets", true, targets).failed();
  expect(workflowHandoff(await snapshot({ onboarded: true }), account)?.message).not.toContain("nutrition targets are confirmed");
  expect(workflowHandoff(await snapshot({ onboarded: true, targets: true }), account)?.message).toContain("latest save wasn't confirmed");
});
test("target success is independent of a subsequent biometric failure", async () => {
  const save = beginWorkflowSave(account.id, "nutrition_targets", true, targets);
  save.saved();
  save.failed(); // A later ancillary failure cannot overwrite target success.
  request.mockResolvedValue({ ...targets, hasTargets: true });
  const state = await snapshot({ onboarded: true, targets: true });
  await confirmWorkflowSave(state, account.id);
  expect(workflowHandoff(state, account)?.message).not.toContain("latest save wasn't confirmed");
});
test("an in-progress save is not a completed activity", async () => {
  beginWorkflowSave(account.id, "nutrition_targets", true, targets);
  expect(workflowHandoff(await snapshot({ onboarded: true, targets: true }), account)).toBeNull();
});
test("blocked storage and nonpersonal contexts disable signals without failing the native save", () => {
  expect(personalWorkflowSaveEnabled(false, account, null)).toBe(false);
  expect(personalWorkflowSaveEnabled(true, account, "child")).toBe(false);
  expect(personalWorkflowSaveEnabled(true, account, null, true)).toBe(false);
  const getter = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(personalWorkflowSaveEnabled(true, account, null)).toBe(false);
  getter.mockRestore();
});
test.each([
  { development: false }, { householdProfileId: "household-child" }, { workspace: "business" }, { path: "/general-nutrition-builder/build" },
])("workflow scope excludes nonpersonal or nonapproved contexts %j", patch => {
  expect(isPersonalJourneyWorkflow(account, { ...context, ...patch })).toBe(false);
});
test("trial expiration/assignment changes cannot offer the meal destination", async () => {
  const state = await snapshot({ onboarded: true, targets: true });
  expect(workflowHandoff(state, { ...account, accessTier: "FREE" })).toBeNull();
  expect(workflowHandoff(state, { ...account, studioMembership: { assignedBuilder: "diabetic" } as any })).toBeNull();
});
test("workflow event refreshes authority, but never opens or navigates automatically", async () => {
  let state = await snapshot();
  request.mockImplementation(async () => state);
  const options = input();
  const hook = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  state = await snapshot({ onboarded: true });
  act(() => beginWorkflowSave(account.id, "get_to_know_you", true).saved());
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  expect(hook.result.current.explanation).toBeNull();
  expect(options.navigate).not.toHaveBeenCalled();
});
test("manual Next Step remains available when paused and automatic guidance is off", async () => {
  createGuidancePreferenceStore({ accountId: account.id }).apply("disable_automatic");
  request.mockResolvedValue(await snapshot({ onboarded: true }));
  const options = input();
  const hook = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  await act(async () => { await hook.result.current.nextStep(); });
  expect(hook.result.current.explanation?.stageId).toBe("nutrition_targets");
  expect(hook.result.current.model.automaticDisabled).toBe(true);
  expect(hook.result.current.model.paused).toBe(true);
  expect(options.navigate).not.toHaveBeenCalled();
});
test("unknown confirmation removes a stale next offer and Retry confirms without opening", async () => {
  const state = await snapshot({ onboarded: true, targets: true });
  let failed = true;
  request.mockImplementation(async url => {
    if (url.includes("macro-targets")) {
      if (failed) throw new Error("503");
      return { ...targets, hasTargets: true };
    }
    return state;
  });
  beginWorkflowSave(account.id, "nutrition_targets", true, targets).saved();
  const hook = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(hook.result.current.model.canRetry).toBe(true));
  expect(hook.result.current.handoff).toBeNull();
  failed = false;
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  expect(hook.result.current.explanation).toBeNull();
});
test("native dialogs defer manual Next Step and their release does not reopen", async () => {
  request.mockResolvedValue(await snapshot({ onboarded: true }));
  const hook = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  const release = acquireGuidanceInteractionBlock();
  await act(async () => { await hook.result.current.nextStep(); });
  expect(hook.result.current.explanation).toBeNull();
  release();
  expect(hook.result.current.explanation).toBeNull();
});
test("Free Next Step rechecks account/progress and goes only to Dashboard on explicit click", async () => {
  account.accessTier = "FREE";
  request.mockResolvedValue(await snapshot({ onboarded: true, targets: true, free: true }));
  const options = input();
  const hook = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  expect(options.navigate).not.toHaveBeenCalled();
  await act(async () => { await hook.result.current.nextStep(); });
  expect(options.refreshAccount).toHaveBeenCalledTimes(1);
  expect(options.navigate).toHaveBeenCalledWith("/dashboard");
});
test("Next Step uses current activity, not a stored explanation replay request", async () => {
  createGuidancePreferenceStore({ accountId: account.id }).apply("restart_explanations");
  request.mockResolvedValue(await snapshot({ onboarded: true }));
  const hook = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  await act(async () => { await hook.result.current.nextStep(); });
  expect(hook.result.current.explanation?.stageId).toBe("nutrition_targets");
  expect(hook.result.current.explanation?.indicator).not.toContain("replay");
  expect(hook.result.current.model.replayRequested).toBe(true);
});
test("completion arriving before a manual Next Step goes to Dashboard, not completed activities", async () => {
  account.accessTier = "FREE";
  request.mockResolvedValue(await snapshot({ onboarded: true, free: true }));
  const options = input();
  const hook = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  request.mockResolvedValue(await snapshot({ onboarded: true, targets: true, free: true }));
  await act(async () => { await hook.result.current.nextStep(); });
  expect(options.navigate).toHaveBeenCalledWith("/dashboard");
  expect(hook.result.current.explanation).toBeNull();
});
test("late workflow callbacks after navigation/account switching cannot navigate or cross scope", async () => {
  request.mockResolvedValue(await snapshot({ onboarded: true }));
  let options = input();
  const hook = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(hook.result.current.handoff).not.toBeNull());
  const oldNext = hook.result.current.nextStep;
  const oldAccount = account;
  account = { ...account, id: `${account.id}-other` };
  request.mockResolvedValue(await snapshot());
  options = input();
  hook.rerender();
  await act(async () => { beginWorkflowSave(oldAccount.id, "get_to_know_you", true).saved(); await oldNext(); });
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.handoff).toBeNull();
  expect(options.navigate).not.toHaveBeenCalled();
});
test("real workflow signals occur only beyond native successful save boundaries", () => {
  const onboarding = readFileSync("client/src/pages/OnboardingV3.tsx", "utf8");
  expect(onboarding.indexOf('beginWorkflowSave(user?.id, "get_to_know_you"')).toBeGreaterThan(onboarding.indexOf("await refreshUser();"));
  expect(onboarding).toContain('setLocation("/macro-counter?from=onboarding")');
  const calculator = readFileSync("client/src/pages/MacroCalculator.tsx", "utf8");
  expect(calculator.indexOf("guidedSave.saved();")).toBeGreaterThan(calculator.indexOf("await setMacroTargets(targets, user?.id);"));
  expect(calculator.indexOf("guidedSave.saved();")).toBeLessThan(calculator.indexOf("const [weightResult, waistResult, bodyFatResult]"));
  expect(calculator).toContain("options?.onComplete?.();");
  expect(calculator).toContain('summaryVisible={guidedStep === "done" && !!results}');
});
