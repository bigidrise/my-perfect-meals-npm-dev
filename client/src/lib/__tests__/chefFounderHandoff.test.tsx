/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CoachBubble from "@/components/coaching/CoachBubble";
import CoachFeatureAction from "@/components/coaching/CoachFeatureAction";
import { COACH_DESTINATIONS, type CoachDestinationId } from "@shared/coaching/navigation";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

const mockAPI = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("wouter", () => ({ useLocation: () => ["/coach-corner/home", mockNavigate] }));
const ids: CoachDestinationId[] = ["shopping_list", "fridge_rescue", "beverage_creator",
  "athlete_beverage_creator", "restaurant_guide", "craving_creator", "dessert_creator", "my_perfect_menu"];

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockAPI.mockReset(); mockNavigate.mockReset();
});

test.each(["performed", "denied", "not_observed", "mismatched_route", "receipt_failed"] as const)(
  "a button is not navigation evidence: %s", async outcome => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const route = chefNavigationRoute("beverage_creator");
    window.history.replaceState({}, "", "/coach-corner/home");
    mockNavigate.mockImplementation((next: string) => {
      if (outcome !== "not_observed") window.history.replaceState({}, "", next);
    });
    if (outcome === "denied") mockAPI.mockRejectedValueOnce(new Error("403 denied"));
    else mockAPI.mockResolvedValueOnce({ destinationId: "beverage_creator",
      route: outcome === "mismatched_route" ? "/unauthorized" : route });
    if (outcome === "receipt_failed") mockAPI.mockRejectedValueOnce(new Error("Receipt unavailable"));
    else mockAPI.mockResolvedValueOnce({ recorded: true });
    try {
      act(() => root.render(<CoachFeatureAction destinationId="beverage_creator" messageId="synthetic-message" />));
      expect(mockAPI).not.toHaveBeenCalled();
      await act(async () => host.querySelector("button")!.click());
      const reports = mockAPI.mock.calls.filter(([path]) => path === "/api/coach/navigation/performed");
      if (outcome === "performed" || outcome === "receipt_failed") {
        expect(reports).toHaveLength(1);
        expect(reports[0][1].body).toBe(JSON.stringify({ messageId: "synthetic-message", destinationId: "beverage_creator" }));
        expect(window.location.pathname).toBe(route);
      } else expect(reports).toEqual([]);
      if (outcome === "denied" || outcome === "mismatched_route") expect(mockNavigate).not.toHaveBeenCalled();
      if (outcome === "denied") expect(host.querySelector("[role=alert]")?.textContent).toContain("current access");
      if (outcome === "receipt_failed") expect(host.querySelector("[role=alert]")).toBeNull();
    } finally {
      act(() => root.unmount());
      window.history.replaceState({}, "", "/coach-corner/home");
    }
  },
);

test.each(ids)("the real bubble renders and click-authorizes the %s handoff", async destinationId => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    const route = chefNavigationRoute(destinationId);
    const destination = COACH_DESTINATIONS[destinationId];
    const label = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
    act(() => root.render(<CoachBubble enableConcierge emphasizeFeatureNames structured={{
      presentation: { kind: "concierge", message: `Use ${destination.label}.`, destinationId,
        navigation: { state: "navigation_confirmed", destinationId,
          goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown",
            specialty: "none", dishChosen: false, explicitFeatureId: destinationId } } },
      whatIFound: "", whatItCouldMean: "", learningOpportunity: null,
      todayPlan: { why: "", successMetric: "", nextCheckIn: "",
        items: [{ kind: "use_feature", horizon: "today", text: "Open the recommended feature", destinationId }] },
    }} />));
    const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === `Open ${label}`);
    expect([...host.querySelectorAll("strong")].map(node => node.textContent)).toContain(destination.label);
    expect(buttons).toHaveLength(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    mockAPI.mockResolvedValueOnce({ destinationId, route });
    await act(async () => buttons[0].click());
    expect(mockAPI).toHaveBeenCalledWith("/api/coach/navigation",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ destinationId }) }));
    expect(mockNavigate).toHaveBeenCalledWith(route);
  } finally { act(() => root.unmount()); host.remove(); }
});
