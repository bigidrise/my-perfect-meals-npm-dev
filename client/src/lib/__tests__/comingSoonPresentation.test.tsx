import React from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";

let mockDesktop = false;
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => mockDesktop }));
jest.mock("wouter", () => ({
  useLocation: () => [window.location.pathname, (path: string) => window.history.pushState({}, "", path)],
  Link: ({ href, children, ...props }: any) => (
    <a {...props} href={href} onClick={event => {
      event.preventDefault();
      window.history.pushState({}, "", href);
    }}>{children}</a>
  ),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => { throw new Error("Coming Soon must not load account content"); }),
}));
jest.mock("@/lib/api", () => ({ post: jest.fn(), ApiError: class extends Error {} }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/components/PregnancySupportSetupModal", () => ({ PregnancySupportSetupModal: () => null }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ VoiceInputButton: () => null }));
import Presentation from "@/components/coming-soon/ComingSoonPresentation";
import Notice from "@/components/coming-soon/PlannedFeaturesNotice";
import Advisor from "@/pages/lifestyle/DrinkAdvisorComingSoon";
import Pregnancy from "@/pages/MyPerfectPregnancyPage";
import { useAuth } from "@/contexts/AuthContext";
import { post } from "@/lib/api";
import { getDisplayFeaturesForTier, IOS_DISPLAY_FEATURES } from "@shared/planFeatures";

beforeEach(() => {
  mockDesktop = false;
  window.history.replaceState({}, "", "/lifestyle/ai-pairing-advisor");
});
afterEach(cleanup);

it("renders the advisor description and branding without account or AI calls", () => {
  const { container } = render(<Advisor />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AI Pairing Advisor — Coming Soon.");
  expect(container.textContent).toContain("A more conversational way to explore drink pairings, preferences, and food combinations is on the way.");
  expect(screen.getByText("My Perfect Meals")).toBeTruthy();
  expect(screen.getByLabelText("AI Pairing Advisor page header")).toBeTruthy();
  expect(useAuth).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});
it("uses one safe-area inset without changing page scroll ownership", () => {
  const props = { title: "Coming Soon", description: "Future", headerLabel: "Feature",
    backHref: "/lifestyle", backLabel: "Back", testId: "sample" };
  const { container } = render(<Presentation {...props} />);
  expect(container.querySelector("header")).toBeNull();
  expect(JSON.stringify(Presentation(props)).match(/safe-area-inset-top/g)).toHaveLength(1);
  expect(container.querySelector('[style*="height"]')).toBeNull();
});
it("does not duplicate the desktop app header", () => {
  mockDesktop = true;
  render(<Advisor />);
  expect(screen.queryByLabelText("AI Pairing Advisor page header")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
});
it.each([
  ["/lifestyle/ai-pairing-advisor", "Back to Drink Intelligence", "/lifestyle/pairings-hub"],
  ["/lifestyle/ai-pairing-advisor?from=pricing", "Back to Subscription", "/pricing"],
  ["/lifestyle/ai-pairing-advisor?from=https://example.invalid", "Back to Drink Intelligence", "/lifestyle/pairings-hub"],
])("back from %s uses internal routing", (path, label, target) => {
  window.history.replaceState({}, "", path);
  const push = jest.spyOn(window.history, "pushState");
  render(<Advisor />);
  const link = screen.getByRole("link", { name: label });
  expect(link.getAttribute("href")).toBe(target);
  expect(fireEvent.click(link, { button: 0 })).toBe(false);
  expect(window.location.pathname).toBe(target);
  expect(push).toHaveBeenCalled();
  push.mockRestore();
});
it("preserves Pregnancy's safety pause and internal Back in every build", () => {
  const { container } = render(<Pregnancy />);
  expect(screen.getByText("My Perfect Meals")).toBeTruthy();
  expect(container.textContent).toContain("Existing Pregnancy settings are preserved");
  expect(container.textContent).toContain("not pregnancy-adjusted");
  expect(screen.getByRole("link", { name: "Back to Lifestyle" }).getAttribute("href")).toBe("/lifestyle");
  expect(useAuth).not.toHaveBeenCalled();
});
it("preserves web and iOS Pregnancy Clinical labels", () => {
  expect(getDisplayFeaturesForTier("ultimate").find(label => label.includes("My Perfect Pregnancy"))).toContain("Coming Soon (Clinical)");
  expect(IOS_DISPLAY_FEATURES.ultimate.find(label => label.includes("My Perfect Pregnancy"))).toContain("Coming Soon (Clinical)");
});
it("does not sell unavailable features or change existing Drink Pairing access", () => {
  render(<Notice />);
  expect(screen.getByRole("heading").textContent).toContain("not available yet");
  expect(screen.getByText("My Perfect Pregnancy — Coming Soon (Clinical)")).toBeTruthy();
  expect(screen.getByRole("link", { name: "AI Pairing Advisor — Coming Soon" }).getAttribute("href"))
    .toBe("/lifestyle/ai-pairing-advisor?from=pricing");
  expect(screen.getByText(/not currently available subscription benefits/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("registers only the read-only page and preserves the existing Drink Pairing route", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");
  const router = read("client/src/components/Router.tsx");
  expect(router).toContain('<Route path="/lifestyle/ai-pairing-advisor" component={DrinkAdvisorComingSoon} />');
  expect(router).toContain('<Route path="/lifestyle/pairings-ai" component={GuardedPairingsAI} />');
  expect(router).toContain("COMING_SOON_ADVISOR_PATH,");
  expect(read("client/src/pages/lifestyle/PairingsHub.tsx")).toContain('route: "/lifestyle/pairings-ai"');
  expect(read("client/src/pages/PricingPage.tsx").match(/<PlannedFeaturesNotice \/>/g)).toHaveLength(2);
  expect(read("client/src/lib/developmentAuthRoutes.ts")).toContain("COMING_SOON_ADVISOR_PATH,");
  expect(read("client/src/components/AppRouter.tsx")).toContain("path === COMING_SOON_ADVISOR_PATH ||");
  expect(read("client/src/components/AppRouter.tsx")).toContain("location !== COMING_SOON_ADVISOR_PATH &&");
});
it("contains no Development-only gates or execution clients in presentation modules", () => {
  for (const path of [
    "client/src/lib/comingSoonRoutes.ts",
    "client/src/pages/lifestyle/DrinkAdvisorComingSoon.tsx",
    "client/src/components/coming-soon/PlannedFeaturesNotice.tsx",
    "client/src/components/coming-soon/ComingSoonPresentation.tsx",
  ]) {
    expect(fs.readFileSync(path, "utf8")).not.toMatch(/import\.meta\.env|developmentComingSoonEnabled|fetch\(|useQuery|useMutation|\/api\//);
  }
});
