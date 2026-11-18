/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import { login } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { translateBasicValidation } from "@/i18n/sharedLabels";
import WelcomeGate from "@/components/WelcomeGate";
import { TipsBanner } from "@/components/TipsBanner";
import { GettingStartedCardView } from "@/components/dashboard/GettingStartedCardView";

const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/auth", mockNavigate], useSearch: () => "" }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, setUser: jest.fn(), refreshUser: jest.fn() }),
}));
jest.mock("@/lib/auth", () => ({
  login: jest.fn(), signUp: jest.fn(), getProCareSignupData: () => null, getAuthHeaders: () => ({}),
  setAuthToken: jest.fn(),
}));
jest.mock("@/lib/queryClient", () => ({ apiRequest: jest.fn() }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: true }));
jest.mock("@/lib/professionalOnboarding", () => ({
  professionalRequestsEnabled: false, saveNewAccountProfessionalDraft: jest.fn(),
}));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => null }));
jest.mock("@/components/MfaChallengeModal", () => ({ MfaChallengeModal: () => null }));
jest.mock("@/components/MfaSetupSection", () => ({ MfaSetupSection: () => null }));
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: jest.fn(), shouldShowWorkspaceChooser: () => false,
}));
jest.mock("@/lib/businessPilotEntrance", () => ({ pendingBusinessPilotReturn: () => null }));

function wrap(element: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })}>{element}</QueryClientProvider>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/auth");
  await i18n.changeLanguage("es");
});

test.each(["es-ES", "es-MX"])("fresh %s devices initialize Spanish before any account or hint", device => {
  const getter = jest.spyOn(navigator, "language", "get").mockReturnValue(device);
  jest.isolateModules(() => {
    const fresh = require("@/i18n").default;
    expect(fresh.language).toBe("es");
    expect(fresh.t("Welcome Back", { ns: "consumerJourney", keySeparator: false })).toBe("Bienvenido de nuevo");
  });
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBeNull();
  getter.mockRestore();
});

test("fresh English fallback and explicit English still initialize English", () => {
  const getter = jest.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  jest.isolateModules(() => expect(require("@/i18n").default.language).toBe("en"));
  getter.mockReturnValue("es-MX");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "en");
  jest.isolateModules(() => expect(require("@/i18n").default.language).toBe("en"));
  getter.mockRestore();
});

test("public login and registration controls are Spanish before any server write", async () => {
  render(<Auth />);
  expect(screen.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Correo electrónico")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Contraseña")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  expect(login).not.toHaveBeenCalled();
  expect(apiRequest).not.toHaveBeenCalled();
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByRole("heading", { name: "Create Your Account" })).toBeInTheDocument();
});

test("login errors are translated only for display; credentials and retry logic stay intact", async () => {
  (login as jest.Mock).mockRejectedValue(new Error("Invalid email or password"));
  render(<Auth />);
  fireEvent.change(screen.getByPlaceholderText("Correo electrónico"), { target: { value: "fixture@example.invalid" } });
  fireEvent.change(screen.getByPlaceholderText("Contraseña"), { target: { value: "synthetic-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(await screen.findByText("Correo electrónico o contraseña incorrectos")).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith("fixture@example.invalid", "synthetic-only");
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("password recovery preserves the existing request and privacy-limited acknowledgement", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({ ok: true });
  wrap(<ForgotPassword />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "fixture@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
  expect(await screen.findByRole("heading", { name: "Revisa tu correo electrónico" })).toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith("/api/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email: "fixture@example.invalid" }),
  });
  expect(screen.getByText(/Si ese correo electrónico existe/)).toBeInTheDocument();
});

test("invalid reset links stay on the same safe recovery path in Spanish", () => {
  wrap(<ResetPassword />);
  expect(screen.getByRole("heading", { name: "Enlace de restablecimiento no válido" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar otro enlace" }));
  expect(mockNavigate).toHaveBeenCalledWith("/forgot-password");
  expect(apiRequest).not.toHaveBeenCalled();
});

test("only the verified recovery validation phrases are translated without changing thresholds", () => {
  expect(translateBasicValidation("Password must be at least 6 characters", i18n.t.bind(i18n))).toContain("6 caracteres");
  expect(translateBasicValidation("Passwords don't match", i18n.t.bind(i18n))).toBe("Las contraseñas no coinciden");
  expect(translateBasicValidation("Keep sodium below 1500 mg", i18n.t.bind(i18n))).toBe("Keep sodium below 1500 mg");
});

test("the additive EN/ES namespace has parity and other languages use normal English fallback", async () => {
  expect(Object.keys(consumerSpanish).sort()).toEqual(Object.keys(consumerEnglish).sort());
  for (const [key, value] of Object.entries(consumerSpanish)) {
    expect(value.trim()).not.toBe("");
    expect(consumerEnglish[key]).toBe(key);
    // Spanish may reorder variables grammatically; retain exact names and multiplicities.
    expect((value.match(/\{\{[^}]+\}\}/g) ?? []).sort()).toEqual((key.match(/\{\{[^}]+\}\}/g) ?? []).sort());
  }
  function Example() {
    const { t } = useConsumerCopy("dashboard");
    return <><span>{t("Welcome Back")}</span><span>{t("unmapped: literal error")}</span></>;
  }
  render(<Example />);
  expect(screen.getByText("Bienvenido de nuevo")).toBeInTheDocument();
  expect(screen.getByText("unmapped: literal error")).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("fr"); });
  await waitFor(() => expect(screen.getByText("Welcome Back")).toBeInTheDocument());
});

test("the dashboard entrance is Spanish without changing the user's selected coaching mode", () => {
  jest.useFakeTimers();
  const complete = jest.fn();
  try {
    render(<WelcomeGate onComplete={complete} />);
    expect(screen.getByRole("heading", { name: "Elige cómo quieres comenzar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Explorar por mi cuenta/ }));
    expect(localStorage.getItem("coachMode")).toBe("self");
    expect(sessionStorage.getItem("mpm.welcomeGateDone")).toBe("true");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(apiRequest).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("public title follows language changes without overwriting an organization name", async () => {
  document.title = "AI-Powered Personalized Meal Planning | My Perfect Meals";
  await i18n.changeLanguage("es");
  expect(document.title).toBe("Planificación personalizada de comidas con IA | My Perfect Meals");
  await i18n.changeLanguage("en");
  expect(document.title).toBe("AI-Powered Personalized Meal Planning | My Perfect Meals");
  document.title = "Synthetic Organization";
  await i18n.changeLanguage("es");
  expect(document.title).toBe("Synthetic Organization");
  document.title = "";
});

test("dashboard guidance and retry controls display Spanish without changing their actions", () => {
  const retry = jest.fn();
  render(<GettingStartedCardView model={{
    statusText: "We couldn't check your progress. Your saved work hasn't been reset.",
    stages: [], loading: false, busy: false, canRetry: true,
    canContinue: false, paused: false, automaticDisabled: false,
    replayRequested: false, preferenceNotice: null,
  } as any} onContinue={jest.fn()} onRetry={retry}
    onPauseResume={jest.fn()} onToggleAutomatic={jest.fn()} onRestart={jest.fn()} />);
  expect(screen.getByRole("heading", { name: "Primeros pasos" })).toBeInTheDocument();
  expect(screen.getByText("No pudimos consultar tu progreso. Tu trabajo guardado no se ha restablecido.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("the dashboard tips link keeps its existing destination in Spanish", () => {
  render(<TipsBanner />);
  fireEvent.click(screen.getByRole("button", { name: "Leer la guía" }));
  expect(mockNavigate).toHaveBeenCalledWith("/tips");
});

test("MFA manual setup copy is Spanish but the setup key and enrollment request remain untouched", async () => {
  const RealMfaSetup = jest.requireActual("@/components/MfaSetupSection").MfaSetupSection;
  const fixtureKey = "SYNTHETIC_NON_CREDENTIAL_FIXTURE";
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  (apiRequest as jest.Mock)
    .mockResolvedValueOnce({ mfaEnabled: false, enrolledAt: null })
    .mockResolvedValueOnce({ secret: fixtureKey, qrDataUri: "data:image/png;base64," });
  render(<RealMfaSetup enrollmentRequired />);
  expect(await screen.findByRole("heading", { name: "¿Estás usando este teléfono?" })).toBeInTheDocument();
  expect(screen.getByLabelText("Clave de configuración de autenticación")).toHaveTextContent(fixtureKey);
  fireEvent.click(screen.getByRole("button", { name: "Copiar clave de configuración" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(fixtureKey));
  expect(apiRequest).toHaveBeenCalledWith("/api/auth/mfa/setup/begin", { method: "POST" });
  expect(apiRequest).toHaveBeenCalledTimes(2);
});
