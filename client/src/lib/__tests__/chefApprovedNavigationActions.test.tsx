/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CoachBubble, { type CoachStructuredResponse } from "@/components/coaching/CoachBubble";

const mockNavigate = jest.fn((route: string) => window.history.pushState({}, "", route));
const mockRequest = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => [window.location.pathname, mockNavigate] }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockRequest(...args) }));
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/coach-corner/home");
  mockNavigate.mockClear(); mockRequest.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function render(destinationId: any, label: string, state = "direct_navigation") {
  const response: CoachStructuredResponse = {
    whatIFound: "", whatItCouldMean: "", learningOpportunity: null,
    presentation: { kind: "concierge", message: `Use ${label} with your existing access.`,
      destinationId, navigation: { state: state as any, destinationId,
        goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown",
          dishChosen: false, specialty: "none", explicitFeatureId: destinationId } } },
    todayPlan: { why: "", successMetric: "", nextCheckIn: "",
      items: [{ kind: "use_feature", text: `Open ${label}`, destinationId }] },
  };
  act(() => root.render(<CoachBubble structured={response} enableConcierge emphasizeFeatureNames
    messageId="11111111-1111-4111-8111-111111111111" />));
}

test.each([
  ["restaurant_guide", "Restaurant Assistant", "/social-hub/restaurant-guide"],
  ["beverage_creator", "Beverage Creator", "/lifestyle/beverage-creator"],
  ["meal_builders", "Meal Builders", "/builders"],
])("%s displays one formatted action, authorizes the click, changes route and then sends a receipt", async (id, label, route) => {
  mockRequest.mockImplementation(async (url: string) => url.endsWith("/performed")
    ? { recorded: true } : { destinationId: id, route });
  render(id, label);
  expect(host.querySelectorAll("button")).toHaveLength(1);
  expect(host.querySelector("button")?.textContent).toBe(`Open ${label}`);
  expect(host.querySelector("strong")?.textContent).toBe(label);
  expect(mockRequest).not.toHaveBeenCalled();
  await act(async () => { host.querySelector("button")!.click(); });
  expect(mockRequest.mock.calls[0]).toEqual(["/api/coach/navigation",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ destinationId: id }) })]);
  expect(window.location.pathname).toBe(route);
  expect(mockRequest.mock.calls[1]).toEqual(["/api/coach/navigation/performed",
    expect.objectContaining({ body: JSON.stringify({ messageId: "11111111-1111-4111-8111-111111111111", destinationId: id }) })]);
});
test("a recommendation does not render a button or create route evidence", () => {
  render("beverage_creator", "Beverage Creator", "recommendation_pending");
  expect(host.querySelector("button")).toBeNull();
  expect(mockRequest).not.toHaveBeenCalled();
});
test.each(["401 Unauthorized", "403 Forbidden", "503 unavailable"])("%s prevents navigation and receipts", async error => {
  mockRequest.mockRejectedValue(new Error(error));
  render("restaurant_guide", "Restaurant Assistant");
  await act(async () => { host.querySelector("button")!.click(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/coach-corner/home");
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[role=alert]")).not.toBeNull();
});
test("a mismatched server route cannot navigate or create a receipt", async () => {
  mockRequest.mockResolvedValue({ destinationId: "beverage_creator", route: "/diabetic-menu-builder" });
  render("beverage_creator", "Beverage Creator");
  await act(async () => { host.querySelector("button")!.click(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockRequest).toHaveBeenCalledTimes(1);
});
