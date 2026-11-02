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

test("release branding covers legacy spellings, preserving routes and unrelated features", () => {
  expect(chefMemberText("Chef's Corner and Coach’s Corner")).toBe("Ask Chef and Ask Chef");
  expect(chefMemberText("/coach-corner/home Parent's Corner Chef Studio")).toBe("/coach-corner/home Parent's Corner Chef Studio");
  expect(chefMemberText("Chefs Corner / Chef Corner / Coach Corner / Coach's Corner"))
    .toBe("Ask Chef / Ask Chef / Ask Chef / Ask Chef");
  mockDevelopment = false;
  expect(chefMemberText("Chef's Corner")).toBe("Ask Chef");
});

test.each([false, true])("released card shows the new artwork and preserves existing navigation; completed=%s", completed => {
  mockCompleted = completed;
  act(() => root.render(<CoachCornerCard />));
  expect(host.querySelector("h3 img")?.getAttribute("alt")).toBe("Ask Chef");
  expect(host.textContent).not.toContain("Chef's Corner");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/assets/ask-chef-desk.webp");
  const button = host.querySelector("button")!;
  expect(button.textContent).toBe("Open Ask Chef");
  expect(button.className).toContain("focus-visible:ring-2");
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => button.click());
  expect(mockNavigate).toHaveBeenCalledWith(completed ? "/coach-corner/home" : "/coach-corner/welcome");
});

test("Ask Chef CTA keeps its layout and has white centered text, a dimensional orange gradient and accessible interaction states", () => {
  act(() => root.render(<CoachCornerCard />));
  const button = host.querySelector("button")!;
  for (const token of [
    "w-full", "rounded-xl", "border", "px-4", "py-3", "text-[11px]",
    "font-bold", "uppercase", "tracking-[0.14em]", "text-center", "text-[#FFFFFF]",
    "bg-gradient-to-r", "border-orange-200/80",
    "focus-visible:ring-2", "focus-visible:ring-orange-200", "focus-visible:ring-offset-2",
  ]) expect(button.classList.contains(token)).toBe(true);
  expect(button.className).toMatch(/shadow-\[inset_/);
  expect(button.className).toMatch(/hover:via-/);
  expect(button.className).toMatch(/active:via-/);
  expect(button.textContent).toBe("Open Ask Chef");
});

test("white CTA text meets WCAG AA against every normal, hover and pressed gradient stop", () => {
  act(() => root.render(<CoachCornerCard />));
  const classes = host.querySelector("button")!.className;
  const stops = [...classes.matchAll(/(?:^| )(?:hover:|active:)?(?:from|via|to)-\[#([0-9a-f]{6})\]/gi)];
  expect(stops).toHaveLength(9);
  for (const [, hex] of stops) {
    const [r, g, b] = [0, 2, 4].map(offset => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});

test("release branding changes legacy card copy without activating the Development experience", () => {
  mockDevelopment = false;
  act(() => root.render(<CoachCornerCard />));
  expect(host.querySelector("h3")?.textContent).toBe("Ask Chef");
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("button")?.textContent).toBe("Open Ask Chef");
});
