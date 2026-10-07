/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import AppRouter from "@/components/AppRouter";

let mockAuth: any;
const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/care-team", mockNavigate], Route: () => null }));
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
