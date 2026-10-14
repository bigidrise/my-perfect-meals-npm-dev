/** @jest-environment jsdom */
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useGuidedJourneyDashboard } from "../useGuidedJourneyDashboard";
import { apiRequest } from "@/lib/apiRequest";
import { createGuidancePreferenceStore, guidancePreferenceKey } from "@/lib/guidedJourney/preferences";
import { parsePersonalJourneyProgress } from "@/lib/guidedJourney/progress";
import {
  isPersonalJourneyDashboard, journeyDashboardContextKey, journeyDestinationAllowed,
  type JourneyDashboardAccount,
} from "@/lib/guidedJourney/dashboardScope";
import { GettingStartedCardView } from "@/components/dashboard/GettingStartedCardView";
import { createGuidedJourneyService, type JourneyAccount } from "../../../../server/services/guidedJourney/service";
import { createEmptyWeekStructure } from "../../../../shared/schema/weeklyBoard";
import type { JourneySnapshot } from "../../../../shared/guidedJourney";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const request = apiRequest as jest.Mock;
const account: JourneyDashboardAccount = {
  id: "account-a", role: "client", professionalRole: null, accessTier: "PAID_FULL",
  activeBoard: "general_nutrition", isSandbox: false,
};
const context = { development: true, path: "/dashboard", workspace: "personal", householdProfileId: null };
async function snapshot(options: {
  id?: string; configured?: boolean; onboarded?: boolean; saved?: boolean;
  free?: boolean; builder?: string | null; partialTargets?: boolean; household?: boolean;
} = {}): Promise<JourneySnapshot> {
  const raw: JourneyAccount = {
    onboardingCompletedAt: options.configured || options.onboarded ? new Date("2026-10-01") : null,
    dailyCalorieTarget: options.configured ? 1800 : null,
    dailyProteinTarget: options.configured && !options.partialTargets ? 120 : null,
    dailyCarbsTarget: options.configured ? 0 : null,
    dailyFatTarget: options.configured ? 80 : null,
    activeBoard: options.builder === undefined ? "general_nutrition" : options.builder,
    selectedMealBuilder: null, activeHouseholdProfileId: options.household ? "household-private" : null,
  };
  const { week } = createEmptyWeekStructure("2026-10-12");
  week.days!["2026-10-12"].lunch.push({ id: "meal", title: "Vegetable bowl" });
  return createGuidedJourneyService({
    readAccount: async () => raw,
    readSavedBoards: async () => ({ records: options.saved ? [{ weekStartISO: "2026-10-12", boardJSON: week }] : [], hasMore: false }),
  }).inspect({
    id: options.id ?? account.id, role: "client", professionalRole: null,
    isSandbox: false, mealPlanningAccess: options.free ? "denied" : "allowed",
  });
}
function input(owner: JourneyDashboardAccount = account) {
  return {
    account: owner, eligible: true, contextKey: journeyDashboardContextKey(owner, context),
    isCurrentContextPersonal: jest.fn(() => true),
    refreshAccount: jest.fn(async () => owner), navigate: jest.fn(),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function Harness({ options }: { options: ReturnType<typeof input> }) {
  const journey = useGuidedJourneyDashboard(options);
  return journey.visible ? <GettingStartedCardView model={journey.model}
    onContinue={() => { void journey.continueSetup(); }} onRetry={journey.retry}
    onPauseResume={journey.pauseResume} onToggleAutomatic={journey.toggleAutomatic}
    onRestart={journey.restart} /> : null;
}
beforeEach(() => { request.mockReset(); localStorage.clear(); });
afterEach(cleanup);

test("fresh paid account renders authoritative current and remaining stages without automatic actions", async () => {
  request.mockResolvedValue(await snapshot());
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
  expect(within(screen.getAllByRole("listitem")[0]).getByText("Current")).toBeTruthy();
  expect(within(screen.getAllByRole("listitem")[1]).getByText("Remaining")).toBeTruthy();
  expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(false);
  expect(options.navigate).not.toHaveBeenCalled();
  expect(options.refreshAccount).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(request).toHaveBeenCalledWith("/api/guided-journey/progress", expect.objectContaining({
    method: "GET", cache: "no-store", signal: expect.any(AbortSignal),
  }));
});
test("completed paid account has three completed stages and never repeats onboarding", async () => {
  request.mockResolvedValue(await snapshot({ configured: true, saved: true }));
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getAllByText("Completed")).toHaveLength(3));
  expect(screen.getByText("Your setup is complete.")).toBeTruthy();
  expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(true);
  expect(options.navigate).not.toHaveBeenCalled();
});
test.each([false, true])("Free access renders exactly two stages, configured=%s", async configured => {
  request.mockResolvedValue(await snapshot({ free: true, configured }));
  render(<Harness options={input({ ...account, accessTier: "FREE" })} />);
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  expect(screen.queryByText("Create Your Meal Plan")).toBeNull();
  expect(screen.queryByText(/upgrade/i)).toBeNull();
  expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(configured);
});
test("manual Continue rechecks account and endpoint, then uses only existing onboarding", async () => {
  request.mockResolvedValue(await snapshot());
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByTestId("guided-journey-continue"));
  await waitFor(() => expect(options.navigate).toHaveBeenCalledWith("/onboarding"));
  expect(options.refreshAccount).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(2);
});
test.each([
  [{ onboarded: true }, "/macro-counter"],
  [{ configured: true }, "/general-nutrition-builder/build"],
] as const)("manual continuation uses the authoritative existing destination %s", async (setup, destination) => {
  request.mockResolvedValue(await snapshot(setup));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => { await result.current.continueSetup(); });
  expect(options.navigate).toHaveBeenCalledWith(destination);
});
test("Pause, Resume and Disable are local; Restart requests explanations without clearing progress", async () => {
  request.mockResolvedValue(await snapshot({ configured: true, saved: true }));
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getAllByText("Completed")).toHaveLength(3));
  fireEvent.click(screen.getByText("Guidance controls"));
  fireEvent.click(screen.getByRole("button", { name: "Pause Guidance" }));
  expect(screen.getByText(/Guidance is paused/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resume Guidance" }));
  expect(screen.queryByText(/Guidance is paused/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Disable Automatic Guidance" }));
  expect(screen.getByText(/Automatic guidance is off/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resume Guidance" }));
  expect(screen.getByText(/Automatic guidance is off/)).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Restart Guidance" })); });
  expect(screen.getByText(/Replay requested/)).toBeTruthy();
  expect(screen.getAllByText("Completed")).toHaveLength(3);
  expect(createGuidancePreferenceStore({ accountId: account.id }).read().preferences)
    .toMatchObject({ automaticExplanationsEnabled: false, replayRequested: true });
  expect(options.navigate).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("paused and disabled settings survive unmount/reload and manual Continue preserves off", async () => {
  createGuidancePreferenceStore({ accountId: account.id }).apply("disable_automatic");
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const first = render(<Harness options={options} />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(false));
  expect(screen.getByText(/Guidance is paused/)).toBeTruthy();
  first.unmount();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByTestId("guided-journey-continue"));
  await waitFor(() => expect(options.navigate).toHaveBeenCalledWith("/general-nutrition-builder/build"));
  expect(createGuidancePreferenceStore({ accountId: account.id }).read().preferences)
    .toMatchObject({ mode: "paused", automaticExplanationsEnabled: false });
});
test("failed reads display no invented stages, block navigation, and Retry recovers", async () => {
  request.mockRejectedValueOnce(new Error("network failed")).mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  render(<Harness options={options} />);
  await waitFor(() => expect(screen.getByText(/couldn't check your progress/)).toBeTruthy());
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.getByTestId("guided-journey-continue").hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
  expect(options.navigate).not.toHaveBeenCalled();
});
test.each([
  { configured: true, partialTargets: true }, { configured: true, builder: null },
  { configured: true, builder: "diabetic" }, { builder: "diabetic" },
])("unknown progress or unsupported assignments never navigate: %j", async setup => {
  request.mockResolvedValue(await snapshot(setup));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.loading).toBe(false));
  expect(result.current.model.canContinue).toBe(false);
  await act(async () => { await result.current.continueSetup(); });
  expect(options.navigate).not.toHaveBeenCalled();
  expect(options.refreshAccount).not.toHaveBeenCalled();
});
test("plan completion changing after render cannot send the user back into a Builder", async () => {
  request.mockResolvedValueOnce(await snapshot({ configured: true }))
    .mockResolvedValueOnce(await snapshot({ configured: true, saved: true }));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => { await result.current.continueSetup(); });
  expect(result.current.model.statusText).toBe("Your setup is complete.");
  expect(options.navigate).not.toHaveBeenCalled();
});
test.each(["expired", "assigned_elsewhere", "professional"])("fresh account check prevents %s navigation", async change => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const changed = change === "expired" ? { accessTier: "FREE" }
    : change === "professional" ? { professionalRole: "physician" as const }
      : { activeBoard: "diabetic" as const };
  options.refreshAccount.mockResolvedValue({ ...account, ...changed });
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => { await result.current.continueSetup(); });
  expect(options.navigate).not.toHaveBeenCalled();
});
test("failed pre-navigation read is an error, not a reset or navigation", async () => {
  request.mockResolvedValueOnce(await snapshot({ configured: true })).mockRejectedValueOnce(new Error("failed"));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => { await result.current.continueSetup(); });
  expect(result.current.model.stages).toHaveLength(0);
  expect(result.current.model.canRetry).toBe(true);
  expect(options.navigate).not.toHaveBeenCalled();
});
test("account switching hides pending old progress and does not inherit disabled preferences", async () => {
  const pending = deferred<JourneySnapshot>();
  createGuidancePreferenceStore({ accountId: account.id }).apply("disable_automatic");
  const b = { ...account, id: "account-b" };
  request.mockReturnValueOnce(pending.promise).mockResolvedValue(await snapshot({ id: b.id, configured: true }));
  const { result, rerender } = renderHook(({ options }) => useGuidedJourneyDashboard(options),
    { initialProps: { options: input() } });
  rerender({ options: input(b) });
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => { pending.resolve(await snapshot({ configured: true, saved: true })); });
  expect(result.current.model.stages[2].state).toBe("incomplete");
  expect(result.current.model.automaticDisabled).toBe(false);
  expect(localStorage.getItem(guidancePreferenceKey({ accountId: b.id }))).toBeNull();
});
test("stale preference callbacks from A cannot modify B or a later A session", async () => {
  request.mockResolvedValue(await snapshot());
  const first = input();
  const { result, rerender } = renderHook(({ options }) => useGuidedJourneyDashboard(options),
    { initialProps: { options: first } });
  await waitFor(() => expect(result.current.model.controlsReady).toBe(true));
  const stale = result.current;
  const b = { ...account, id: "account-b" };
  request.mockResolvedValue(await snapshot({ id: b.id }));
  rerender({ options: input(b) });
  await waitFor(() => expect(result.current.model.controlsReady).toBe(true));
  act(() => stale.restart());
  expect(localStorage.getItem(guidancePreferenceKey({ accountId: b.id }))).toBeNull();
  request.mockResolvedValue(await snapshot());
  rerender({ options: input() });
  await waitFor(() => expect(result.current.model.controlsReady).toBe(true));
  act(() => stale.toggleAutomatic());
  expect(localStorage.getItem(guidancePreferenceKey({ accountId: account.id }))).toBeNull();
});
test("an in-flight Continue from account A cannot navigate after switching to B", async () => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const pending = deferred<JourneyDashboardAccount>();
  options.refreshAccount.mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(({ options: current }) => useGuidedJourneyDashboard(current),
    { initialProps: { options } });
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  let continuing!: Promise<void>;
  act(() => { continuing = result.current.continueSetup(); });
  const b = { ...account, id: "account-b" };
  request.mockResolvedValue(await snapshot({ id: b.id, configured: true }));
  rerender({ options: input(b) });
  await act(async () => { pending.resolve(account); await continuing; });
  expect(options.navigate).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});
test("live workspace changes block continuation even before a rerender", async () => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  options.isCurrentContextPersonal.mockReturnValue(false);
  await act(async () => { await result.current.continueSetup(); });
  expect(options.refreshAccount).not.toHaveBeenCalled();
  expect(options.navigate).not.toHaveBeenCalled();
});
test("rapid clicks cannot send duplicate navigation or parallel continuation", async () => {
  request.mockResolvedValue(await snapshot({ configured: true }));
  const options = input();
  const pending = deferred<JourneyDashboardAccount>();
  options.refreshAccount.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  await waitFor(() => expect(result.current.model.canContinue).toBe(true));
  await act(async () => {
    const first = result.current.continueSetup();
    const second = result.current.continueSetup();
    pending.resolve(account);
    await Promise.all([first, second]);
  });
  expect(options.navigate).toHaveBeenCalledTimes(1);
  expect(options.refreshAccount).toHaveBeenCalledTimes(1);
});
test("React StrictMode disposal does not disable the replacement preference store", async () => {
  request.mockResolvedValue(await snapshot());
  const options = input();
  const { result } = renderHook(() => useGuidedJourneyDashboard(options),
    { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> });
  await waitFor(() => expect(result.current.model.controlsReady).toBe(true));
  act(() => result.current.toggleAutomatic());
  expect(result.current.model.automaticDisabled).toBe(true);
});
test("unsupported household server context hides the card entirely", async () => {
  request.mockResolvedValue(await snapshot({ household: true }));
  const { result } = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(result.current.model.loading).toBe(false));
  expect(result.current.visible).toBe(false);
});
test.each([
  { development: false }, { workspace: "workspace" }, { workspace: "organization" },
  { workspace: "unknown" }, { path: "/business-dashboard" }, { path: "/pro/clients" },
  { householdProfileId: "household-private" },
])("personal dashboard gate excludes %j", override => {
  expect(isPersonalJourneyDashboard(account, { ...context, ...override })).toBe(false);
});
test.each([
  { role: "coach" as const }, { professionalRole: "business" as const }, { isSandbox: true },
  { id: "guest-one" }, { id: "anon" }, { id: "00000000-0000-0000-0000-000000000001" },
])("personal gate excludes unsupported account %j", override => {
  expect(isPersonalJourneyDashboard({ ...account, ...override }, context)).toBe(false);
});
test("disabled/Production context makes no progress request or preference write", async () => {
  const options = { ...input(), eligible: false };
  const { result } = renderHook(() => useGuidedJourneyDashboard(options));
  expect(result.current.visible).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});
test("foreign, inconsistent, private-extra and nonpersonal endpoint payloads are rejected", async () => {
  const original = await snapshot({ configured: true });
  for (const modified of [
    { ...original, scope: { ...original.scope, actorId: "account-b" } },
    { ...original, scope: { ...original.scope, subjectId: "household-private" } },
    { ...original, status: "complete" }, { ...original, journeyType: "professional" },
    { ...original, targets: { calories: 1800 } }, { ...original, steps: original.steps.slice(0, 2) },
  ]) expect(() => parsePersonalJourneyProgress(modified, account.id)).toThrow();
});
test("a forged external/internal destination is not a manual navigation target", async () => {
  const original = await snapshot({ configured: true });
  for (const route of ["https://example.com", "/pro/clients/private", "/select-builder", "/onboarding"]) {
    expect(journeyDestinationAllowed({ ...original,
      nextAction: { kind: "open_existing_activity", route } }, account)).toBe(false);
  }
});
test("a conflicting professional Builder assignment is not overwritten or navigated", async () => {
  const original = await snapshot({ configured: true });
  const owner = { ...account, studioMembership: {
    studioId: "studio", studioName: null, studioType: null, membershipId: "membership",
    ownerUserId: null, assignedBuilder: "diabetic",
  } };
  expect(journeyDestinationAllowed(original, owner)).toBe(false);
  expect(owner.studioMembership.assignedBuilder).toBe("diabetic");
});
test("unknown later evidence explains the disabled Continue even before onboarding completes", async () => {
  request.mockResolvedValue(await snapshot({ builder: "diabetic" }));
  const { result } = renderHook(() => useGuidedJourneyDashboard(input()));
  await waitFor(() => expect(result.current.model.loading).toBe(false));
  expect(result.current.model.statusText).toContain("assigned Meal Builder isn't available yet");
  expect(result.current.model.canContinue).toBe(false);
  expect(result.current.model.canRetry).toBe(true);
});
