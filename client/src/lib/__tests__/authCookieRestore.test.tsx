/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppRouter from "@/components/AppRouter";
import { clearAuthToken } from "@/lib/auth";

let mockCachedUser: any = null;
let mockDevelopmentPublicPaths: string[] = [];
const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => [window.location.pathname, mockNavigate], Route: () => null }));
jest.mock("@/components/WelcomeGate", () => ({ __esModule: true, default: () => null }));
jest.mock("@/layout/AppLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock("@/layout/BusinessWorkspaceLayout", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockCachedUser,
  getAuthHeaders: () => ({}),
  clearAuthToken: jest.fn(),
  setCachedUser: jest.fn(user => { mockCachedUser = user; }),
}));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn() },
  resolveI18nLang: () => "en",
}));
jest.mock("@/lib/guestMode", () => ({
  isGuestMode: () => false,
  getGuestSession: () => null,
}));
jest.mock("@/hooks/nutritionStateCache", () => ({ clearNutritionCache: jest.fn() }));
jest.mock("@/lib/developmentAuthRoutes", () => ({
  get DEVELOPMENT_AUTH_PUBLIC_PATHS() { return mockDevelopmentPublicPaths; },
}));
// Ordinary-auth fixtures must not import the Vite-only isolated-demo gate.
// Fail loudly if this test ever attempts to enter a demo runtime.
jest.mock("@/demo-studio/runtimeAuthority", () => ({
  assertIsolatedDemoRuntime: () => { throw new Error("Demo activation is outside this auth test"); },
}));

function Identity() {
  const { user, loading, initializationError } = useAuth();
  return <div>{initializationError ? "unavailable" : loading ? "loading" : user ? `${user.id}:${user.operatingStatus ?? "ordinary"}` : "anonymous"}</div>;
}

function VerificationState() {
  const { user, loading } = useAuth();
  return <span data-testid="verification-state">{JSON.stringify({ user: user?.id ?? null, loading })}</span>;
}

beforeEach(() => {
  mockCachedUser = null;
  mockDevelopmentPublicPaths = [];
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("mpm.welcomeGateDone", "true");
  window.history.replaceState({}, "", "/welcome");
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

test("restores cookie-backed identity from server after localStorage is cleared, with one profile request", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ id: "synthetic-cookie-actor", role: "client", professionalRole: "physician", operatingStatus: "demo_only" }),
  });
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("synthetic-cookie-actor:demo_only");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/api/user/profile", expect.objectContaining({ credentials: "include" }));
  expect(mockCachedUser.operatingStatus).toBe("demo_only");
  expect(mockCachedUser.isProCare).not.toBe(true);
});

test("a 401 with no routing cache does not manufacture an authenticated identity", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("anonymous");
  expect(mockCachedUser).toBeNull();
  expect(window.location.pathname).toBe("/welcome");
});

test.each([false, true])("Development pilot entrance stays public after a rejected session (cached=%s)", async cached => {
  mockDevelopmentPublicPaths = ["/activate/business-pilot"];
  window.history.replaceState({}, "", "/activate/business-pilot");
  if (cached) {
    mockCachedUser = { id: "expired-synthetic-member", email: "physician@example.invalid" };
    localStorage.setItem("mpm_auth_token", "expired-synthetic-session");
  }
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<AuthProvider><Identity /></AuthProvider>);
    await screen.findByText("anonymous");
    expect(window.location.pathname).toBe("/activate/business-pilot");
    expect(errors.mock.calls.some(args => args.some(value => String(value).includes("navigation")))).toBe(false);
    expect(localStorage.getItem("mpm_current_user")).toBeNull();
  } finally { errors.mockRestore(); }
});

test("a transient server failure with no cache stays unverified and retryable", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("unavailable");
  expect(mockCachedUser).toBeNull();
});

test("a network restoration failure does not manufacture identity or clear a cookie session", async () => {
  (fetch as jest.Mock).mockRejectedValue(new TypeError("Failed to fetch"));
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("unavailable");
  expect(mockCachedUser).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a 403 remains retryable without treating cached metadata as verified identity", async () => {
  mockCachedUser = { id: "synthetic-existing", email: "synthetic@example.invalid" };
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("unavailable");
  expect(mockCachedUser.id).toBe("synthetic-existing");
  expect(clearAuthToken).not.toHaveBeenCalled();
});

test.each([false, true])("protected restoration fails closed and recovers after retry (cached=%s)", async cached => {
  window.history.replaceState({}, "", "/dashboard");
  if (cached) mockCachedUser = { id: "old-routing-only", email: "routing@example.invalid", entitlements: ["FULL_ACCESS"] };
  (fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "verified-self", email: "self@example.invalid" }) });
  render(<AuthProvider><VerificationState /><AppRouter><div>protected account data</div><Identity /></AppRouter></AuthProvider>);
  await screen.findByRole("button", { name: "Retry session check" });
  // Startup consumers (including native reminder sync) must continue treating
  // an outage as unresolved, never as a verified logout.
  expect(screen.getByTestId("verification-state").textContent).toBe('{"user":null,"loading":true}');
  expect(screen.queryByText("protected account data")).toBeNull();
  expect(screen.queryByText(/old-routing-only/)).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/dashboard");
  expect(clearAuthToken).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
  await screen.findByText("verified-self:ordinary");
  expect(screen.getByText("protected account data")).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("a failed retry remains unavailable without mounting protected data", async () => {
  window.history.replaceState({}, "", "/dashboard");
  (fetch as jest.Mock).mockRejectedValue(new TypeError("network unavailable"));
  render(<AuthProvider><AppRouter><div>protected account data</div></AppRouter></AuthProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Retry session check" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await screen.findByRole("button", { name: "Retry session check" });
  expect(screen.queryByText("protected account data")).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(clearAuthToken).not.toHaveBeenCalled();
});

test("a definitive 401 after retry follows the existing sign-in path", async () => {
  window.history.replaceState({}, "", "/dashboard");
  (fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: false, status: 401 });
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<AuthProvider><AppRouter><div>protected account data</div></AppRouter></AuthProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Retry session check" }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/welcome"));
    expect(clearAuthToken).toHaveBeenCalled();
    expect(screen.queryByText("protected account data")).toBeNull();
  } finally { errors.mockRestore(); }
});

test("the route-level gate does not redirect public sign-in during an outage", async () => {
  window.history.replaceState({}, "", "/auth");
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  render(<AuthProvider><AppRouter><div>public sign-in form</div></AppRouter></AuthProvider>);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(screen.getByText("public sign-in form")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry session check" })).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("cached demo routing metadata is refreshed from server without repeated updates", async () => {
  mockCachedUser = { id: "synthetic-cookie-actor", professionalRole: "physician" };
  (fetch as jest.Mock).mockResolvedValue({
    ok: true, json: async () => ({ ...mockCachedUser, operatingStatus: "demo_only" }),
  });
  const view = render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("synthetic-cookie-actor:demo_only");
  view.rerender(<AuthProvider><Identity /></AuthProvider>);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
});

test("refresh and a new cookie-backed session preserve canonical physician identity without demo metadata", async () => {
  const physician = { id: "fictional-physician", role: "coach", professionalRole: "physician",
    isProCare: true, organizationId: "fictional-owned-organization" };
  (fetch as jest.Mock).mockImplementation(async () => ({ ok: true, json: async () => ({ ...physician }) }));
  for (let session = 0; session < 2; session++) {
    mockCachedUser = null;
    localStorage.clear();
    const view = render(<AuthProvider><Identity /></AuthProvider>);
    await screen.findByText("fictional-physician:ordinary");
    // Organization authority belongs to OrgContext; the auth cache deliberately
    // retains identity fields rather than the legacy organizationId field.
    expect(mockCachedUser).toMatchObject({ id: physician.id, role: "coach", professionalRole: "physician", isProCare: true });
    expect(mockCachedUser.operatingStatus).toBeNull();
    view.unmount();
  }
  expect(fetch).toHaveBeenCalledTimes(2);
});
