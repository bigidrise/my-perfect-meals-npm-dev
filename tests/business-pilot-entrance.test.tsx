/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BusinessPilotActivation from "../client/src/pages/BusinessPilotActivation";
import AppRouter from "../client/src/components/AppRouter";
import {
  BUSINESS_PILOT_TOKEN_KEY, BUSINESS_PILOT_PATH, captureBusinessPilotInvitation,
  pendingBusinessPilotReturn, isBusinessPilotOrganizationEntry, startBusinessPilotOrganizationEntry,
} from "../client/src/lib/businessPilotEntrance";

let mockUser: any;
let mockDevelopment = true;
const mockNavigate = jest.fn();
const mockRefresh = jest.fn();
jest.mock("../client/src/lib/developmentAuthRoutes", () => ({
  get IS_DEVELOPMENT() { return mockDevelopment; },
}));
jest.mock("../client/src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, loading: false, refreshUser: mockRefresh }),
}));
jest.mock("../client/src/lib/auth", () => ({ getAuthHeaders: () => ({ Authorization: "Bearer synthetic-session" }) }));
jest.mock("wouter", () => ({ useLocation: () => [BUSINESS_PILOT_PATH, mockNavigate], Route: () => null }));
jest.mock("../client/src/components/WelcomeGate", () => ({ __esModule: true, default: () => <div>Unexpected welcome interruption</div> }));
jest.mock("../client/src/layout/AppLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock("../client/src/layout/BusinessWorkspaceLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock("../client/src/lib/guestMode", () => ({ isGuestMode: () => false, isGuestAllowedRoute: () => false }));
jest.mock("../client/src/lib/publicRoutePolicy", () => ({ isExactPublicMarketingRoute: () => false }));
jest.mock("../client/src/lib/subscriptionCheck", () => ({
  hasActivePaidSubscription: () => !!mockUser?.accessTier,
}));
const token = "a".repeat(64); // Synthetic only; never issued.
const fetchMock = jest.fn();
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  window.history.replaceState({}, "", `${BUSINESS_PILOT_PATH}#token=${token}`);
  mockUser = null; mockDevelopment = true;
  mockNavigate.mockReset(); mockRefresh.mockReset(); fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(cleanup);
const response = (data: any, ok = true) => Promise.resolve({ ok, json: async () => data });

test("anonymous invitation is public in Development and neither preview nor activation runs", () => {
  render(<AppRouter><BusinessPilotActivation /></AppRouter>);
  expect(screen.getByRole("button", { name: "Create an Account" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Sign In to My Existing Account" })).toBeEnabled();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBe(token);
});

test.each([
  ["Create an Account", "signup"], ["Sign In to My Existing Account", "login"],
])("one invitation enters normal auth via %s", (label, mode) => {
  render(<BusinessPilotActivation />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(mockNavigate).toHaveBeenCalledWith(`/auth?mode=${mode}&returnTo=%2Factivate%2Fbusiness-pilot`);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBe(token);
});

test.each(["existing-member", "new-member"])("%s explicitly activates the same pilot after auth", async id => {
  mockUser = { id, email: "physician@example.invalid" };
  mockRefresh.mockResolvedValue(mockUser);
  fetchMock.mockImplementation((url: string) => response(url.endsWith("/inspect")
    ? { available: true }
    : { endsAt: "2099-11-01T12:00:00Z", alreadyActivated: id === "existing-member" }));
  render(<AppRouter><BusinessPilotActivation /></AppRouter>);
  const button = await screen.findByRole("button", { name: "Activate My Complimentary Pilot" });
  await waitFor(() => expect(button).toBeEnabled());
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/claim"))).toHaveLength(0);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer synthetic-session");
  fireEvent.click(button);
  const organization = await screen.findByRole("button", { name: "More → Start Your Organization" });
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/claim"))).toHaveLength(1);
  expect(JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith("/claim"))[1].body)).toEqual({ token });
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBeNull();
  expect(pendingBusinessPilotReturn(sessionStorage, true, null)).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalledWith("/onboarding");
  fireEvent.click(organization);
  expect(mockNavigate).toHaveBeenCalledWith("/more");
  expect(isBusinessPilotOrganizationEntry(sessionStorage, true, "/more", id)).toBe(true);
  expect(isBusinessPilotOrganizationEntry(sessionStorage, true, "/more", "another-account")).toBe(false);
  expect(isBusinessPilotOrganizationEntry(sessionStorage, false, "/more", id)).toBe(false);
});

test.each([
  ["existing-member", "wrong email", "Sign in with the email that received this invitation."],
  ["new-member", "wrong email", "Sign in with the email that received this invitation."],
  ["existing-member", "expired link", "Invitation expired."],
  ["new-member", "expired link", "Invitation expired."],
])("%s %s claim failure preserves the invitation and grants no destination", async (id, _, error) => {
  mockUser = { id, email: "other@example.invalid" };
  fetchMock.mockImplementation((url: string) => url.endsWith("/inspect")
    ? response({ available: true }) : response({ error }, false));
  render(<BusinessPilotActivation />);
  const button = screen.getByRole("button", { name: "Activate My Complimentary Pilot" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(error);
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBe(token);
  expect(screen.queryByRole("button", { name: "More → Start Your Organization" })).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("an expired preview is explained and cannot submit activation", async () => {
  mockUser = { id: "new-member", email: "physician@example.invalid" };
  fetchMock.mockResolvedValue(await response({ available: false, activated: false }));
  render(<BusinessPilotActivation />);
  expect(await screen.findByRole("alert")).toHaveTextContent("expired or no longer available");
  expect(screen.getByRole("button", { name: "Activate My Complimentary Pilot" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("an already-redeemed pilot that ended cannot display renewed access", async () => {
  mockUser = { id: "existing-member", email: "physician@example.invalid" };
  fetchMock.mockImplementation((url: string) => response(url.endsWith("/inspect")
    ? { activated: true } : { endsAt: "2000-01-01T00:00:00Z", alreadyActivated: true }));
  render(<BusinessPilotActivation />);
  const button = screen.getByRole("button", { name: "Activate My Complimentary Pilot" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("original expiration is unchanged");
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "More → Start Your Organization" })).not.toBeInTheDocument();
});

test("pending invitation survives auth redirects without replacing another explicit destination", () => {
  captureBusinessPilotInvitation(sessionStorage, window.location, window.history);
  expect(pendingBusinessPilotReturn(sessionStorage, true, null)).toBe(BUSINESS_PILOT_PATH);
  expect(pendingBusinessPilotReturn(sessionStorage, true, BUSINESS_PILOT_PATH)).toBe(BUSINESS_PILOT_PATH);
  expect(pendingBusinessPilotReturn(sessionStorage, true, "/join/studio")).toBeNull();
  expect(pendingBusinessPilotReturn(sessionStorage, false, null)).toBeNull();
});

test("malformed token does not reuse a previous invitation", () => {
  sessionStorage.setItem(BUSINESS_PILOT_TOKEN_KEY, token);
  window.history.replaceState({}, "", `${BUSINESS_PILOT_PATH}#token=invalid`);
  expect(() => captureBusinessPilotInvitation(sessionStorage, window.location, window.history)).toThrow("invalid");
  expect(sessionStorage.getItem(BUSINESS_PILOT_TOKEN_KEY)).toBeNull();
  expect(window.location.hash).toBe("");
});

test("the More continuation expires and never bypasses another page or account", () => {
  startBusinessPilotOrganizationEntry(sessionStorage, "existing-member");
  expect(isBusinessPilotOrganizationEntry(sessionStorage, true, "/more", "existing-member")).toBe(true);
  expect(isBusinessPilotOrganizationEntry(sessionStorage, true, "/academy", "existing-member")).toBe(false);
  const clock = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 3 * 60 * 60 * 1000);
  try {
    expect(isBusinessPilotOrganizationEntry(sessionStorage, true, "/more", "existing-member")).toBe(false);
  } finally { clock.mockRestore(); }
});

test("Production still selects the existing activation implementation and outer auth guard", async () => {
  mockDevelopment = false;
  fetchMock.mockResolvedValue(await response({ available: true }));
  render(<AppRouter><BusinessPilotActivation /></AppRouter>);
  expect(screen.queryByRole("button", { name: "Create an Account" })).not.toBeInTheDocument();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/welcome"));
});
