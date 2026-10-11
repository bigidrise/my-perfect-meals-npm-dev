/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

let mockCachedUser: any = null;
let mockDevelopmentPublicPaths: string[] = [];
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

function Identity() {
  const { user, loading } = useAuth();
  return <div>{loading ? "loading" : user ? `${user.id}:${user.operatingStatus ?? "ordinary"}` : "anonymous"}</div>;
}

beforeEach(() => {
  mockCachedUser = null;
  mockDevelopmentPublicPaths = [];
  localStorage.clear();
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

test("a transient server failure with no cache stays anonymous", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  render(<AuthProvider><Identity /></AuthProvider>);
  await screen.findByText("anonymous");
  expect(mockCachedUser).toBeNull();
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
