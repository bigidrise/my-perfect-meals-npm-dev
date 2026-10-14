/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useGuidedJourneyDashboard } from "../useGuidedJourneyDashboard";
import { apiRequest } from "@/lib/apiRequest";
import { GuidedJourneyExplanation } from "@/components/guided/GuidedJourneyExplanation";
import { GettingStartedCardView } from "@/components/dashboard/GettingStartedCardView";
import { createGuidancePreferenceStore } from "@/lib/guidedJourney/preferences";
import { journeyDashboardContextKey, type JourneyDashboardAccount } from "@/lib/guidedJourney/dashboardScope";
import { acquireGuidanceInteractionBlock, guidanceInteractionBlocked, resumeGuidanceForSession } from "@/lib/guidedJourney/presentation";
import { createGuidedJourneyService } from "../../../../server/services/guidedJourney/service";
import { createEmptyWeekStructure } from "../../../../shared/schema/weeklyBoard";
import { explanationModel } from "@/lib/guidedJourney/explanation";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const owner: JourneyDashboardAccount = {
  id: "explanation-a", role: "client", professionalRole: null, accessTier: "PAID_FULL",
  activeBoard: "general_nutrition", isSandbox: false,
};
const context = { development: true, path: "/dashboard", workspace: "personal", householdProfileId: null };
function input(account = owner) {
  return { account, contextKey: journeyDashboardContextKey(account, context), eligible: true,
    isCurrentContextPersonal: jest.fn(() => true), refreshAccount: jest.fn(async () => account), navigate: jest.fn() };
}
async function snapshot(options: {
  id?: string; onboarded?: boolean; configured?: boolean; saved?: boolean; free?: boolean;
  builder?: string; partial?: boolean;
} = {}) {
  const { week } = createEmptyWeekStructure("2026-10-12");
  week.days!["2026-10-12"].lunch.push({ id: "synthetic-meal", title: "Vegetable bowl" });
  return createGuidedJourneyService({
    readAccount: async () => ({
      onboardingCompletedAt: options.onboarded || options.configured ? new Date("2026-10-01") : null,
      dailyCalorieTarget: options.configured ? 1800 : null,
      dailyProteinTarget: options.configured && !options.partial ? 120 : null,
      dailyCarbsTarget: options.configured ? 0 : null, dailyFatTarget: options.configured ? 80 : null,
      activeBoard: options.builder ?? "general_nutrition", selectedMealBuilder: null, activeHouseholdProfileId: null,
    }),
    readSavedBoards: async () => ({ records: options.saved
      ? [{ weekStartISO: "2026-10-12", boardJSON: week }] : [], hasMore: false }),
  }).inspect({ id: options.id ?? owner.id, role: "client", professionalRole: null, isSandbox: false,
    mealPlanningAccess: options.free ? "denied" : "allowed" });
}
function Harness({ options = input() }: { options?: ReturnType<typeof input> }) {
  const journey = useGuidedJourneyDashboard(options);
  return <>
    <GettingStartedCardView model={journey.model} onContinue={() => { void journey.continueSetup(); }}
      onRetry={journey.retry} onPauseResume={journey.pauseResume} onToggleAutomatic={journey.toggleAutomatic}
      onRestart={() => { void journey.restart(); }} onExplain={() => { void journey.openExplanation(); }}
      canExplain={journey.canExplain} presentationNotice={journey.presentationNotice} />
    {journey.explanation && <GuidedJourneyExplanation open model={journey.explanation} busy={journey.model.busy}
      onPrimary={() => { void journey.explanationPrimary(); }} onSecondary={journey.explanationSecondary}
      onClose={journey.dismissExplanation} onRestoreFocus={journey.restoreExplanationFocus} />}
  </>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>(yes => { resolve = yes; }), resolve: (value: T) => resolve(value) };
}
beforeEach(() => {
  localStorage.clear(); request.mockReset(); resumeGuidanceForSession(owner.id);
  resumeGuidanceForSession("explanation-b");
});
afterEach(cleanup);

test.each([
  [{}, "Let's Get to Know You", "Start Setup", "Stage 1 of 3"],
  [{ onboarded: true }, "Let's Set Your Nutrition Targets", "Open Calculator", "Stage 2 of 3"],
  [{ configured: true }, "Let's Create Your First Meal", "Create My First Meal", "Stage 3 of 3"],
])("manual explanation uses authoritative stage and exact copy: %j", async (setup, title, primary, indicator) => {
  request.mockResolvedValue(await snapshot(setup));
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-explain").hasAttribute("disabled")).toBe(false));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByTestId("guided-journey-explain"));
  await screen.findByRole("dialog", { name: title });
  expect(screen.getByText(indicator)).toBeTruthy();
  expect(screen.getByRole("button", { name: primary }).hasAttribute("disabled")).toBe(false);
  expect(options.refreshAccount).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  expect(options.navigate).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

test.each(["pause", "disable_automatic"] as const)("manual launch respects %s; closing pauses only the session", async command => {
  const store = createGuidancePreferenceStore({ accountId: owner.id });
  store.apply(command);
  const before = store.read().preferences;
  request.mockResolvedValue(await snapshot({ configured: true }));
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-explain").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByTestId("guided-journey-explain"));
  await screen.findByRole("dialog");
  expect(store.read().preferences).toEqual(before);
  fireEvent.click(screen.getByRole("button", { name: "Close and pause guidance" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(store.read().preferences).toEqual(before);
  expect(screen.getByText(/Guidance is paused/)).toBeTruthy();
});

test("Escape pauses session, preserves not-started preferences, and returns keyboard focus", async () => {
  request.mockResolvedValue(await snapshot({ onboarded: true }));
  render(<Harness />);
  const launch = screen.getByTestId("guided-journey-explain");
  await waitFor(() => expect(launch.hasAttribute("disabled")).toBe(false));
  launch.focus(); fireEvent.click(launch);
  await screen.findByRole("dialog");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(launch));
  expect(screen.getByText(/Guidance is paused/)).toBeTruthy();
  expect(localStorage.length).toBe(0);
});

test("Free replay has exactly two explanations and never offers a meal or upgrade", async () => {
  request.mockResolvedValue(await snapshot({ free: true, configured: true }));
  const options = input({ ...owner, accessTier: "FREE" });
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.restart(); });
  expect(result.current.explanation?.indicator).toBe("Stage 1 of 2 · Explanation replay");
  act(() => result.current.explanationSecondary());
  expect(result.current.explanation?.indicator).toBe("Stage 2 of 2 · Explanation replay");
  expect(result.current.explanation?.primaryLabel).toBe("Open Calculator");
  expect(result.current.explanation?.canPerform).toBe(false);
  act(() => result.current.explanationSecondary());
  expect(result.current.explanation).toBeNull();
  expect(result.current.model.stages).toHaveLength(2);
  expect(result.current.model.stages.every(stage => stage.state === "complete")).toBe(true);
  expect(options.navigate).not.toHaveBeenCalled();
});

test("paid completed replay preserves all evidence and disabled automatic choice", async () => {
  const store = createGuidancePreferenceStore({ accountId: owner.id });
  store.apply("disable_automatic");
  request.mockResolvedValue(await snapshot({ configured: true, saved: true }));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.restart(); });
  for (const title of ["Let's Get to Know You", "Let's Set Your Nutrition Targets", "Let's Create Your First Meal"]) {
    expect(result.current.explanation?.title).toBe(title);
    expect(result.current.explanation?.canPerform).toBe(false);
    expect(result.current.explanation?.activityNotice).toContain("already complete");
    await act(async () => { await result.current.explanationPrimary(); });
    expect(options.navigate).not.toHaveBeenCalled();
    act(() => result.current.explanationSecondary());
  }
  expect(result.current.explanation).toBeNull();
  expect(store.read().preferences).toMatchObject({ automaticExplanationsEnabled: false, replayRequested: false });
  expect(result.current.model.stages.every(stage => stage.state === "complete")).toBe(true);
});

test.each(["/onboarding", "/macro-counter", "/general-nutrition-builder/build"])("primary action uses fresh evidence before %s", async route => {
  const setup = route.includes("general") ? { configured: true } : route.includes("macro") ? { onboarded: true } : {};
  request.mockResolvedValue(await snapshot(setup));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.openExplanation(); });
  await act(async () => { await result.current.explanationPrimary(); });
  expect(options.refreshAccount).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenCalledTimes(3);
  expect(options.navigate).toHaveBeenCalledWith(route);
  expect(result.current.explanation).toBeNull();
});

test("new completion after opening cannot advance into a later workflow from an old explanation", async () => {
  request.mockResolvedValueOnce(await snapshot()).mockResolvedValueOnce(await snapshot())
    .mockResolvedValueOnce(await snapshot({ onboarded: true }));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.openExplanation(); });
  await act(async () => { await result.current.explanationPrimary(); });
  expect(options.navigate).not.toHaveBeenCalled();
  expect(result.current.explanation?.canPerform).toBe(false);
  expect(result.current.model.stages[0].state).toBe("complete");
});

test.each([{ builder: "diabetic" }, { configured: true, partial: true }])("unknown/unsupported evidence cannot explain or navigate: %j", async setup => {
  request.mockResolvedValue(await snapshot(setup));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.loading).toBe(false));
  await act(async () => { await result.current.openExplanation(); });
  expect(result.current.canExplain).toBe(false);
  expect(result.current.explanation).toBeNull();
  expect(options.navigate).not.toHaveBeenCalled();
});

test("failed fresh progress read never opens a stale modal; Retry restores manual availability", async () => {
  request.mockResolvedValueOnce(await snapshot({ configured: true })).mockRejectedValueOnce(new Error("503"))
    .mockResolvedValue(await snapshot({ configured: true }));
  const { result } = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.openExplanation(); });
  expect(result.current.explanation).toBeNull();
  expect(result.current.model.canRetry).toBe(true);
  await act(async () => { result.current.retry(); });
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  expect(result.current.explanation).toBeNull(); // Recovery cannot auto-launch.
});

test("account switch cancels a pending explanation and stale callbacks including A→B→A", async () => {
  request.mockResolvedValue(await snapshot());
  const options = input();
  const pending = deferred<JourneyDashboardAccount>();
  const { result, rerender } = renderHook(({ options }) => useGuidedJourneyDashboard(options), { initialProps: { options } });
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  options.refreshAccount.mockReturnValue(pending.promise);
  const old = result.current;
  let opening!: Promise<void>;
  act(() => { opening = old.openExplanation(); });
  const b = { ...owner, id: "explanation-b" };
  request.mockResolvedValue(await snapshot({ id: b.id }));
  rerender({ options: input(b) });
  await act(async () => { pending.resolve(owner); await opening; });
  expect(result.current.explanation).toBeNull();
  request.mockResolvedValue(await snapshot());
  rerender({ options: input() });
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await old.openExplanation(); await old.restart(); old.dismissExplanation(); });
  expect(result.current.explanation).toBeNull();
  expect(localStorage.length).toBe(0);
});

test("close during primary preflight cancels navigation and preserves saved progress", async () => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.openExplanation(); });
  const pending = deferred<JourneyDashboardAccount>();
  options.refreshAccount.mockReturnValue(pending.promise);
  let performing!: ReturnType<typeof result.current.explanationPrimary>;
  act(() => { performing = result.current.explanationPrimary(); });
  act(() => result.current.dismissExplanation());
  await act(async () => { pending.resolve(owner); await performing; });
  expect(options.navigate).not.toHaveBeenCalled();
  expect(result.current.explanation).toBeNull();
  expect(result.current.model.paused).toBe(true);
  expect(result.current.model.stages[2].state).toBe("incomplete");
});

test.each(["dialog", "alertdialog", "welcome-gate", "custom-overlay", "recording", "native-lease"])("defers to %s and never auto-launches after its removal", async kind => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const { result } = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  const blocker = document.createElement("div");
  let release = () => {};
  if (kind === "native-lease") release = acquireGuidanceInteractionBlock();
  else {
    if (["dialog", "alertdialog"].includes(kind)) blocker.setAttribute("role", kind);
    else if (kind === "welcome-gate") blocker.dataset.testid = "welcome-gate";
    else if (kind === "custom-overlay") blocker.className = "fixed inset-0 z-[99999]";
    else blocker.dataset.testid = "stop-video-recording";
    document.body.append(blocker);
  }
  await act(async () => { await result.current.openExplanation(); });
  expect(result.current.explanation).toBeNull();
  expect(result.current.presentationNotice).toContain("Finish the current interaction");
  expect(blocker.isConnected || kind === "native-lease").toBe(true);
  blocker.remove(); release();
  await act(async () => {});
  expect(result.current.explanation).toBeNull();
  await act(async () => { await result.current.openExplanation(); });
  expect(result.current.explanation).not.toBeNull();
});

test("higher-priority dialog arriving after launch withdraws only guidance", async () => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-explain").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByTestId("guided-journey-explain"));
  await screen.findByRole("dialog");
  const blocker = document.createElement("div");
  blocker.setAttribute("role", "alertdialog"); blocker.textContent = "Existing safety confirmation";
  document.body.append(blocker);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(blocker.isConnected).toBe(true);
  expect(screen.getByText(/Guidance is paused/)).toBeTruthy();
  blocker.remove();
});

test("hidden dialogs and low-z page frames do not block; the modal does not block itself", async () => {
  const hidden = document.createElement("div");
  hidden.innerHTML = '<div role="dialog"></div>'; hidden.hidden = true;
  const page = document.createElement("div"); page.className = "fixed inset-0 z-0";
  document.body.append(hidden, page);
  expect(guidanceInteractionBlocked()).toBe(false);
  request.mockResolvedValue(await snapshot());
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-explain").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByTestId("guided-journey-explain"));
  await screen.findByRole("dialog");
  await act(async () => {});
  expect(guidanceInteractionBlocked()).toBe(false);
  expect(screen.getByRole("dialog").className).toContain("100dvh");
  expect(screen.getByRole("dialog").querySelector(".overflow-y-auto.min-h-0")).toBeTruthy();
  hidden.remove(); page.remove();
});

test.each(["role", "access", "identity", "missing"])("fresh %s denial prevents an explanation", async change => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  options.refreshAccount.mockResolvedValue(change === "missing" ? null as any
    : { ...owner, ...(change === "role" ? { professionalRole: "physician" as const }
      : change === "identity" ? { id: "explanation-b" } : { accessTier: "FREE" as const }) });
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  await act(async () => { await result.current.openExplanation(); });
  expect(result.current.explanation).toBeNull();
  expect(options.navigate).not.toHaveBeenCalled();
});

test("persisted active/replay preferences never auto-launch on mount", async () => {
  createGuidancePreferenceStore({ accountId: owner.id }).apply("restart_explanations");
  request.mockResolvedValue(await snapshot({ configured: true }));
  const { result } = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(result.current.canExplain).toBe(true));
  expect(result.current.model.replayRequested).toBe(true);
  expect(result.current.explanation).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});

test("unlabelled existing Stop Recording controls defer guidance", () => {
  const button = document.createElement("button"); button.textContent = "Stop Recording";
  document.body.append(button);
  expect(guidanceInteractionBlocked()).toBe(true);
  button.remove();
});

test("reusable dialog supports no secondary action without removing Close", async () => {
  const model = explanationModel(await snapshot(), "get_to_know_you", false, false)!;
  render(<GuidedJourneyExplanation open model={{ ...model, secondaryLabel: null }}
    busy={false} onPrimary={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Start Setup" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close and pause guidance" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Close & Pause" })).toBeNull();
});

test.each(["get_to_know_you", "nutrition_targets", "saved_meal_plan"] as const)(
  "%s explanation matches the platform's dark modals with light text",
  async stageId => {
    const model = explanationModel(await snapshot(), stageId, false, false)!;
    render(<GuidedJourneyExplanation open model={model}
      busy={false} onPrimary={jest.fn()} onSecondary={jest.fn()} onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("bg-[#111111]")).toBe(true);
    expect(dialog.classList.contains("text-white")).toBe(true);
    expect(dialog.classList.contains("bg-stone-50")).toBe(false);
    const description = screen.getAllByText(model.description).find(element => element.tagName === "P");
    expect(description?.classList.contains("text-white/85")).toBe(true);
    expect(screen.getByText(model.indicator).classList.contains("text-teal-300")).toBe(true);
    expect(screen.getByRole("button", { name: "Close & Pause" }).classList.contains("bg-white/5")).toBe(true);
    if (model.builderName) {
      const workspace = screen.getByText(model.builderName);
      expect(workspace.classList.contains("text-white")).toBe(true);
      expect(workspace.parentElement?.classList.contains("bg-teal-950/40")).toBe(true);
    }
    if (model.activityNotice) {
      expect(screen.getByRole("status").classList.contains("bg-amber-950/40")).toBe(true);
    }
  },
);
