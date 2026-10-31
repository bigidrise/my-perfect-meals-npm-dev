/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CoachFeatureAction from "@/components/coaching/CoachFeatureAction";
import { COACH_DESTINATIONS } from "@shared/coaching/navigation";

const mockNavigate = jest.fn();
const mockRequest = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/coach-corner/home", mockNavigate] }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockRequest(...args) }));
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockNavigate.mockReset(); mockRequest.mockReset();
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = (id: unknown) => act(() => root.render(<CoachFeatureAction destinationId={id} />));
async function click() {
  await act(async () => { host.querySelector("button")!.click(); });
}

test.each(Object.entries(COACH_DESTINATIONS))("member click opens %s without generating", async (id, destination) => {
  mockRequest.mockResolvedValue({ destinationId: id, route: destination.route });
  render(id);
  expect(host.textContent).toBe(`Open ${destination.label}`);
  expect(mockRequest).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  await click();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith("/api/coach/navigation", {
    method: "POST", body: JSON.stringify({ destinationId: id }),
  });
  expect(mockNavigate).toHaveBeenCalledWith(destination.route);
});
test.each(["made_up_feature", "https://evil.example", "__proto__", "pregnancy_coach"])("no button for %s", id => {
  render(id);
  expect(host.querySelector("button")).toBeNull();
});
test("denied access stays in the conversation and displays a useful message", async () => {
  mockRequest.mockRejectedValue(new Error("403: Pro required"));
  render("sushi_creator"); await click();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("not included");
});
test("a tampered server route cannot navigate", async () => {
  mockRequest.mockResolvedValue({ destinationId: "sushi_creator", route: "https://evil.example" });
  render("sushi_creator"); await click();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
test("return/remount restores a saved action without auto-opening", () => {
  render("beverage_creator");
  act(() => root.render(null));
  render("beverage_creator");
  expect(host.textContent).toBe("Open Beverage Creator");
  expect(mockRequest).not.toHaveBeenCalled();
});
