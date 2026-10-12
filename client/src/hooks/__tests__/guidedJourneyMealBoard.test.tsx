/** @jest-environment jsdom */
import { act, cleanup, renderHook, waitFor, render, screen, fireEvent } from "@testing-library/react";
import { useGuidedJourneyDashboard } from "../useGuidedJourneyDashboard";
import { useGuidedPersonalMealBoard } from "../useGuidedPersonalMealBoard";
import { useWeeklyBoard } from "../useWeeklyBoard";
import { GuidedMealBoard } from "@/components/guided/GuidedMealBoard";
import { apiRequest } from "@/lib/apiRequest";
import { put } from "@/lib/api";
import { saveWeekBoard, getGuidedPersonalWeekBoard } from "@/lib/boardApi";
import { boardPlacementSignature, confirmPersonalBoard, personalGeneralBoardAllowed, notifyBoardSave, validPlanningWeek } from "@/lib/guidedJourney/mealBoard";
import { createGuidedJourneyService } from "../../../../server/services/guidedJourney/service";
import { createEmptyWeekStructure } from "../../../../shared/schema/weeklyBoard";
import { acquireGuidanceInteractionBlock, resumeGuidanceForSession } from "@/lib/guidedJourney/presentation";
import { createGuidancePreferenceStore } from "@/lib/guidedJourney/preferences";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (value: string) => value }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: true }));
let auth: any;
let household: string | null = null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
jest.mock("@/contexts/HouseholdContext", () => ({ useHousehold: () => ({ activeProfileId: household }) }));
jest.mock("wouter", () => ({ useLocation: () => [window.location.pathname, jest.fn()] }));
const request = apiRequest as jest.Mock;
const week = "2026-10-12";
const owner: any = { id: "board-guide-a", role: "client", professionalRole: null, isSandbox: false,
  accessTier: "PAID_FULL", activeBoard: "general_nutrition" };
const context = { development: true, path: "/general-nutrition-builder/build", workspace: "personal", householdProfileId: null, weekStartISO: week };
function data(saved = true, targetWeek = week, id = "first-meal") {
  const value = createEmptyWeekStructure(targetWeek);
  if (saved) value.week.days![targetWeek].lunch.push({ id, title: "Synthetic bowl" });
  return { ...value, source: "db" as const, subjectId: owner.id, boardNamespace: "generalNutrition" as const };
}
async function snapshot(saved = true, targetWeek = week, account = owner) {
  return createGuidedJourneyService({
    readAccount: async () => ({ onboardingCompletedAt: new Date("2026-10-01"), dailyCalorieTarget: 1800,
      dailyProteinTarget: 120, dailyCarbsTarget: 0, dailyFatTarget: 80,
      activeBoard: account.activeBoard, selectedMealBuilder: null, activeHouseholdProfileId: null }),
    readSavedBoards: async () => ({ records: saved ? [{ weekStartISO: targetWeek, boardJSON: data(true, targetWeek).week }] : [], hasMore: false }),
  }).inspect({ id: account.id, role: "client", professionalRole: null, isSandbox: false, mealPlanningAccess: account.accessTier === "FREE" ? "denied" : "allowed" });
}
async function fixture(saved = true) {
  let currentSnapshot = await snapshot(saved);
  let currentBoard = data(saved);
  request.mockImplementation(async (path: string) => path.includes("guided-journey") ? currentSnapshot : currentBoard);
  return {
    async saved() { currentSnapshot = await snapshot(true); currentBoard = data(true); },
    empty() { currentBoard = data(false); },
    unknown() { request.mockRejectedValue(new Error("Unavailable")); },
  };
}
function options() {
  return { account: owner, eligible: true, contextKey: "personal-board-a", isCurrentContextPersonal: () => true,
    refreshAccount: jest.fn(async () => owner), navigate: jest.fn(),
    mealBoard: { pending: false, failed: false, revision: 0, localSignature: boardPlacementSignature(data().week, week),
      confirm: (value: any, signal: AbortSignal) => confirmPersonalBoard(value, week, boardPlacementSignature(data().week, week), signal),
      retry: jest.fn() } };
}
beforeEach(() => {
  localStorage.clear(); household = null; request.mockReset(); (put as jest.Mock).mockReset();
  auth = { user: owner, loading: false, refreshUser: jest.fn(async () => auth.user) };
  window.history.replaceState({}, "", context.path);
  resumeGuidanceForSession(owner.id);
});
afterEach(cleanup);

test.each(["generated recipe", "selected recipe", "Favorite"])("%s without board placement cannot complete Stage 3", async () => {
  await fixture(false);
  expect(await confirmPersonalBoard(await snapshot(false), week, "")).toBeNull();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data(false).week));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.confirmedPlan).toBeNull();
  expect(request.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
});
test("placed but unsaved, including cached nonempty board, is not server-confirmed", async () => {
  await fixture(false);
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.placed).toBe(true);
  expect(hook.result.current.confirmedPlan).toBeNull();
});
test.each(["cache", "seed"])("a fresh response labeled %s is not persisted confirmation", async source => {
  await fixture();
  request.mockResolvedValue({ ...data(), source });
  expect(await confirmPersonalBoard(await snapshot(), week, "")).toBeNull();
});
test("existing saved personal plan counts without a new generation or save", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan?.weekStartISO).toBe(week));
  expect(put).not.toHaveBeenCalled();
});
test("existing historical plan resolves its actual week, not the empty current week", async () => {
  const previous = "2026-10-05";
  request.mockImplementation(async (path: string) => path.includes(previous) ? data(true, previous) : data(false));
  expect(await confirmPersonalBoard(await snapshot(true, previous), week, "")).toMatchObject({ weekStartISO: previous });
});
test.each([
  { subjectId: "another-account" }, { boardNamespace: "diabetic" }, { weekStartISO: "2026-10-05" },
])("rejects wrong server scope %j", async override => {
  request.mockResolvedValue({ ...data(), ...override });
  await expect(confirmPersonalBoard(await snapshot(), week, "")).rejects.toThrow();
});
test.each([
  ["wrong Builder", { activeBoard: "diabetic" }, {}],
  ["expired access", { accessTier: "FREE" }, {}],
  ["Performance", { performanceModeEnabled: true }, {}],
  ["household", {}, { householdProfileId: "child" }],
  ["professional client", {}, { proClientId: "patient" }],
  ["organization", {}, { workspace: "organization" }],
  ["non-Development", {}, { development: false }],
])("excludes %s", (_name, account, scope) => {
  expect(personalGeneralBoardAllowed({ ...owner, ...account }, { ...context, ...scope })).toBe(false);
});
test("new local edits differ from confirmed placement; images do not change meal identity", () => {
  const original = data().week, edited = data().week;
  edited.days![week].lunch[0].title = "Edited unsaved recipe";
  expect(boardPlacementSignature(edited, week)).not.toBe(boardPlacementSignature(original, week));
  edited.days![week].lunch[0] = { ...original.days![week].lunch[0], imageUrl: "https://synthetic.invalid/image" };
  expect(boardPlacementSignature(edited, week)).toBe(boardPlacementSignature(original, week));
  expect(boardPlacementSignature(original, week)).not.toContain("Synthetic bowl");
});
test.each(["2026-10-13", "2026-02-30", "bad", null])("rejects invalid planning week %s", value => {
  expect(validPlanningWeek(value)).toBe(false);
});
test("manual introduction reuses explanation and returns to native board without saving or navigation", async () => {
  await fixture(false);
  const input = options(); input.mealBoard.localSignature = "";
  const hook = renderHook(() => useGuidedJourneyDashboard(input));
  await waitFor(() => expect(hook.result.current.canExplain).toBe(true));
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  expect(hook.result.current.explanation?.primaryLabel).toBe("Continue in Builder");
  await act(async () => { await hook.result.current.explanationPrimary(); });
  expect(input.navigate).not.toHaveBeenCalled();
  expect(hook.result.current.explanation).toBeNull();
  expect(put).not.toHaveBeenCalled();
});
test.each(["primary", "secondary"])("completion %s rechecks and navigates only manually", async action => {
  await fixture();
  const input = options();
  const hook = renderHook(() => useGuidedJourneyDashboard(input));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  expect(hook.result.current.explanation).toBeNull();
  expect(input.navigate).not.toHaveBeenCalled();
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  expect(hook.result.current.explanation).toMatchObject({ title: "Your Meal Plan Is Saved", primaryLabel: "Open My Plan", secondaryLabel: "Go to Dashboard" });
  await act(async () => { if (action === "primary") await hook.result.current.explanationPrimary(); else hook.result.current.explanationSecondary(); });
  await waitFor(() => expect(input.navigate).toHaveBeenCalledWith(action === "primary"
    ? `/general-nutrition-builder/build?week=${week}&view=week` : "/dashboard"));
});
test("lost saved evidence at click removes completion instead of navigating", async () => {
  const state = await fixture();
  const input = options(); const hook = renderHook(() => useGuidedJourneyDashboard(input));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  state.empty();
  await act(async () => { await hook.result.current.explanationPrimary(); });
  expect(input.navigate).not.toHaveBeenCalled();
  expect(hook.result.current.explanation).toBeNull();
  expect(hook.result.current.confirmedPlan).toBeNull();
});
test("unknown evidence offers Retry and no completion", async () => {
  const state = await fixture(); state.unknown();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.model.canRetry).toBe(true));
  expect(hook.result.current.confirmedPlan).toBeNull();
});
test("save pending and failure suppress previous completion; Retry is read-only", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  act(() => hook.result.current.observeSave!({ state: "saving", weekStartISO: week, namespace: "generalNutrition" }));
  expect(hook.result.current.pending).toBe(true); expect(hook.result.current.confirmedPlan).toBeNull();
  act(() => hook.result.current.observeSave!({ state: "failed", weekStartISO: week, namespace: "generalNutrition" }));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.failed).toBe(true); expect(hook.result.current.confirmedPlan).toBeNull();
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  expect(put).not.toHaveBeenCalled();
});
test("a failed save immediately hides an open completion even while confirmation reads remain pending", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  expect(hook.result.current.explanation?.title).toBe("Your Meal Plan Is Saved");
  request.mockReturnValue(new Promise(() => {}));
  act(() => hook.result.current.observeSave!({ state: "failed", weekStartISO: week, namespace: "generalNutrition" }));
  expect(hook.result.current.explanation).toBeNull();
  expect(hook.result.current.confirmedPlan).toBeNull();
  act(() => hook.result.current.retry());
  expect(hook.result.current.explanation).toBeNull();
});
test("native autosave receipt wakes fresh evidence without a Save Plan click", async () => {
  const state = await fixture(false);
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  act(() => hook.result.current.observeSave!({ state: "saving", weekStartISO: week, namespace: "generalNutrition" }));
  await state.saved();
  act(() => hook.result.current.observeSave!({ state: "saved", weekStartISO: week, namespace: "generalNutrition" }));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  expect(put).not.toHaveBeenCalled(); expect(hook.result.current.explanation).toBeNull();
});
test("overlapping native saves stay pending until every operation finishes and retain any failure", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  const first = {}, second = {};
  const send = (operation: object, state: "saving" | "saved" | "failed") => hook.result.current.observeSave!({
    operation, state, weekStartISO: week, namespace: "generalNutrition",
  });
  act(() => { send(first, "saving"); send(second, "saving"); send(first, "saved"); });
  expect(hook.result.current.pending).toBe(true);
  expect(hook.result.current.confirmedPlan).toBeNull();
  act(() => send(second, "failed"));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.failed).toBe(true);
  expect(hook.result.current.confirmedPlan).toBeNull();
});
test("a failed first concurrent save cannot be masked by a later success", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  const first = {}, second = {};
  act(() => {
    for (const operation of [first, second]) hook.result.current.observeSave!({ operation, state: "saving", weekStartISO: week, namespace: "generalNutrition" });
    hook.result.current.observeSave!({ operation: first, state: "failed", weekStartISO: week, namespace: "generalNutrition" });
    hook.result.current.observeSave!({ operation: second, state: "saved", weekStartISO: week, namespace: "generalNutrition" });
  });
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.failed).toBe(true);
  expect(hook.result.current.confirmedPlan).toBeNull();
});
test("unconfirmed changed local recipes do not display saved completion for an older matching slot ID", async () => {
  await fixture();
  const changed = data().week;
  changed.days![week].lunch[0].title = "Unsaved edited recipe";
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, changed));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.confirmedPlan).toBeNull();
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  expect(hook.result.current.explanation).toBeNull();
});
test("malformed cached draft stays unknown instead of borrowing valid saved-plan proof", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, { id: "malformed-draft" }));
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  expect(hook.result.current.unverifiedLocal).toBe(true);
  expect(hook.result.current.confirmedPlan).toBeNull();
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  expect(hook.result.current.explanation).toBeNull();
});
test("manual failure propagates original error and publishes no success receipt", async () => {
  const error = new Error("Native failure");
  (put as jest.Mock).mockRejectedValue(error);
  const observe = jest.fn();
  await expect(saveWeekBoard(data().week as any, { observer: observe, weekStartISO: week, namespace: "generalNutrition" })).rejects.toBe(error);
  expect(observe.mock.calls.map(([event]) => event.state)).toEqual(["saving", "failed"]);
});
test("stale observer is rejected after A → B → A and week/household changes", async () => {
  await fixture(false);
  const hook = renderHook(({ date }) => useGuidedPersonalMealBoard(date, data(false).week), { initialProps: { date: week } });
  await waitFor(() => expect(hook.result.current.model.loading).toBe(false));
  const old = hook.result.current.observeSave!;
  auth.user = { ...owner, id: "board-guide-b" }; hook.rerender({ date: week });
  expect(hook.result.current.confirmedPlan).toBeNull();
  auth.user = owner; hook.rerender({ date: week });
  act(() => old({ state: "saving", weekStartISO: week, namespace: "generalNutrition" }));
  expect(hook.result.current.pending).toBe(false);
  const previousWeekObserver = hook.result.current.observeSave!;
  hook.rerender({ date: "2026-10-19" });
  act(() => previousWeekObserver({ state: "saving", weekStartISO: week, namespace: "generalNutrition" }));
  expect(hook.result.current.pending).toBe(false);
  household = "child"; hook.rerender({ date: week });
  expect(hook.result.current.visible).toBe(false);
});
test.each(["builder-dialog", "legal", "checkout", "quick-tour"])("%s blocks manual launch", async name => {
  await fixture(); const input = options();
  const hook = renderHook(() => useGuidedJourneyDashboard(input));
  await waitFor(() => expect(hook.result.current.canExplain).toBe(true));
  const release = acquireGuidanceInteractionBlock(name);
  try {
    await act(async () => { await hook.result.current.openBoardExplanation(); });
    expect(hook.result.current.explanation).toBeNull();
  } finally { release(); }
});
test("pause/off and replay leave persisted work and disabled automatic guidance intact", async () => {
  await fixture();
  const store = createGuidancePreferenceStore({ accountId: owner.id });
  store.apply("pause"); store.apply("disable_automatic");
  const hook = renderHook(() => useGuidedJourneyDashboard(options()));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  await act(async () => { await hook.result.current.openBoardExplanation(); });
  act(() => hook.result.current.dismissExplanation());
  expect(hook.result.current.confirmedPlan).not.toBeNull();
  await act(async () => { await hook.result.current.restart(); });
  expect(hook.result.current.explanation?.indicator).toContain("replay");
  expect(store.read().preferences.automaticExplanationsEnabled).toBe(false);
  expect(put).not.toHaveBeenCalled(); store.dispose();
});
test("native weekly-board save observer preserves success/failure and isolates observer exceptions", async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => data(false) })) as any;
  const observe = jest.fn();
  const hook = renderHook(() => useWeeklyBoard(owner.id, week, undefined, "generalNutrition", undefined, observe));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => data() });
  await act(async () => { await hook.result.current.save(data().week); });
  expect(observe.mock.calls.map(([event]) => event.state)).toEqual(["saving", "saved"]);
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
  await act(async () => { await expect(hook.result.current.save(data().week)).rejects.toThrow("HTTP 503"); });
  expect(observe.mock.calls.at(-1)?.[0].state).toBe("failed");
  expect(() => notifyBoardSave(() => { throw Error("Observer unavailable"); }, { state: "saved", weekStartISO: week })).not.toThrow();
});
test("legacy manual Save Plan remains unchanged and its receipt alone never proves persistence", async () => {
  await fixture(false);
  (put as jest.Mock).mockResolvedValue(data().week);
  const observer = jest.fn();
  const submitted = data().week;
  await saveWeekBoard(submitted as any, { observer, weekStartISO: week, namespace: "generalNutrition" });
  expect(put).toHaveBeenCalledWith("/api/week-board", submitted);
  expect(observer.mock.calls.map(([event]) => event.state)).toEqual(["saving", "saved"]);
  expect(await confirmPersonalBoard(await snapshot(false), week, boardPlacementSignature(data().week, week))).toBeNull();
});
test("manual receipt can recognize a matching canonical plan already persisted by autosave", async () => {
  await fixture();
  const hook = renderHook(() => useGuidedPersonalMealBoard(week, data().week));
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
  (put as jest.Mock).mockResolvedValue(data().week);
  await act(async () => { await saveWeekBoard(data().week as any, {
    observer: hook.result.current.observeSave, weekStartISO: week, namespace: "generalNutrition",
  }); });
  await waitFor(() => expect(hook.result.current.confirmedPlan).not.toBeNull());
});
test("fresh board read requests exact namespace and no-store and rejects missing subject metadata", async () => {
  request.mockResolvedValue(data());
  await getGuidedPersonalWeekBoard(week);
  expect(request).toHaveBeenCalledWith(`/api/weekly-board?week=${week}&bt=generalNutrition`, expect.objectContaining({ method: "GET", cache: "no-store" }));
  request.mockResolvedValue(createEmptyWeekStructure(week));
  await expect(getGuidedPersonalWeekBoard(week)).rejects.toThrow();
});
test("mobile guidance uses normal flow, wraps controls, exposes Retry and never mounts an automatic dialog", () => {
  const retry = jest.fn();
  const journey: any = { visible: true, pending: false, failed: true, model: { canRetry: false, busy: false }, retry };
  const { container } = render(<GuidedMealBoard journey={journey} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry Saved Plan Check" }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(container.querySelector("section")?.className).not.toContain("fixed");
  expect(container.querySelector(".flex-wrap")).not.toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
