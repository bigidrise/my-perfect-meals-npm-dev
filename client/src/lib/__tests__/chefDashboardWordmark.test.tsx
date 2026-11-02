/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CoachCornerCard from "@/components/ace/CoachCornerCard";

let mockCompleted = false;
let mockConversationEnabled = true;
const mockNavigate = jest.fn();

jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", mockNavigate] }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { completed: mockCompleted } }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/chefCornerExperience", () => ({
  isChefConversationEnabled: () => mockConversationEnabled,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockCompleted = false;
  mockConversationEnabled = true;
  mockNavigate.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

test("the approved artwork is the single accessible heading with bounded proportional sizing", () => {
  act(() => root.render(<CoachCornerCard />));
  const heading = host.querySelector("h3")!;
  const image = heading.querySelector("img")!;
  expect(host.querySelectorAll("h3")).toHaveLength(1);
  expect(image.getAttribute("src")).toBe("/assets/ask-chef-wordmark.webp");
  expect(image.alt).toBe("Ask Chef");
  expect(image.width).toBe(600);
  expect(image.height).toBe(200);
  expect(image.className).toContain("h-[3.12rem]");
  expect(image.className).toContain("sm:h-[3.96rem]");
  for (const constraint of ["w-auto", "max-w-full", "object-contain"]) {
    expect(image.classList.contains(constraint)).toBe(true);
  }
  expect(heading.querySelector("span")).toBeNull();
  expect(heading.nextElementSibling?.textContent?.trim()).toBe("Platform Concierge");
  expect(host.textContent?.split("Platform Concierge")).toHaveLength(2);
});

test.each([
  [false, "/coach-corner/welcome"],
  [true, "/coach-corner/home"],
])("the existing card and click destination remain intact when completed=%s", (completed, destination) => {
  mockCompleted = completed as boolean;
  act(() => root.render(<CoachCornerCard />));
  const mascot = host.querySelector('img[alt="Flame Chef"]')!;
  expect(mascot.getAttribute("src")).toBe("/assets/ask-chef-desk.webp");
  expect(mascot.classList.contains("object-cover")).toBe(true);
  expect(mascot.parentElement?.classList.contains("overflow-hidden")).toBe(true);
  expect(mascot.parentElement?.className).toContain("h-[4.5rem]");
  expect(host.textContent).toContain("Your food & platform guide");
  expect(host.textContent).toContain("Ask about food, explore meal ideas, or find your way around My Perfect Meals.");
  const button = host.querySelector("button")!;
  expect(button.textContent?.trim()).toBe("Open Ask Chef");
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => button.click());
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith(destination);
});

test("the inactive legacy card is not given the new wordmark", () => {
  mockConversationEnabled = false;
  act(() => root.render(<CoachCornerCard />));
  expect(host.querySelector('img[src="/assets/ask-chef-wordmark.webp"]')).toBeNull();
  expect(host.querySelector("h3")?.textContent).toBe("title");
  act(() => host.querySelector("button")!.click());
  expect(mockNavigate).toHaveBeenCalledWith("/coach-corner/welcome");
});
