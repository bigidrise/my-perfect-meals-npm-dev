import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";

let mockDesktop = false;
const mockNavigate = jest.fn();
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => mockDesktop }));
jest.mock("@/lib/developmentComingSoon", () => ({ developmentComingSoonEnabled: true }));
jest.mock("@/components/copilot/useCopilotPageExplanation", () => ({
  useCopilotPageExplanation: jest.fn(),
}));
jest.mock("@/components/PhaseGate", () => ({
  __esModule: true, default: ({ children }: any) => children,
}));
jest.mock("wouter", () => ({
  useLocation: () => ["/lifestyle/pairings-hub", mockNavigate],
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ initial, animate, transition, ...props }: any) => <div {...props} />,
  },
}));

import PairingsHub from "@/pages/lifestyle/PairingsHub";

beforeEach(() => {
  mockDesktop = false;
  mockNavigate.mockClear();
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

test("mobile gets the black-glass header, orange wine icon, title and working Back button", () => {
  render(<PairingsHub />);
  const header = screen.getByRole("banner", { name: "Pairings Hub" });
  expect(header.className).toContain("bg-black/30");
  expect(header.className).toContain("backdrop-blur-lg");
  expect(header.className).toContain("fixed");
  expect(header.querySelector("svg.lucide-wine")?.classList.contains("text-orange-500")).toBe(true);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pairings Hub");
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Drink Intelligence");
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(mockNavigate).toHaveBeenCalledWith("/lifestyle");
});

test("header and content follow the Cravings hub's existing safe-area clearance pattern", () => {
  // JSDOM drops env() CSS values; verify the actual browser-bound source as well.
  const source = fs.readFileSync("client/src/pages/lifestyle/PairingsHub.tsx", "utf8");
  expect(source).toContain('<MobileHeaderGuard>');
  expect(source).toContain('style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}');
  expect(source).toContain('"calc(env(safe-area-inset-top, 0px) + 6rem)"');
});

test("desktop keeps its existing shell without a duplicate mobile header or extra top spacing", () => {
  mockDesktop = true;
  render(<PairingsHub />);
  expect(screen.queryByRole("banner")).toBeNull();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.getByTestId("pairingshub-content").style.paddingTop).toBe("0px");
});

test.each([
  ["pairingshub-ai", "/lifestyle/pairings-ai"],
  ["pairingshub-wine-list", "/lifestyle/wine-list-helper"],
  ["pairingshub-reduction", "/lifestyle/reduce-drinking-plan"],
])("the existing %s tool keeps its destination", (id, route) => {
  render(<PairingsHub />);
  fireEvent.click(screen.getByTestId(id));
  expect(mockNavigate).toHaveBeenCalledWith(route);
});
