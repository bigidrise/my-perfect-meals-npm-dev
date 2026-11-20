/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import i18n from "@/i18n";
import { LANGUAGE_PREFERENCE_KEY, resolveLanguagePreference } from "@/i18n/languagePreference";

let mockCachedUser: any = null;
let mockContext: ReturnType<typeof useAuth>;
const mockLogin = jest.fn();
const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/auth", mockNavigate], useSearch: () => "" }));
jest.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockCachedUser, getAuthHeaders: () => ({}),
  clearAuthToken: jest.fn(), setCachedUser: (user: any) => { mockCachedUser = user; },
  login: (...args: unknown[]) => mockLogin(...args), signUp: jest.fn(), getProCareSignupData: () => null,
}));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false, getGuestSession: () => null }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ DEVELOPMENT_AUTH_PUBLIC_PATHS: [], IS_DEVELOPMENT: true }));
jest.mock("@/demo-studio/runtimeAuthority", () => ({
  assertIsolatedDemoRuntime: () => { throw new Error("Demo runtime is not authorized"); },
}));
jest.mock("@/hooks/nutritionStateCache", () => ({ clearNutritionCache: jest.fn() }));
jest.mock("@/hooks/useEffectiveClinicalProtocols", () => ({ refreshClinicalProtocols: jest.fn() }));
jest.mock("@/lib/professionalOnboarding", () => ({
  professionalRequestsEnabled: false, saveNewAccountProfessionalDraft: jest.fn(),
}));
jest.mock("@/components/MfaChallengeModal", () => ({ MfaChallengeModal: () => null }));
jest.mock("@/components/MfaSetupSection", () => ({ MfaSetupSection: () => null }));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => null }));
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: async () => ({}), shouldShowWorkspaceChooser: () => false,
}));
jest.mock("@/lib/businessPilotEntrance", () => ({ pendingBusinessPilotReturn: () => null }));

function Probe({ greeting = false }: { greeting?: boolean }) {
  mockContext = useAuth();
  const { t } = useConsumerCopy();
  return <>{greeting && !mockContext.loading && <h1>{t("Welcome")}</h1>}
    <span data-testid="state">{mockContext.loading ? "loading" : mockContext.user?.id ?? "anonymous"}</span></>;
}

beforeEach(() => {
  mockCachedUser = null; mockLogin.mockReset(); mockNavigate.mockReset();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/auth");
  global.fetch = jest.fn();
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

test.each([
  ["es", "en-US", "es", "Bienvenido de nuevo"],
  ["en", "es-MX", "en", "Welcome Back"],
  ["auto", "es-MX", "es", "Bienvenido de nuevo"],
  ["auto", "en-US", "en", "Welcome Back"],
])("real login transition keeps %s on %s from its initial frame through profile hydration", async (preference, device, language, heading) => {
  jest.spyOn(navigator, "language", "get").mockReturnValue(device);
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  await i18n.changeLanguage(resolveLanguagePreference(preference));
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
  let deliverProfile!: (response: unknown) => void;
  (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { deliverProfile = resolve; }));
  // The actual login adapter and MFA handoff provide a routing identity without a profile language.
  mockLogin.mockResolvedValue({ id: "synthetic-transition", role: "client" });
  const languages: string[] = [];
  const record = (next: string) => { languages.push(next); };
  i18n.on("languageChanged", record);
  try {
    render(<AuthProvider><Auth /><Probe /></AuthProvider>);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    await screen.findByText("anonymous");
    fireEvent.change(screen.getByLabelText(language === "es" ? "Correo electrónico" : "Email"), { target: { value: "synthetic@example.invalid" } });
    fireEvent.change(screen.getByLabelText(language === "es" ? "Contraseña" : "Password"), { target: { value: "offline-only" } });
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Iniciar sesión" : "Sign In" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    // This is a separately observable render while the existing profile request is unresolved.
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    expect(i18n.language).toBe(language);
    expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
    await act(async () => { deliverProfile({ ok: true, json: async () => ({
      id: "synthetic-transition", role: "client", preferredLanguage: preference,
      onboardingCompletedAt: "2026-01-01",
    }) }); });
    expect(i18n.language).toBe(language);
    expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
    expect(languages.every(next => next === language)).toBe(true);
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect((fetch as jest.Mock).mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  } finally { i18n.off("languageChanged", record); }
});

test.each([
  ["es", "en-US", "es", "Bienvenido"],
  ["en", "es-MX", "en", "Welcome"],
  ["auto", "es-MX", "es", "Bienvenido"],
])("reload with %s on %s never displays an authenticated welcome before profile verification", async (preference, device, language, heading) => {
  jest.spyOn(navigator, "language", "get").mockReturnValue(device);
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  await i18n.changeLanguage(resolveLanguagePreference(preference));
  mockCachedUser = { id: "synthetic-reload" }; // Routing cache deliberately contains no language/profile.
  let deliverProfile!: (response: unknown) => void;
  (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { deliverProfile = resolve; }));
  render(<AuthProvider><Probe greeting /></AuthProvider>);
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
  await act(async () => { deliverProfile({ ok: true, json: async () => ({
    id: "synthetic-reload", preferredLanguage: preference,
  }) }); });
  expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  expect(i18n.language).toBe(language);
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
});

test.each(["en", "auto"])("verified %s overrides a conflicting hint without treating an incomplete identity as Auto", async preference => {
  jest.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "es");
  await i18n.changeLanguage("es");
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
  render(<AuthProvider><Probe greeting /></AuthProvider>);
  await screen.findByText("anonymous");
  await act(async () => { mockContext.setUser({ id: "synthetic-partial" } as any); });
  expect(screen.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("es");
  await act(async () => { mockContext.setUser({ id: "synthetic-partial", preferredLanguage: preference } as any); });
  expect(screen.getByRole("heading", { name: "Welcome" })).toBeVisible();
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
});
