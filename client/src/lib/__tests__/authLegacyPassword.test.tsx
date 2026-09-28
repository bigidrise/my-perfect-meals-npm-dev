/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Auth from "@/pages/Auth";
import { login, signUp } from "@/lib/auth";

jest.mock("wouter", () => ({
  useLocation: () => [window.location.pathname, jest.fn()],
  useSearch: () => window.location.search,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, setUser: jest.fn(), refreshUser: jest.fn() }),
}));
jest.mock("@/lib/auth", () => ({
  login: jest.fn(),
  signUp: jest.fn(),
  getProCareSignupData: jest.fn(() => null),
  getAuthHeaders: jest.fn(() => ({})),
}));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => null }));
jest.mock("@/components/MfaChallengeModal", () => ({ MfaChallengeModal: () => null }));
jest.mock("@/components/MfaSetupSection", () => ({ MfaSetupSection: () => null }));
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: jest.fn(),
  shouldShowWorkspaceChooser: jest.fn(() => false),
}));
jest.mock("@/lib/subscriptionCheck", () => ({
  hasActivePaidSubscription: jest.fn(() => false),
  isProOrAbove: jest.fn(() => false),
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/auth");
  (login as jest.Mock).mockRejectedValue(new Error("Invalid credentials"));
});

it("submits a previously valid short password from Sign In without changing the password", async () => {
  render(<Auth />);
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "legacy@example.test" } });
  const password = screen.getByPlaceholderText("Password") as HTMLInputElement;
  fireEvent.change(password, { target: { value: "OldPass7!" } });
  expect(password.minLength).toBe(-1);
  expect(password.checkValidity()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() => expect(login).toHaveBeenCalledWith("legacy@example.test", "OldPass7!"));
  expect(signUp).not.toHaveBeenCalled();
});

it("keeps the 12-character minimum when creating an account", () => {
  window.history.replaceState({}, "", "/auth?mode=signup");
  render(<Auth />);
  const password = screen.getByPlaceholderText("Password") as HTMLInputElement;
  fireEvent.change(password, { target: { value: "OldPass7!" } });
  expect(password.minLength).toBe(12);
  expect(password.getAttribute("minlength")).toBe("12");
  expect(signUp).not.toHaveBeenCalled();
});