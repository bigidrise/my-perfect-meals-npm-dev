/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NutritionPersonalizationSummaryCard } from "@/components/protocol/NutritionPersonalizationSummaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}), isNativePlatform: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", jest.fn()] }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      key === "title" ? "Your Nutrition Life Plan" : options?.defaultValue ?? key,
  }),
}));

const auth = useAuth as jest.Mock;
const baseline = (calories: number) => ({
  activeInputs: { macros: { calories }, health: [] },
  nutritionDrivers: null,
  compositeExplanation: "Saved plan",
  hasAnyActiveProtocol: false,
});
const dynamic = {
  performance: null, pregnancy: null, liveMetrics: [],
  compositeExplanation: "Today's context",
  nextDayBoundaryAt: new Date(Date.now() + 60_000).toISOString(),
};
const response = (data: unknown, status = 200) => ({
  ok: status === 200, status, json: async () => data,
}) as Response;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const mount = () => render(
  <QueryClientProvider client={queryClient}>
    <NutritionPersonalizationSummaryCard />
  </QueryClientProvider>,
);
const expectHeading = () => expect(screen.getByText("Your Nutrition Life Plan")).toBeTruthy();

beforeEach(() => {
  queryClient.clear();
  queryClient.setQueryDefaults(["nutrition-summary"], { retry: false });
  auth.mockReturnValue({ user: { id: "first-render-a" } });
  global.fetch = jest.fn(async (url: string) => response(
    url.endsWith("/baseline")
      ? baseline((useAuth() as any).user.id === "first-render-a" ? 2200 : 1800)
      : dynamic,
  )) as jest.Mock;
});
afterEach(() => queryClient.clear());

it("renders the actual heading on the first render while baseline and daily context are pending", async () => {
  const saved = deferred<Response>();
  const today = deferred<Response>();
  (fetch as jest.Mock).mockImplementation((url: string) =>
    url.endsWith("/baseline") ? saved.promise : today.promise);
  mount();
  expectHeading();
  expect(screen.getByRole("status").textContent).toBe("Loading your personalized plan…");
  expect(screen.queryByText("2,200")).toBeNull();
  expect(screen.queryByText("baseline")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => { saved.resolve(response(baseline(2200))); });
  await waitFor(() => expect(screen.getByText("2,200")).toBeTruthy());
  expectHeading();
  expect(screen.getByText("Updating today's context…")).toBeTruthy();
  await act(async () => { today.resolve(response(dynamic)); });
  await waitFor(() => expect(screen.queryByText("Updating today's context…")).toBeNull());
  expectHeading();
});

it("retains the heading on baseline failure and retries through the existing query", async () => {
  let fail = true;
  (fetch as jest.Mock).mockImplementation(async (url: string) =>
    url.endsWith("/baseline")
      ? response(fail ? {} : baseline(2200), fail ? 503 : 200)
      : response(dynamic));
  mount();
  expectHeading();
  await waitFor(() => expect(screen.getByRole("status").textContent)
    .toBe("Your nutrition plan is temporarily unavailable."));
  expectHeading();
  expect(screen.queryByText("2,200")).toBeNull();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry loading plan" }));
  await waitFor(() => expect(screen.getByText("2,200")).toBeTruthy());
  expectHeading();
});

it("renders an honest empty state for an empty baseline", async () => {
  (fetch as jest.Mock).mockImplementation(async (url: string) =>
    response(url.endsWith("/baseline") ? null : dynamic));
  mount();
  await waitFor(() => expect(screen.getByRole("status").textContent)
    .toBe("No nutrition plan is available yet."));
  expectHeading();
  expect(screen.queryByText("Cal")).toBeNull();
});

it("preserves provided-summary isolation and its empty/loading states without self requests", () => {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NutritionPersonalizationSummaryCard source="provided" isLoading />
    </QueryClientProvider>,
  );
  expectHeading();
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <NutritionPersonalizationSummaryCard source="provided" />
    </QueryClientProvider>,
  );
  expectHeading();
  expect(screen.getByRole("status").textContent).toBe("No nutrition plan is available yet.");
  expect(fetch).not.toHaveBeenCalled();
});

it("renders the warm baseline immediately on return without waiting for daily context", async () => {
  const first = mount();
  await waitFor(() => expect(screen.getByText("2,200")).toBeTruthy());
  first.unmount();
  const before = (fetch as jest.Mock).mock.calls.filter(([url]) => url.endsWith("/baseline")).length;
  const pending = deferred<Response>();
  (fetch as jest.Mock).mockImplementation(() => pending.promise);
  mount();
  expectHeading();
  expect(screen.getByText("2,200")).toBeTruthy();
  expect((fetch as jest.Mock).mock.calls.filter(([url]) => url.endsWith("/baseline"))).toHaveLength(before);
  await act(async () => { pending.resolve(response(dynamic)); });
});

it("never shows the previous member's macros while the new member loads, even after a late response", async () => {
  const late = deferred<Response>();
  const second = deferred<Response>();
  (fetch as jest.Mock).mockImplementation((url: string) => {
    if (!url.endsWith("/baseline")) return Promise.resolve(response(dynamic));
    return (useAuth() as any).user.id === "first-render-a" ? late.promise : second.promise;
  });
  const view = mount();
  expectHeading();
  auth.mockReturnValue({ user: { id: "first-render-b" } });
  view.rerender(
    <QueryClientProvider client={queryClient}>
      <NutritionPersonalizationSummaryCard />
    </QueryClientProvider>,
  );
  expectHeading();
  await act(async () => { late.resolve(response(baseline(2200))); });
  expect(screen.queryByText("2,200")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Loading your personalized plan…");
  await act(async () => { second.resolve(response(baseline(1800))); });
  await waitFor(() => expect(screen.getByText("1,800")).toBeTruthy());
  expect(screen.queryByText("2,200")).toBeNull();
  expectHeading();
});

it("retains the heading and replaces macros when the existing target-update event revalidates data", async () => {
  mount();
  await waitFor(() => expect(screen.getByText("2,200")).toBeTruthy());
  (fetch as jest.Mock).mockImplementation(async (url: string) =>
    response(url.endsWith("/baseline") ? baseline(2300) : dynamic));
  act(() => window.dispatchEvent(new Event("mpm:targetsUpdated")));
  expectHeading();
  await waitFor(() => expect(screen.getByText("2,300")).toBeTruthy());
  expect(screen.queryByText("2,200")).toBeNull();
});

it("keeps the heading on a fresh-cache load equivalent to a document refresh", async () => {
  const first = mount();
  await waitFor(() => expect(screen.getByText("2,200")).toBeTruthy());
  first.unmount();
  queryClient.clear();
  const pending = deferred<Response>();
  (fetch as jest.Mock).mockImplementation((url: string) =>
    url.endsWith("/baseline") ? pending.promise : Promise.resolve(response(dynamic)));
  mount();
  expectHeading();
  expect(screen.queryByText("2,200")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Loading your personalized plan…");
  await act(async () => { pending.resolve(response(baseline(2300))); });
  await waitFor(() => expect(screen.getByText("2,300")).toBeTruthy());
});
