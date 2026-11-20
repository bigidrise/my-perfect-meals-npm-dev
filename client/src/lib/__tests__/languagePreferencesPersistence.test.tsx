/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import LanguagePreferencesPage from "@/pages/profile/LanguagePreferencesPage";
import { LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import { apiRequest } from "@/lib/apiRequest";

let mockAuth: any;
const mockToast = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("wouter", () => ({ useLocation: () => ["/profile/language", jest.fn()] }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));

function Harness({ preference = "en" }: { preference?: string }) {
  const [user, setUser] = React.useState({
    id: "synthetic-locale", preferredLanguage: preference,
    countryCode: "CA", measurementSystem: "auto",
  });
  mockAuth = { user, setUser };
  return <LanguagePreferencesPage />;
}

beforeEach(async () => {
  localStorage.clear();
  jest.clearAllMocks();
  await i18n.changeLanguage("en");
});

test("explicit Spanish saves once, updates visible controls and emits a Spanish acknowledgement", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({ ok: true });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /^Español/ }));
  await waitFor(() => expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("es"));
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(apiRequest).toHaveBeenCalledWith("/api/user/preferences", expect.objectContaining({ body: JSON.stringify({ preferredLanguage: "es" }) }));
  expect(i18n.language).toBe("es");
  expect(mockAuth.user.preferredLanguage).toBe("es");
  expect(mockAuth.user.countryCode).toBe("CA");
  expect(mockAuth.user.measurementSystem).toBe("auto");
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: i18n.t("language.saved") }));
  expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
});

test("only Automatic, English and Español are selectable and describe the interface", async () => {
  render(<Harness />);
  expect(await screen.findByRole("button", { name: /^Automatic/ })).toHaveTextContent("interface");
  expect(screen.getByRole("button", { name: /^English/ })).toHaveTextContent("interface");
  expect(screen.getByRole("button", { name: /^Español/ })).toHaveTextContent("interface");
  for (const language of ["Français", "Deutsch", "中文", "العربية", "日本語"]) {
    expect(screen.queryByRole("button", { name: new RegExp(language) })).not.toBeInTheDocument();
  }
  expect(screen.getByText(/Spanish coverage is being verified/)).toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();
});

test("an unsupported saved choice displays English without writing until an explicit selection", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({ ok: true });
  render(<Harness preference="zh" />);
  const english = await screen.findByRole("button", { name: /^English/ });
  expect(english).toHaveAttribute("aria-pressed", "true");
  expect(mockAuth.user.preferredLanguage).toBe("zh");
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.click(english);
  await waitFor(() => expect(mockAuth.user.preferredLanguage).toBe("en"));
  expect(apiRequest).toHaveBeenCalledWith("/api/user/preferences", expect.objectContaining({
    body: JSON.stringify({ preferredLanguage: "en" }),
  }));
});

test("Auto persists Auto, not the Spanish device resolution", async () => {
  const device = jest.spyOn(navigator, "language", "get").mockReturnValue("es-MX");
  (apiRequest as jest.Mock).mockResolvedValue({ ok: true });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /^Auto/ }));
  await waitFor(() => expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("auto"));
  expect(apiRequest).toHaveBeenCalledWith("/api/user/preferences", expect.objectContaining({ body: JSON.stringify({ preferredLanguage: "auto" }) }));
  expect(mockAuth.user.preferredLanguage).toBe("auto");
  expect(i18n.language).toBe("es");
  device.mockRestore();
});

test("failed saves restore the previous selection, interface, preference and startup hint", async () => {
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "en");
  (apiRequest as jest.Mock).mockRejectedValue(new Error("offline"));
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /^Español/ }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
  expect(i18n.language).toBe("en");
  expect(mockAuth.user.preferredLanguage).toBe("en");
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("en");
});

test("a late save response cannot overwrite the next account's startup language", async () => {
  let resolve!: (value: unknown) => void;
  (apiRequest as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /^Español/ }));
  await act(async () => { mockAuth.setUser({ id: "synthetic-next-account", preferredLanguage: "fr" }); });
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "fr");
  await act(async () => { resolve({ ok: true }); });
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("fr");
  expect(mockAuth.user.id).toBe("synthetic-next-account");
  expect(mockToast).not.toHaveBeenCalled();
});
