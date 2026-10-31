/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CoachCornerCard from "@/components/ace/CoachCornerCard";
import { chefMemberText } from "@/lib/chefMemberBranding";

let mockDevelopment = true;
let mockCompleted = false;
const mockNavigate = jest.fn();
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => mockDevelopment }));
jest.mock("wouter", () => ({ useLocation: () => ["/", mockNavigate] }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { completed: mockCompleted } }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => ({
  title: "Chef's Corner", openBtn: "Open Chef's Corner",
  startDesc: "Start your AI coaching relationship with Chef.", learningDesc: "Chef is learning what works for you.",
} as Record<string, string>)[key] }) }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockDevelopment = true; mockCompleted = false; mockNavigate.mockReset();
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

test("Development brands visible text only, preserving routes and unrelated features", () => {
  expect(chefMemberText("Chef's Corner and Coach’s Corner")).toBe("Ask Chef and Ask Chef");
  expect(chefMemberText("/coach-corner/home Parent's Corner Chef Studio")).toBe("/coach-corner/home Parent's Corner Chef Studio");
  mockDevelopment = false;
  expect(chefMemberText("Chef's Corner")).toBe("Chef's Corner");
});

test.each([false, true])("Development card reuses Flame Chef and preserves existing navigation; completed=%s", completed => {
  mockCompleted = completed;
  act(() => root.render(<CoachCornerCard />));
  expect(host.querySelector("h3")?.textContent).toBe("Ask Chef");
  expect(host.textContent).not.toContain("Chef's Corner");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/assets/ChefBlackApron.png");
  const button = host.querySelector("button")!;
  expect(button.textContent).toBe("Open Ask Chef");
  expect(button.className).toContain("focus-visible:ring-2");
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => button.click());
  expect(mockNavigate).toHaveBeenCalledWith(completed ? "/coach-corner/home" : "/coach-corner/welcome");
});

test("Production retains its existing label and card", () => {
  mockDevelopment = false;
  act(() => root.render(<CoachCornerCard />));
  expect(host.querySelector("h3")?.textContent).toBe("Chef's Corner");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("button")?.textContent).toBe("Open Chef's Corner");
});
