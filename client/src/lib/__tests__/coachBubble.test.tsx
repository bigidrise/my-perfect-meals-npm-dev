/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CoachBubble, { ProfessionalBoundaryNotice, type CoachStructuredResponse } from "@/components/coaching/CoachBubble";
import fs from "node:fs";

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
const legacy: CoachStructuredResponse = {
  whatIFound: "LEGACY_MAIN", whatItCouldMean: "LEGACY_EXPLANATION",
  todayPlan: { why: "DISCONNECTED_PLAN", items: [{ kind: "other", text: "INTERNAL_ACTION" }],
    successMetric: "INTERNAL_METRIC", nextCheckIn: "INTERNAL_CHECK_IN" },
  learningOpportunity: "INTERNAL_LEARNING",
};
const ordinary = (message: string): CoachStructuredResponse => ({
  ...JSON.parse(JSON.stringify(legacy)), presentation: { kind: "concierge", message },
});
function render(structured: CoachStructuredResponse, enable = true) {
  act(() => root.render(<CoachBubble structured={structured} enableConcierge={enable} />));
}

test("actual discovery bubble contains only its intended question with no fragments or blank separators", () => {
  render(ordinary("All right! Are you in the mood for something savory, sweet, or light?"));
  expect(host.textContent).toBe("CoachAll right! Are you in the mood for something savory, sweet, or light?");
  expect(host.textContent).not.toMatch(/LEGACY|INTERNAL|DISCONNECTED|hungry|nutritional|logs/);
  expect(host.querySelectorAll("p")).toHaveLength(2); // Label and message.
  expect(host.querySelectorAll("ul, hr, button, .border-t")).toHaveLength(0);
});

test.each(["create_a_dish", "sushi_creator"])("one validated %s button appears without duplicate recommendation text", async id => {
  const value = ordinary("Let's make that.");
  value.presentation = { kind: "concierge", message: "Let's make that.", destinationId: id as any };
  value.todayPlan!.items = [
    { kind: "use_feature", text: "DUPLICATE_ACTION_TEXT", destinationId: id },
    { kind: "use_feature", text: "SECOND_DUPLICATE", destinationId: id },
  ];
  render(value);
  expect(host.querySelectorAll("button")).toHaveLength(1);
  expect(host.textContent).not.toMatch(/DUPLICATE|DISCONNECTED|LEGACY/);
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  const route = id === "sushi_creator" ? "/lifestyle/sushi-creator" : "/lifestyle/create-a-dish";
  mockRequest.mockResolvedValue({ destinationId: id, route });
  await act(async () => { host.querySelector("button")!.click(); });
  expect(mockRequest).toHaveBeenCalledWith("/api/coach/navigation", {
    method: "POST", body: JSON.stringify({ destinationId: id }),
  });
  expect(mockNavigate).toHaveBeenCalledWith(route);
});

test("no action can leak into clarification from internal plan fields", () => {
  const value = ordinary("Savory or sweet?");
  value.todayPlan!.items = [{ kind: "use_feature", text: "Open", destinationId: "sushi_creator" }];
  render(value);
  expect(host.querySelector("button")).toBeNull();
});

test("a forged or unmatched presentation destination cannot create a button", () => {
  const value = ordinary("Choose what sounds good.");
  value.presentation!.destinationId = "https://evil.example" as any;
  render(value); expect(host.querySelector("button")).toBeNull();
  value.presentation!.destinationId = "sushi_creator";
  render(value); expect(host.querySelector("button")).toBeNull();
});

test("education displays the complete answer without adding plan or coaching paragraphs", () => {
  const message = "Protein supplies amino acids.\n\nCarbohydrates supply energy.";
  render(ordinary(message));
  expect(host.textContent).toBe(`Coach${message}`);
  expect(host.querySelector("button")).toBeNull();
});

test("care escalation overrides a concierge presentation and shows safety guidance", () => {
  const value = ordinary("UNSAFE_COMPACT_OVERRIDE");
  value.whatIFound = "Seek urgent medical assistance.";
  value.todayPlan!.items = [{ kind: "contact_care", text: "Call emergency services." },
    { kind: "use_feature", text: "Open sushi", destinationId: "sushi_creator" }];
  render(value);
  expect(host.textContent).toContain("Seek urgent medical assistance.");
  expect(host.textContent).toContain("Call emergency services.");
  expect(host.textContent).not.toContain("UNSAFE_COMPACT_OVERRIDE");
  expect(host.querySelector("button")).toBeNull();
});

test("a safety red flag also prevents compact suppression", () => {
  render({ ...ordinary("HIDE_GUIDANCE"), meta: { redFlag: true }, whatIFound: "Required safety guidance." });
  expect(host.textContent).toContain("Required safety guidance.");
  expect(host.textContent).not.toContain("HIDE_GUIDANCE");
});

test("stored coaching without presentation remains readable with its original sections and boundary", () => {
  render(JSON.parse(JSON.stringify(legacy)));
  expect(host.textContent).toContain("LEGACY_MAIN");
  expect(host.textContent).toContain("LEGACY_EXPLANATION");
  expect(host.textContent).toContain("DISCONNECTED_PLAN");
  expect(host.textContent).toContain("INTERNAL_LEARNING");
  expect(host.textContent).toContain("please follow their guidance");
});

test("stored concierge JSON restores the same message and does not auto-open", () => {
  const value = ordinary("Would you prefer warm or fresh?");
  render(JSON.parse(JSON.stringify(value)));
  act(() => root.render(null));
  render(JSON.parse(JSON.stringify(value)));
  expect(host.textContent).toBe("CoachWould you prefer warm or fresh?");
  expect(mockRequest).not.toHaveBeenCalled();
});

test("Production-style display ignores the Development presentation", () => {
  render(ordinary("DEV_ONLY_MESSAGE"), false);
  expect(host.textContent).toContain("LEGACY_MAIN");
  expect(host.textContent).not.toContain("DEV_ONLY_MESSAGE");
});

test("the unchanged professional notice stays visible outside compact bubbles at the composer", () => {
  act(() => root.render(<>
    <CoachBubble structured={ordinary("Savory or sweet?")} enableConcierge />
    <CoachBubble structured={ordinary("Warm or fresh?")} enableConcierge />
    <ProfessionalBoundaryNotice />
  </>));
  expect((host.textContent!.match(/These are suggestions/g) ?? [])).toHaveLength(1);
  expect(host.textContent).toContain("concerns or changes to your nutrition or health plan");
  const page = fs.readFileSync("client/src/pages/CoachsCorner.tsx", "utf8");
  expect(page).toContain("messages.some(msg => msg.structured && isConciergeMessage(msg.structured))");
});
