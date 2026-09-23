/** @jest-environment jsdom */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { clearNutritionCache } from "@/hooks/nutritionStateCache";
import { useNutritionSummary } from "@/hooks/useNutritionSummary";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}), isNativePlatform: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));

const auth = useAuth as jest.Mock;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const summary = (user: string) => ({
  activeInputs: { macros: { calories: user === "a" ? 2200 : 1800 } },
  compositeExplanation: `baseline:${user}`,
  nutritionDrivers: null,
});
const dynamic = {
  performance: null,
  pregnancy: null,
  liveMetrics: [],
  compositeExplanation: "today's activity",
  nextDayBoundaryAt: "2099-01-01T00:00:00Z",
};

describe("Dashboard self Life Plan query ownership", () => {
  let baselineCalls: number;
  let dynamicCalls: number;
  let dynamicFailure: boolean;
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryDefaults(["nutrition-summary", "dynamic"], { retry: false });
    baselineCalls = 0;
    dynamicCalls = 0;
    dynamicFailure = false;
    auth.mockReturnValue({ user: { id: "a" } });
    global.fetch = jest.fn(async (url: string) => {
      const isBaseline = url.endsWith("/baseline");
      if (isBaseline) baselineCalls++;
      else dynamicCalls++;
      return {
        ok: isBaseline || !dynamicFailure,
        status: dynamicFailure && !isBaseline ? 503 : 200,
        json: async () => isBaseline
          ? summary((useAuth() as any).user.id)
          : dynamic,
      } as Response;
    }) as jest.Mock;
  });
  afterEach(() => queryClient.clear());

  it("renders a warm baseline on return without a baseline refetch; dynamic refreshes", async () => {
    const first = renderHook(() => useNutritionSummary(), { wrapper });
    await waitFor(() => expect(first.result.current.data?.activeInputs.macros?.calories).toBe(2200));
    first.unmount();
    const beforeReturn = baselineCalls;
    const second = renderHook(() => useNutritionSummary(), { wrapper });
    expect(second.result.current.data?.activeInputs.macros?.calories).toBe(2200);
    await waitFor(() => expect(dynamicCalls).toBeGreaterThan(1));
    expect(baselineCalls).toBe(beforeReturn);
    second.unmount();
  });

  it("invalidates only dynamic context for hydration and a selected Performance day", async () => {
    const hook = renderHook(() => useNutritionSummary(), { wrapper });
    await waitFor(() => expect(hook.result.current.data?.activeInputs.macros?.calories).toBe(2200));
    await waitFor(() => expect(hook.result.current.data?.compositeExplanation).toBe("today's activity"));
    const before = baselineCalls;
    act(() => window.dispatchEvent(new Event("mpm:hydrationUpdated")));
    await waitFor(() => expect(dynamicCalls).toBeGreaterThan(1));
    act(() => window.dispatchEvent(new CustomEvent("mpm:targetsUpdated", { detail: { reason: "performanceDate" } })));
    await waitFor(() => expect(dynamicCalls).toBeGreaterThan(2));
    expect(baselineCalls).toBe(before);
    act(() => window.dispatchEvent(new Event("mpm:targetsUpdated")));
    await waitFor(() => expect(baselineCalls).toBeGreaterThan(before));
    hook.unmount();
  });

  it("keeps cached macros during a dynamic failure, and isolates identity and logout", async () => {
    const hook = renderHook(() => useNutritionSummary(), { wrapper });
    await waitFor(() => expect(hook.result.current.data?.compositeExplanation).toBe("today's activity"));
    dynamicFailure = true;
    act(() => window.dispatchEvent(new Event("mpm:glucoseUpdated")));
    await waitFor(() => expect(hook.result.current.isDynamicError).toBe(true));
    expect(hook.result.current.data?.activeInputs.macros?.calories).toBe(2200);
    expect(hook.result.current.data?.compositeExplanation).toBe("baseline:a");

    auth.mockReturnValue({ user: { id: "b" } });
    hook.rerender();
    expect(hook.result.current.data?.activeInputs.macros?.calories).not.toBe(2200);
    await waitFor(() => expect(hook.result.current.data?.activeInputs.macros?.calories).toBe(1800));
    expect(queryClient.getQueryData(["nutrition-summary", "baseline", "a"])).toBeUndefined();
    act(() => clearNutritionCache());
    expect(queryClient.getQueryData(["nutrition-summary", "baseline", "b"])).toBeUndefined();
    hook.unmount();
  });

  it("does not query a self summary for a provided professional subject", () => {
    const hook = renderHook(() => useNutritionSummary(false), { wrapper });
    expect(baselineCalls).toBe(0);
    expect(dynamicCalls).toBe(0);
    hook.unmount();
  });
});