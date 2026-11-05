/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CoachBubble from "@/components/coaching/CoachBubble";
import { COACH_DESTINATIONS, type CoachDestinationId } from "@shared/coaching/navigation";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

const mockAPI = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("wouter", () => ({ useLocation: () => ["/coach-corner/home", mockNavigate] }));
const ids: CoachDestinationId[] = ["shopping_list", "fridge_rescue", "beverage_creator",
  "athlete_beverage_creator", "restaurant_guide", "craving_creator", "my_perfect_menu"];

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockAPI.mockReset(); mockNavigate.mockReset();
});

test.each(ids)("the real bubble renders and click-authorizes the %s handoff", async destinationId => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    const route = chefNavigationRoute(destinationId);
    const destination = COACH_DESTINATIONS[destinationId];
    const label = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
    act(() => root.render(<CoachBubble enableConcierge structured={{
      presentation: { kind: "concierge", message: "Use the approved action below.", destinationId,
        navigation: { state: "navigation_confirmed", destinationId,
          goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown",
            specialty: "none", dishChosen: false, explicitFeatureId: destinationId } } },
      whatIFound: "", whatItCouldMean: "", learningOpportunity: null,
      todayPlan: { why: "", successMetric: "", nextCheckIn: "",
        items: [{ kind: "use_feature", horizon: "today", text: "Open the recommended feature", destinationId }] },
    }} />));
    const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === `Open ${label}`);
    expect(buttons).toHaveLength(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    mockAPI.mockResolvedValueOnce({ destinationId, route });
    await act(async () => buttons[0].click());
    expect(mockAPI).toHaveBeenCalledWith("/api/coach/navigation",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ destinationId }) }));
    expect(mockNavigate).toHaveBeenCalledWith(route);
  } finally { act(() => root.unmount()); host.remove(); }
});
