import React from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import fs from "node:fs";

let mockDevelopment = true;
let mockDesktop = false;
jest.mock("@/lib/developmentComingSoon", () => ({
  get developmentComingSoonEnabled() { return mockDevelopment; },
}));
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
  mockDevelopment = true; mockDesktop = false;
  window.history.replaceState({}, "", "/lifestyle/ai-pairing-advisor");
});
afterEach(cleanup);

it("renders the exact advisor description and branded mobile header without account/AI calls", () => {
  const { container } = render(<Advisor />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AI Pairing Advisor — Coming Soon.");
  expect(container.textContent).toContain("A more conversational way to explore drink pairings, preferences, and food combinations is on the way.");
  expect(screen.getByText("My Perfect Meals")).toBeTruthy();
  expect(screen.getByLabelText("AI Pairing Advisor page header")).toBeTruthy();
  expect(useAuth).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled();
});
it("reuses Pregnancy spacing with one inset and a non-header mobile element", () => {
  const props = {
    title: "Coming Soon", description: "Future", headerLabel: "Feature",
    backHref: "/lifestyle", backLabel: "Back", testId: "sample",
  };
  expect(Presentation(props).props.style.paddingTop).toBe("env(safe-area-inset-top, 0px)");
  const { container } = render(<Presentation {...props} />);
  expect(container.querySelector("header")).toBeNull();
  // JSDOM discards env() values; check the actual browser-bound React tree.
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
])("back from %s uses internal routing to the correct parent", (path, label, target) => {
  window.history.replaceState({}, "", path);
  const push = jest.spyOn(window.history, "pushState");
  render(<Advisor />);
  const link = screen.getByRole("link", { name: label });
  expect(link.getAttribute("href")).toBe(target);
  expect(fireEvent.click(link, { button: 0 })).toBe(false);
  expect(window.location.pathname).toBe(target);
  expect(push).toHaveBeenCalled(); push.mockRestore();
});
it("Pregnancy's Development presentation retains its safety pause message and internal Back", () => {
  const { container } = render(<Pregnancy />);
  expect(screen.getByText("My Perfect Meals")).toBeTruthy();
  expect(container.textContent).toContain("Existing Pregnancy settings are preserved");
  expect(container.textContent).toContain("not pregnancy-adjusted");
  expect(container.querySelector("header")).toBeNull();
  expect(screen.getByRole("link", { name: "Back to Lifestyle" }).getAttribute("href")).toBe("/lifestyle");
  expect(useAuth).not.toHaveBeenCalled();
});
it("both existing web and iOS Pregnancy pricing labels already say Coming Soon", () => {
  const web = getDisplayFeaturesForTier("ultimate").find(label => label.includes("My Perfect Pregnancy"));
  const ios = IOS_DISPLAY_FEATURES.ultimate.find(label => label.includes("My Perfect Pregnancy"));
  expect(web).toContain("Coming Soon (Clinical)");
  expect(ios).toContain("Coming Soon (Clinical)");
});
it("planned features are not presented as purchasable/current benefits", () => {
  render(<Notice />);
  expect(screen.getByRole("heading").textContent).toContain("not available yet");
  expect(screen.getByText("My Perfect Pregnancy — Coming Soon (Clinical)")).toBeTruthy();
  const link = screen.getByRole("link", { name: "AI Pairing Advisor — Coming Soon" });
  expect(link.getAttribute("href")).toBe("/lifestyle/ai-pairing-advisor?from=pricing");
  expect(screen.getByText(/not currently available subscription benefits/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("Production shows only the approved informational advisor page, without exposing the subscription notice", () => {
  mockDevelopment = false;
  const { container } = render(<><Advisor /><Notice /></>);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AI Pairing Advisor — Coming Soon.");
  expect(screen.getByRole("link", { name: "Back to Drink Intelligence" }).getAttribute("href")).toBe("/lifestyle/pairings-hub");
  expect(container.textContent).not.toContain("not available yet");
  expect(useAuth).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).toBeNull();
});
it("the advisor route and glass hub entry are Production-visible while existing pairing tools and other Coming Soon gates stay intact", () => {
  const router = fs.readFileSync("client/src/components/Router.tsx", "utf8");
  expect(router).toContain('<Route path="/lifestyle/ai-pairing-advisor" component={DrinkAdvisorComingSoon} />');
  expect(router).not.toContain("developmentComingSoonEnabled");
  expect(router).toContain('<Route path="/lifestyle/pairings-ai" component={GuardedPairingsAI} />');
  const hub = fs.readFileSync("client/src/pages/lifestyle/PairingsHub.tsx", "utf8");
  expect(hub).toContain('route: "/lifestyle/pairings-ai"');
  expect(hub).toContain('route: "/lifestyle/wine-list-helper"');
  expect(hub).toContain('route: "/lifestyle/reduce-drinking-plan"');
  expect(hub).not.toContain("developmentComingSoonEnabled");
  const advisorLink = hub.match(/<Link[\s\S]*?data-testid="pairingshub-advisor-coming-soon"/)?.[0];
  expect(advisorLink).toContain('href="/lifestyle/ai-pairing-advisor"');
  for (const style of ["bg-black/10", "backdrop-blur-lg", "border-white/10", "rounded-xl", "shadow-md"]) {
    expect(advisorLink).toContain(style);
  }
  const pricing = fs.readFileSync("client/src/pages/PricingPage.tsx", "utf8");
  expect(pricing.match(/<PlannedFeaturesNotice \/>/g)).toHaveLength(2);
  const gate = fs.readFileSync("client/src/lib/developmentComingSoon.ts", "utf8");
  expect(gate).toContain("import.meta.env.DEV && !import.meta.env.PROD");
  const publicRoutes = fs.readFileSync("client/src/lib/developmentAuthRoutes.ts", "utf8");
  expect(publicRoutes).toContain('"/lifestyle/ai-pairing-advisor"');
  const appRouter = fs.readFileSync("client/src/components/AppRouter.tsx", "utf8");
  expect(appRouter).toContain('path === "/lifestyle/ai-pairing-advisor"');
  expect(appRouter).toContain('location !== "/lifestyle/ai-pairing-advisor"');
  expect(appRouter).not.toContain("developmentComingSoonEnabled");
  const auth = fs.readFileSync("client/src/contexts/AuthContext.tsx", "utf8");
  expect(auth).toContain('window.location.pathname !== "/lifestyle/ai-pairing-advisor"');
  expect(auth).toContain('"/lifestyle/ai-pairing-advisor",\n          ...DEVELOPMENT_AUTH_PUBLIC_PATHS');
});
