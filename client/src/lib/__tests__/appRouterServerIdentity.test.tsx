/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import AppRouter from "@/components/AppRouter";

let mockAuth: any;
let mockLocation = "/care-team";
const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => [mockLocation, mockNavigate], Route: () => null }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: false }));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false, isGuestAllowedRoute: () => false }));
jest.mock("@/components/WelcomeGate", () => ({ __esModule: true, default: () => null }));
jest.mock("@/layout/AppLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock("@/layout/BusinessWorkspaceLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockNavigate.mockClear();
  mockLocation = "/care-team";
});

test("private navigation waits for server auth even with no localStorage authentication flag", () => {
  mockAuth = { user: null, loading: true };
  const view = render(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(view.queryByText("protected")).toBeNull();
  mockAuth = { user: { id: "synthetic-cookie-actor", professionalRole: "physician" }, loading: false };
  view.rerender(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(view.queryByText("protected")).not.toBeNull();
});

test("a resolved cookie-backed professional is not sent to Welcome after cache clearing", () => {
  mockAuth = { user: { id: "synthetic-cookie-actor", professionalRole: "physician" }, loading: false };
  render(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("a forged localStorage flag cannot substitute for a resolved identity", () => {
  localStorage.setItem("isAuthenticated", "true");
  mockAuth = { user: null, loading: false };
  render(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).toHaveBeenCalledWith("/welcome");
});

test("completed setup in a minimized server profile reaches the dashboard after sign-in without local settings", () => {
  mockLocation = "/";
  sessionStorage.setItem("mpm.welcomeGateDone", "true");
  mockAuth = {
    user: {
      id: "synthetic-completed-actor",
      planLookupKey: "mpm_clinical_monthly",
      accessTier: "PAID_FULL",
      onboardingCompletedAt: "2026-10-01T12:00:00.000Z",
      hasSavedMacroProfile: true,
      operatingStatus: "demo_only",
    },
    loading: false,
  };
  render(<AppRouter><div>protected</div></AppRouter>);
  expect(localStorage.getItem("macro_calculator_settings")).toBeNull();
  expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  expect(mockNavigate).not.toHaveBeenCalledWith("/onboarding");
  expect(mockNavigate).not.toHaveBeenCalledWith("/macro-counter");
});

test("an unfinished macro profile is still sent to the calculator rather than fabricating completion", () => {
  mockLocation = "/";
  sessionStorage.setItem("mpm.welcomeGateDone", "true");
  mockAuth = {
    user: { id: "synthetic-incomplete-actor", onboardingCompletedAt: "2026-10-01T12:00:00.000Z", hasSavedMacroProfile: false },
    loading: false,
  };
  render(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).toHaveBeenCalledWith("/macro-counter");
  expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
});

test("a saved macro profile does not bypass genuinely unfinished onboarding", () => {
  mockLocation = "/";
  mockAuth = {
    user: { id: "synthetic-unfinished-actor", accessTier: "PAID_FULL", onboardingCompletedAt: null, hasSavedMacroProfile: true },
    loading: false,
  };
  render(<AppRouter><div>protected</div></AppRouter>);
  expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
  expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard");
});
