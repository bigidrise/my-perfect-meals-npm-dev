/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { resolveLanguagePreference, LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import DiabeticBuilderEntry from "@/pages/physician/DiabeticBuilderEntry";
import GLP1BuilderEntry from "@/pages/physician/GLP1BuilderEntry";
import AntiInflammatoryBuilderEntry from "@/pages/physician/AntiInflammatoryBuilderEntry";
import GeneralNutritionBuilderEntry from "@/pages/pro/GeneralNutritionBuilderEntry";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";

const mockNavigate = jest.fn(), mockPatch = jest.fn(), mockRefresh = jest.fn(), mockGenerate = jest.fn();
const mockCheckDiet = jest.fn(), mockCheckSafety = jest.fn();
const mockUser: any = { id: "offline-ui-review", diabetic: true, hasDiabetes: true };
let mockCanTrain = true, mockGenerating = false;
jest.mock("wouter", () => ({ useLocation: () => ["/fixture", mockNavigate] }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ initial, animate, transition, children, ...props }: any) => <div {...props}>{children}</div> },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, refreshUser: mockRefresh }) }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: (...args: any[]) => mockPatch(...args) }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: jest.fn() }));
jest.mock("@/lib/subscriptionCheck", () => ({ isClinicalOrAbove: () => mockCanTrain }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useDiabetes", () => ({ useGlucoseLogs: () => ({ data: [], isLoading: false }) }));
jest.mock("@/hooks/useCreateWithChefRequest", () => ({ useCreateWithChefRequest: () => ({
  generating: mockGenerating, progress: 0, error: null, generateMeal: mockGenerate, cancel: jest.fn(),
}) }));
jest.mock("@/hooks/useSafetyGuardPrecheck", () => ({ useSafetyGuardPrecheck: () => ({
  checking: false, alert: { show: false }, checkSafety: mockCheckSafety, clearAlert: jest.fn(),
  setOverrideToken: jest.fn(), hasActiveOverride: false, allergyConflictPayload: { current: null }, restoreBlockedAlert: jest.fn(),
}) }));
jest.mock("@/hooks/useDietGuardPrecheck", () => ({ useDietGuardPrecheck: () => ({
  alert: null, checkDiet: mockCheckDiet, clearAlert: jest.fn(), shouldShowIntercept: false, setDecision: jest.fn(),
}) }));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (value: string) => value }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/components/voice/VoiceInputButton", () => ({
  VoiceInputButton: ({ label, disabled }: any) => <button aria-label={label} disabled={disabled} />,
}));
jest.mock("@/components/SafetyGuardBanner", () => ({ SafetyGuardBanner: () => null }));
jest.mock("@/components/AllergyConflictModal", () => ({ AllergyConflictModal: () => null }));
jest.mock("@/components/DietGuardIntercept", () => ({ DietGuardIntercept: () => null }));
jest.mock("@/components/meal/BuilderOverrideDialog", () => ({ BuilderOverrideDialog: () => null }));

const entries = [
  ["diabetic", DiabeticBuilderEntry, "/diabetic-hub", "/diabetic/training"],
  ["glp1", GLP1BuilderEntry, "/glp1-hub", "/glp1/training"],
  ["anti", AntiInflammatoryBuilderEntry, "/anti-inflammatory-menu-builder", "/anti-inflammatory/training"],
  ["general", GeneralNutritionBuilderEntry, "/general-nutrition-builder/build", "/general-nutrition/training"],
] as const;
const preferences = [
  ["en", "es-MX", "en"], ["es", "en-US", "es"], ["auto", "es-MX", "es"], ["auto", "en-US", "en"],
] as const;
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function writePassiveFixture(name: string) {
  const directory = process.env.SPANISH_ENTRY_FIXTURE_DIR;
  if (!directory) return;
  const cssDirectory = path.join(directory, "../client/assets");
  const css = fs.readdirSync(cssDirectory).filter(file => file.endsWith(".css"))
    .map(file => fs.readFileSync(path.join(cssDirectory, file), "utf8")).join("\n");
  // No event handlers or application startup survive innerHTML. This review
  // fixture is passive markup, not a separate app or an authenticated page.
  const markup = document.body.innerHTML.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.html`), `<!doctype html><html lang="${i18n.resolvedLanguage}">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'">
    <title>${name} passive real-component review</title><style>${css}</style></head>
    <body class="bg-black text-white">${markup}</body></html>`);
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockCanTrain = true; mockGenerating = false;
  mockUser.performanceModeEnabled = true;
  mockUser.weeklyTrainingSchedule = Object.fromEntries(weekdays.map(day => [day, "strength"]));
  mockPatch.mockResolvedValue({ ok: true }); mockRefresh.mockResolvedValue(undefined);
  mockCheckDiet.mockReturnValue(false); mockCheckSafety.mockResolvedValue(false);
  global.fetch = jest.fn(() => { throw new Error("Unexpected network in offline builder entry/modal tests"); }) as any;
});
afterEach(cleanup);

test("all existing board snack-heading keys resolve to Spanish without changing identifiers", async () => {
  await i18n.changeLanguage("es");
  for (const key of ["metabolicBuilder.snacks", "weeklyBoard.snacks", "performanceCompetitionBuilder.snacksLabel"])
    expect(i18n.t(key)).toBe("Refrigerios");
});

describe.each(entries)("%s real entry page", (id, Entry, hub, training) => {
  test.each(preferences)("%s on %s preserves intent and shows translated ordinary controls", async (preference, device, resolved) => {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
    await i18n.changeLanguage(resolveLanguagePreference(preference, device));
    render(<Entry />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("gnbEntry.title", { ns: "pro" }));
    expect(screen.getByText(i18n.t("gnbEntry.trainTitle", { ns: "pro" }))).toBeVisible();
    expect(screen.getByText(i18n.t("gnbEntry.scheduleTitle", { ns: "pro" }))).toBeVisible();
    expect(screen.getByText(i18n.t("gnbEntry.editSchedule", { ns: "pro" }), { exact: false })).toBeVisible();
    expect(screen.getByText(id === "general"
      ? i18n.t("gnbEntry.today", { ns: "pro", label: i18n.t("gnbEntry.sessions.strength", { ns: "pro" }) })
      : resolved === "es" ? "Hoy: Día de fuerza" : "Today: Strength Day")).toBeVisible();
    expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
    expect(mockPatch).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    writePassiveFixture(`entry-${id}-${preference}-${resolved}`);
  });

  test("switching language updates the mounted page without changing mode or routing", async () => {
    await i18n.changeLanguage("en");
    render(<Entry />);
    await act(async () => { await i18n.changeLanguage("es"); });
    expect(screen.getByRole("heading")).toHaveTextContent("¿Por dónde");
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("training eligibility and existing mode/navigation behavior stay intact", async () => {
    await i18n.changeLanguage("es");
    mockUser.weeklyTrainingSchedule = null;
    let view = render(<Entry />);
    const buildLabel = id === "general" ? i18n.t("gnbEntry.continueTo", { ns: "pro" }) : "Prepara las comidas de hoy";
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: new RegExp(buildLabel) })); });
    expect(mockPatch).toHaveBeenLastCalledWith("/api/performance/mode", { method: "PATCH", body: '{"enabled":false}' });
    expect(mockNavigate).toHaveBeenLastCalledWith(hub);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Configurar horario/ })); });
    expect(mockPatch).toHaveBeenLastCalledWith("/api/performance/mode", { method: "PATCH", body: '{"enabled":true}' });
    expect(mockNavigate).toHaveBeenLastCalledWith(training);
    writePassiveFixture(`entry-${id}-setup-es`);
    view.unmount();
    mockCanTrain = false;
    render(<Entry />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

test.each(preferences)("%s/%s actual Chef modal opens with ordinary controls localized", async (preference, device, resolved) => {
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  await i18n.changeLanguage(resolveLanguagePreference(preference, device));
  render(<CreateWithChefModal open onOpenChange={jest.fn()} mealType="breakfast" onMealGenerated={jest.fn()} dietType="general-nutrition" />);
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByText(i18n.t("createWithChef.subtitle", { mealType: resolved === "es" ? "desayuno" : "breakfast" }))).toBeVisible();
  expect(screen.getByPlaceholderText(i18n.t("createWithChef.placeholderBreakfast"))).toBeVisible();
  expect(screen.getByRole("button", { name: i18n.t("createWithChef.generateBtn") })).toBeDisabled();
  expect(screen.getByRole("button", { name: resolved === "es" ? "Usar entrada de voz para describir tu comida" : "Use voice input to describe your meal" })).toBeVisible();
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  writePassiveFixture(`chef-${preference}-${resolved}`);
});

test("open Chef modal follows a language change but retains typed food and safety checks", async () => {
  await i18n.changeLanguage("en");
  const close = jest.fn();
  render(<CreateWithChefModal open onOpenChange={close} mealType="lunch" onMealGenerated={jest.fn()} dietType="general-nutrition" />);
  const field = screen.getByPlaceholderText(i18n.t("createWithChef.placeholderLunch"));
  fireEvent.change(field, { target: { value: "ORIGINAL_PERSON_DESCRIPTION" } });
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(field).toHaveValue("ORIGINAL_PERSON_DESCRIPTION");
  expect(screen.getByText("Dile al Chef qué quieres para almuerzo")).toBeVisible();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generar comida con IA" })); });
  expect(mockCheckDiet).toHaveBeenCalledWith("ORIGINAL_PERSON_DESCRIPTION");
  expect(mockGenerate).not.toHaveBeenCalled();
  mockCheckDiet.mockReturnValue(true);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Generar comida con IA" })); });
  expect(mockCheckSafety).toHaveBeenCalled();
  expect(mockGenerate).not.toHaveBeenCalled();
  writePassiveFixture("chef-entered-es");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledWith(false);
});

test("Chef processing state preserves disabled input and existing stop control", async () => {
  await i18n.changeLanguage("es"); mockGenerating = true;
  render(<CreateWithChefModal open onOpenChange={jest.fn()} mealType="dinner" onMealGenerated={jest.fn()} dietType="general-nutrition" />);
  expect(screen.getByPlaceholderText(i18n.t("createWithChef.placeholderDinner"))).toBeDisabled();
  expect(screen.getByRole("button", { name: "Detener" })).toBeVisible();
  writePassiveFixture("chef-processing-es");
  expect(mockGenerate).not.toHaveBeenCalled();
});

test.each(["en", "es"])("%s starch status translates existing counts without changing inputs or guidance", async language => {
  await i18n.changeLanguage(language);
  const fiber = { name: "Broccoli salad", ingredients: ["broccoli", "spinach"] };
  const starch = { name: "Rice bowl", ingredients: ["rice"] };
  const original = JSON.stringify({ fiber, starch });
  const view = render(<DailyStarchIndicator meals={[fiber]} strategyOverride="flex" />);
  expect(screen.getByText(language === "es" ? "2 disponibles" : "2 Available", { exact: false })).toBeVisible();
  view.rerender(<DailyStarchIndicator meals={[starch]} strategyOverride="flex" />);
  expect(screen.getByText(language === "es" ? "Restantes: 1" : "1 Remaining", { exact: false })).toBeVisible();
  view.rerender(<DailyStarchIndicator meals={[starch, starch]} strategyOverride="flex" />);
  expect(screen.getByText(language === "es" ? "Ambas usadas" : "Both Used", { exact: false })).toBeVisible();
  view.rerender(<DailyStarchIndicator meals={[starch, starch, starch]} strategyOverride="flex" />);
  expect(screen.getByText(language === "es" ? "(por encima del límite)" : "(over limit)")).toBeVisible();
  expect(JSON.stringify({ fiber, starch })).toBe(original);
  writePassiveFixture(`starch-${language}`);
});

test.each(["en", "es"])("%s compact starch hints keep exact grams and zero-starch guidance stays protected", async language => {
  await i18n.changeLanguage(language);
  const prescription: any = { starchMealsAllowed: 2, starchMealsRemaining: 2, gramsPerRemainingStarchMeal: 37.5, isZeroStarchDay: false };
  const original = JSON.stringify(prescription);
  const view = render(<DailyStarchIndicator meals={[]} compact prescription={prescription} />);
  expect(screen.getByText(language === "es" ? "~37.5g cada una" : "~37.5g ea")).toBeVisible();
  expect(JSON.stringify(prescription)).toBe(original);
  view.rerender(<DailyStarchIndicator meals={[]} prescription={{ ...prescription, isZeroStarchDay: true }} />);
  expect(screen.getByText("🔵 Rest Day — Zero Starch")).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
});
