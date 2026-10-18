/** @jest-environment jsdom */
import React from "react";
// Exercise refresh mechanics independently of the temporary availability pause.
jest.mock("@shared/pregnancyAvailability", () => ({
  ...jest.requireActual("@shared/pregnancyAvailability"),
  PREGNANCY_CUSTOMER_AVAILABLE: true,
}));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useNutritionSummary } from "@/hooks/useNutritionSummary";
import { PregnancySupportSetupModal } from "@/components/PregnancySupportSetupModal";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "synthetic-parent" } }) }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}), isNativePlatform: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/ui/sheet", () => {
  const React = require("react");
  const Container = ({ children }: any) => React.createElement("div", null, children);
  return { Sheet: Container, SheetContent: Container, SheetHeader: Container, SheetTitle: Container };
});
jest.mock("@/components/ui/pill-button", () => {
  const React = require("react");
  return { PillButton: ({ children, onClick, disabled }: any) =>
    React.createElement("button", { onClick, disabled }, children) };
});

const labels: Record<string, string> = {
  "trimester-2": "Second Trimester", "trimester-3": "Third Trimester",
};
const saved = jest.fn();
function LifePlanProbe() {
  const { data, isDynamicLoading } = useNutritionSummary();
  return <div data-testid="summary" data-loading={String(isDynamicLoading)}>
    {data?.activeInputs.pregnancy?.detail ?? "No pregnancy in summary"}
  </div>;
}
const mount = (showPlan = true) => render(
  <QueryClientProvider client={queryClient}>
    <PregnancySupportSetupModal open onOpenChange={() => {}} onSaved={saved} />
    {showPlan && <LifePlanProbe />}
  </QueryClientProvider>,
);

describe("Pregnancy setup refreshes the same subject's Life Plan", () => {
  let serverStage: string | null;
  let baselineCalls: number;
  let dynamicCalls: number;
  const waitForPlan = async (label: string) => {
    await waitFor(() => expect(screen.getByTestId("summary").textContent).toBe(label));
    await waitFor(() => expect(screen.getByTestId("summary").getAttribute("data-loading")).toBe("false"));
  };
  beforeEach(() => {
    queryClient.clear();
    serverStage = null;
    baselineCalls = 0;
    dynamicCalls = 0;
    saved.mockClear();
    (apiRequest as jest.Mock).mockReset();
    (apiRequest as jest.Mock).mockImplementation(async (_path, options) => {
      serverStage = options.method === "DELETE" ? null : JSON.parse(options.body).stage;
      return { success: true };
    });
    global.fetch = jest.fn(async (url: string) => {
      const baseline = url.endsWith("/baseline");
      if (baseline) baselineCalls++;
      else dynamicCalls++;
      const pregnancy = serverStage
        ? { label: "Pregnancy Nutrition", detail: labels[serverStage] }
        : null;
      return {
        ok: true,
        json: async () => baseline
          ? { activeInputs: { pregnancy, macros: { calories: 2200 } }, nutritionDrivers: null, compositeExplanation: "Saved baseline" }
          : {
              pregnancy, performance: null, liveMetrics: [], compositeExplanation: "Current context",
              nextDayBoundaryAt: new Date(Date.now() + 60_000).toISOString(),
            },
      } as Response;
    }) as jest.Mock;
  });
  afterEach(() => queryClient.clear());

  it("reproduces the absent cached card, then restores it only after successful setup", async () => {
    mount();
    await waitForPlan("No pregnancy in summary");
    expect(baselineCalls).toBe(1);
    expect(dynamicCalls).toBe(1);
    // Updating user/page context alone cannot change these warm query responses.
    serverStage = "trimester-3";
    await act(async () => {});
    expect(screen.getByTestId("summary").textContent).toBe("No pregnancy in summary");
    fireEvent.click(screen.getByText("pregnancySupport.stage.trimester3.label"));
    fireEvent.click(screen.getByText("pregnancySupport.saveButton"));
    await waitForPlan("Third Trimester");
    expect(baselineCalls).toBeGreaterThan(1);
    expect(dynamicCalls).toBeGreaterThan(1);
    expect(saved).toHaveBeenCalledWith({ stage: "trimester-3", dueDate: null });
    expect(queryClient.getQueryData<any>(["nutrition-summary", "baseline", "synthetic-parent"])
      .activeInputs.macros.calories).toBe(2200);
  });

  it("updates an existing stage and removes the card after successful deactivation", async () => {
    serverStage = "trimester-2";
    mount();
    await waitForPlan("Second Trimester");
    fireEvent.click(screen.getByText("pregnancySupport.stage.trimester3.label"));
    fireEvent.click(screen.getByText("pregnancySupport.saveButton"));
    await waitForPlan("Third Trimester");
    fireEvent.click(screen.getByText("pregnancySupport.turnOff"));
    fireEvent.click(screen.getByText("pregnancySupport.yesTurnOff"));
    await waitForPlan("No pregnancy in summary");
    expect(apiRequest).toHaveBeenLastCalledWith("/api/pregnancy/setup", { method: "DELETE" });
  });

  it("invalidates a warm unmounted baseline so returning to Life Plan does not keep the missing card", async () => {
    const first = mount();
    await waitForPlan("No pregnancy in summary");
    first.unmount();
    const setupOnly = mount(false);
    fireEvent.click(screen.getByText("pregnancySupport.stage.trimester3.label"));
    fireEvent.click(screen.getByText("pregnancySupport.saveButton"));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(queryClient.getQueryState(["nutrition-summary", "baseline", "synthetic-parent"])?.isInvalidated).toBe(true);
    setupOnly.unmount();
    mount();
    await waitForPlan("Third Trimester");
  });

  it("does not clear or change Life Plan when saving fails", async () => {
    serverStage = "trimester-2";
    (apiRequest as jest.Mock).mockRejectedValueOnce(new Error("Synthetic save failure"));
    mount();
    await waitForPlan("Second Trimester");
    const before = [baselineCalls, dynamicCalls];
    fireEvent.click(screen.getByText("pregnancySupport.stage.trimester3.label"));
    fireEvent.click(screen.getByText("pregnancySupport.saveButton"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Synthetic save failure"));
    expect(screen.getByTestId("summary").textContent).toBe("Second Trimester");
    expect([baselineCalls, dynamicCalls]).toEqual(before);
    expect(saved).not.toHaveBeenCalled();
  });
});
