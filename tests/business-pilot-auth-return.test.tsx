/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Auth from "../client/src/pages/Auth";
import { captureBusinessPilotInvitation, BUSINESS_PILOT_PATH, BUSINESS_PILOT_TOKEN_KEY } from "../client/src/lib/businessPilotEntrance";

const mockUser = { id: "synthetic-member", email: "physician@example.invalid", accessTier: "FREE" };
let mockSearch = "";
let mockDevelopment = true;
const mockNavigate = jest.fn();
const mockRefresh = jest.fn();
const mockLogin = jest.fn();
const mockSignup = jest.fn();
const mockSetUser = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/auth", mockNavigate], useSearch: () => mockSearch }));
jest.mock("../client/src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, setUser: mockSetUser, refreshUser: mockRefresh }),
}));
jest.mock("../client/src/lib/developmentAuthRoutes", () => ({
  get IS_DEVELOPMENT() { return mockDevelopment; },
}));
jest.mock("../client/src/lib/auth", () => ({
  login: (...args: any[]) => mockLogin(...args),
  signUp: (...args: any[]) => mockSignup(...args),
  getProCareSignupData: () => null, getAuthHeaders: () => ({}),
}));
jest.mock("../client/src/lib/professionalOnboarding", () => ({
  professionalRequestsEnabled: false, saveNewAccountProfessionalDraft: jest.fn(),
}));
jest.mock("../client/src/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => null }));
jest.mock("../client/src/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: jest.fn(async () => ({})), shouldShowWorkspaceChooser: () => false,
}));
jest.mock("../client/src/components/MfaChallengeModal", () => ({
  MfaChallengeModal: ({ onSuccess }: any) => <button onClick={() => onSuccess(mockUser)}>Complete Existing MFA</button>,
}));
jest.mock("../client/src/components/MfaSetupSection", () => ({
  MfaSetupSection: () => <div>MFA enrollment remains required</div>,
}));

beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  mockDevelopment = true;
  window.history.replaceState({}, "", `${BUSINESS_PILOT_PATH}#token=${"b".repeat(64)}`);
  captureBusinessPilotInvitation(sessionStorage, window.location, window.history);
  mockRefresh.mockResolvedValue(mockUser);
  mockLogin.mockResolvedValue(mockUser); mockSignup.mockResolvedValue(mockUser);
});
afterEach(cleanup);

function submit() {
  const view = render(<Auth />);
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: mockUser.email } });
  fireEvent.change(view.container.querySelector('input[type="password"]')!, { target: { value: "Synthetic-test-password!" } });
  fireEvent.submit(view.container.querySelector("form")!);
  return view;
}

test.each(["login", "signup"])("normal %s automatically returns to explicit pilot activation", async mode => {
  mockSearch = `?mode=${mode}&returnTo=%2Factivate%2Fbusiness-pilot`;
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(BUSINESS_PILOT_PATH));
  expect(mode === "login" ? mockLogin : mockSignup).toHaveBeenCalled();
  expect(mode === "login" ? mockSignup : mockLogin).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBe("b".repeat(64));
  expect(mockNavigate).not.toHaveBeenCalledWith("/pricing");
});

test("a same-tab authentication redirect that loses the query still restores the invitation", async () => {
  mockSearch = "?mode=login";
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(BUSINESS_PILOT_PATH));
});

test("MFA completion, not initial password acceptance, returns to activation", async () => {
  mockSearch = "?mode=login&returnTo=%2Factivate%2Fbusiness-pilot";
  mockLogin.mockResolvedValue({ mfaRequired: true });
  submit();
  const button = await screen.findByRole("button", { name: "Complete Existing MFA" });
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(BUSINESS_PILOT_PATH));
});

test("an existing unrelated auth return path is not overwritten by stored pilot navigation", async () => {
  mockSearch = "?mode=login&returnTo=%2Fjoin%2Fstudio";
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/join/studio"));
  expect(mockNavigate).not.toHaveBeenCalledWith(BUSINESS_PILOT_PATH);
});

test("failed credentials retain the invitation without progressing", async () => {
  mockSearch = "?mode=login";
  mockLogin.mockRejectedValue(new Error("Invalid credentials"));
  submit();
  await screen.findByText("Invalid credentials");
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBe("b".repeat(64));
});

test("Production normal signup is not redirected by Development pilot navigation", async () => {
  mockDevelopment = false;
  mockSearch = "?mode=signup";
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/consumer-welcome"));
  expect(mockNavigate).not.toHaveBeenCalledWith(BUSINESS_PILOT_PATH);
});
