/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AuthProvider, IsolatedDemoAuthProvider, useAuth } from "@/contexts/AuthContext";
import { getCurrentUser, setCachedUser } from "@/lib/auth";
import { assertIsolatedDemoRuntime } from "../runtimeAuthority";
import { freshDemo } from "../state";
import StudioControls from "../StudioControls";

jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(), getAuthHeaders: () => ({}),
  clearAuthToken: jest.fn(), setCachedUser: jest.fn(),
}));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/i18n", () => ({
  __esModule: true, default: { language: "en", changeLanguage: jest.fn() },
  resolveI18nLang: () => "en",
}));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false, getGuestSession: () => null }));
jest.mock("@/lib/sentry", () => ({ setUserContext: jest.fn(), clearUserContext: jest.fn() }));
jest.mock("@/hooks/nutritionStateCache", () => ({ clearNutritionCache: jest.fn() }));
jest.mock("@/lib/publicRoutePolicy", () => ({ isExactPublicMarketingRoute: () => false }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ DEVELOPMENT_AUTH_PUBLIC_PATHS: [] }));
jest.mock("../runtimeAuthority", () => ({ assertIsolatedDemoRuntime: jest.fn() }));

describe("normal and synthetic authentication providers stay separate", () => {
  let root: Root;
  let container: HTMLDivElement;
  let auth: ReturnType<typeof useAuth>;
  const normalUser = { id: "fixture-live-user", email: "fixture@live.invalid", role: "client" };
  function Consumer() { auth = useAuth(); return <span>{auth.user?.id ?? "signed-out"}</span>; }
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, "", "/dashboard");
    container = document.createElement("div"); document.body.append(container);
    root = createRoot(container);
    (getCurrentUser as jest.Mock).mockReturnValue(normalUser);
    window.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => normalUser });
    (assertIsolatedDemoRuntime as jest.Mock).mockImplementation(() => {
      throw new Error("Synthetic identity is restricted to the isolated Development Demo Studio");
    });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it("restores and verifies a normal user through the existing live provider", async () => {
    await act(async () => root.render(<AuthProvider><Consumer /></AuthProvider>));
    expect(auth!.user?.id).toBe(normalUser.id);
    expect(window.fetch).toHaveBeenCalledWith("/api/user/profile", expect.objectContaining({ credentials: "include" }));
    expect(assertIsolatedDemoRuntime).not.toHaveBeenCalled();
    expect(setCachedUser).toHaveBeenCalled();
  });
  it("does not accept a synthetic provider outside the explicitly approved runtime", () => {
    const user = freshDemo().user;
    expect(() => IsolatedDemoAuthProvider({
      user, onChange: jest.fn(), readUser: () => user, children: null,
    })).toThrow("isolated Development Demo Studio");
    expect(window.fetch).not.toHaveBeenCalled();
  });
  it("supplies current synthetic state without invoking live auth, profile reads, or caches", async () => {
    (assertIsolatedDemoRuntime as jest.Mock).mockImplementation(() => undefined);
    const user = freshDemo().user;
    const latest = { ...user, firstName: "Morgan" };
    await act(async () => root.render(<IsolatedDemoAuthProvider user={user}
      onChange={jest.fn()} readUser={() => latest}><Consumer /></IsolatedDemoAuthProvider>));
    expect(auth!.user?.id).toBe("demo-studio-user");
    expect((await auth!.refreshUser())?.firstName).toBe("Morgan");
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(setCachedUser).not.toHaveBeenCalled();
    expect(window.fetch).not.toHaveBeenCalled();
  });
  it("keeps a blocked-navigation explanation visible after returning to the chooser", async () => {
    await act(async () => root.render(<StudioControls workflow={null} name="Demo User" calories={0}
      onNavigate={jest.fn()} onStartFresh={jest.fn()} onResetCurrent={jest.fn()}
      onResetAll={jest.fn()} onReturn={jest.fn()}
      blockedRequests={["Navigation outside Phase 1: /planner"]} />));
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("It was blocked; no live fallback was used.");
    expect(alert?.textContent).toContain("/planner");
  });
});
