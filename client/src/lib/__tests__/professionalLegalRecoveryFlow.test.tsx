/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Auth from "@/pages/Auth";
import ProfessionalLegalModal from "@/components/pro/ProfessionalLegalModal";
import { readProfessionalLegalRecovery, createProfessionalLegalRecoveryUrl } from "@/lib/professionalLegalRecovery";

let mockUser: any;
let mockSearch = "";
const mockNavigate = jest.fn(), mockLogin = jest.fn(), mockSignup = jest.fn(), mockDraft = jest.fn();
const mockLegal = jest.fn(), mockRefresh = jest.fn(), mockSetUser = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/auth", mockNavigate], useSearch: () => mockSearch }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, setUser: mockSetUser, refreshUser: mockRefresh }) }));
jest.mock("@/lib/auth", () => ({
  login: (...args: any[]) => mockLogin(...args), signUp: (...args: any[]) => mockSignup(...args),
  getAuthHeaders: () => ({}), getProCareSignupData: () => ({ professionalRole: "trainer", professionalCategory: "certified", credentialNumber: "SYNTHETIC", credentialBody: "Fixture Board" }),
}));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => mockLegal(...args) }));
jest.mock("@/lib/professionalOnboarding", () => ({ professionalRequestsEnabled: true, saveNewAccountProfessionalDraft: (...args: any[]) => mockDraft(...args) }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: true }));
jest.mock("@/i18n/useConsumerCopy", () => ({ useConsumerCopy: () => ({ t: (key: string) => key }) }));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => <div>Fixture chooser</div> }));
jest.mock("@/components/MfaChallengeModal", () => ({ MfaChallengeModal: () => null }));
jest.mock("@/components/MfaSetupSection", () => ({ MfaSetupSection: () => null }));
jest.mock("@/lib/workspaceAvailability", () => ({ fetchWorkspaceAvailability: jest.fn(), shouldShowWorkspaceChooser: () => false }));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockSearch = "?returnTo=/care-team/trainer";
  mockUser = { id: "synthetic-a", email: "synthetic@example.invalid", isProCare: true, professionalRole: "trainer", onboardingCompletedAt: "fixture" };
  mockLogin.mockResolvedValue(mockUser); mockRefresh.mockImplementation(async () => mockUser);
  mockLegal.mockResolvedValue({ allAccepted: true });
  global.fetch = jest.fn().mockRejectedValue(new Error("Unexpected network request"));
});
afterEach(cleanup);
async function submitAuth(label = "Sign In") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Synthetic-only-passphrase" } });
  fireEvent.submit(screen.getByRole("button", { name: label }).closest("form")!);
}
test.each(["trainer", "physician"])("login intercepts %s with missing legal records and preserves its destination", async role => {
  mockUser.professionalRole = role; mockLegal.mockResolvedValue({ allAccepted: false });
  render(<Auth />); await submitAuth();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  const recovery = new URL(mockNavigate.mock.calls[0][0], "https://fixture.invalid");
  expect(recovery.searchParams.get("legalOnly")).toBe("true");
  expect(recovery.searchParams.get("returnTo")).toBe("/care-team/trainer");
  expect(mockLegal).toHaveBeenCalledWith(`/api/legal/status?flow=${role === "physician" ? "physician" : "professional"}`);
});
test("a legal-status outage does not grant workspace navigation or destroy authentication", async () => {
  mockLegal.mockRejectedValue(new Error("Fixture legal status unavailable"));
  render(<Auth />); await submitAuth();
  await screen.findByText("Fixture legal status unavailable");
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockSetUser).toHaveBeenCalledWith(mockUser);
});
test("current agreements preserve the original professional return path", async () => {
  render(<Auth />); await submitAuth();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/care-team/trainer"));
});
test("new professional signup preserves the collected identity draft without activating access", async () => {
  mockSearch = "?procare=true"; mockUser = { id: "synthetic-new", isProCare: false };
  mockSignup.mockResolvedValue(mockUser);
  render(<Auth />); await submitAuth("Create Account");
  await waitFor(() => expect(mockDraft).toHaveBeenCalledWith("synthetic-new", expect.objectContaining({ requestedRole: "trainer", credentialNumber: "SYNTHETIC", credentialBody: "Fixture Board" })));
  expect(mockLegal).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/procare-attestation");
});
test("modal shows versions, requires every explicit checkbox, and binds writes to the signed-in account", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true });
  const accepted = jest.fn(); const view = render(<ProfessionalLegalModal open onAccepted={accepted} />);
  expect(screen.getAllByText("v1")).toHaveLength(3);
  const save = screen.getByRole("button", { name: "Accept All & Continue" });
  expect(save).toBeDisabled(); expect(fetch).not.toHaveBeenCalled();
  for (const checkbox of screen.getAllByRole("button", { name: "I have read and agree to this document" })) fireEvent.click(checkbox);
  fireEvent.click(save);
  await waitFor(() => expect(accepted).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledTimes(3);
  for (const [, options] of (fetch as jest.Mock).mock.calls) expect(JSON.parse(options.body)).toMatchObject({ version: 1, expectedUserId: "synthetic-a" });
  view.rerender(<ProfessionalLegalModal open={false} onAccepted={accepted} />);
  view.rerender(<ProfessionalLegalModal open onAccepted={accepted} />);
  expect(screen.getByRole("button", { name: "Accept All & Continue" })).toBeDisabled();
});
test("account switches reset consent and recovery storage cannot transfer between accounts", () => {
  createProfessionalLegalRecoveryUrl("/care-team/trainer", "client-invite", "synthetic-a");
  expect(readProfessionalLegalRecovery("", "synthetic-b")).toBeNull();
  expect(readProfessionalLegalRecovery("", "synthetic-a")?.returnTo).toBe("/care-team/trainer");
  const view = render(<ProfessionalLegalModal open onAccepted={jest.fn()} />);
  for (const checkbox of screen.getAllByRole("button", { name: "I have read and agree to this document" })) fireEvent.click(checkbox);
  mockUser = { ...mockUser, id: "synthetic-b" };
  view.rerender(<ProfessionalLegalModal open onAccepted={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Accept All & Continue" })).toBeDisabled();
});
