/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { LANGUAGE_PREFERENCE_KEY, resolveLanguagePreference } from "@/i18n/languagePreference";
import { useGlycemicFoodLabels, useGlucoseContextLabels } from "@/i18n/useConsumerChoiceLabels";
import { useMenuDisplayCopy } from "@/i18n/useMenuDisplayCopy";
import { getMyPerfectMenuSlotInstruction, getMyPerfectMenuSlotGuidance } from "@/lib/myPerfectMenuSlotGuidance";
import { LOW_RANGE_OPTIONS, MID_RANGE_OPTIONS, HIGH_RANGE_OPTIONS } from "@/types/glycemic";
import ShotTrackerPanel from "@/pages/glp1/ShotTrackerPanel";
import { GlycemicSettingsModal } from "@/components/diabetic/GlycemicSettingsModal";
import HydrationCenter from "@/pages/HydrationCenter";
import DiabeticHub from "@/pages/physician/DiabeticHub";
import MyPerfectMenu from "@/pages/MyPerfectMenu";
import { BasicHydrationLogger } from "@/components/biometrics/BasicHydrationLogger";
import { MealPlanDestinationPicker } from "@/components/MealPlanDestinationPicker";
import HydrationFourDoorPanels from "@/components/HydrationFourDoorPanels";
import { useBatchOneErrorCopy } from "@/i18n/useBatchOneDisplayCopy";
import { useHydrationInterventionDisplay } from "@/i18n/useHydrationInterventionDisplay";
import { FluidLogNotice } from "@/i18n/ConsumerNotice";
import { createHydrationHandoff, createHydrationLiquidProtocol } from "@/lib/hydrationApi";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const mockNavigate = jest.fn(), mockToast = jest.fn(), mockSavePreferences = jest.fn();
const mockCreate = jest.fn(), mockUpdate = jest.fn(), mockDelete = jest.fn(), mockWater = jest.fn();
const mockCancel = jest.fn(), mockGenerate = jest.fn(), mockHouseholdSwitch = jest.fn(), mockHydration = jest.fn();
const mockGlucose = jest.fn();
let mockGlp1Active = false;
let mockDevelopmentRuntime = false;
const mockGlycemicData = { bloodGlucose: 105, lowRangeCarbs: ["LEGACY_FOOD"], midRangeCarbs: [], highRangeCarbs: [] };
const mockShot = { id: "offline-shot", dateUtc: "2026-11-18T15:07:00Z", doseMg: 2.5, medicationName: "Zepbound", location: "thigh", notes: "ORIGINAL_SAVED_NOTES" };
const mockShots = [mockShot];
const mockGlucoseLogs = { data: [{ valueMgdl: 100, context: "FASTED", recordedAt: "2026-11-18T15:07:00Z" }] };
const mockBuilder = { key: "general_nutrition", namespace: "generalNutrition", displayName: "General Nutrition Builder", generationMode: "builder" };
const mockConcepts = Array.from({ length: 3 }, (_, index) => ({
  id: `idea-${index}`, ideaType: "breakfast", title: `ORIGINAL_IDEA_${index}`, description: "ORIGINAL_GENERATED_DESCRIPTION",
}));
let mockSearch = "";
const mockSubmitPreflight = jest.fn(), mockReloadPreflight = jest.fn();
let mockPreflight: any;
jest.mock("@/hooks/useGlp1HubCheckin", () => ({ useGlp1HubCheckin: () => mockPreflight }));

jest.mock("@/lib/developmentRuntimeFlag", () => ({ get isDevelopmentRuntime() { return mockDevelopmentRuntime; } }));
jest.mock("wouter", () => ({ useLocation: () => ["/fixture", mockNavigate], useSearch: () => mockSearch }));
jest.mock("framer-motion", () => ({ motion: { div: ({ initial, animate, transition, children, ...p }: any) => <div {...p}>{children}</div> } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "offline-subject" }, refreshUser: jest.fn() }) }));
jest.mock("@/contexts/HouseholdContext", () => ({ useHousehold: () => ({
  activeProfile: null, activeProfileId: null, profiles: [], loading: false, setActive: mockHouseholdSwitch,
}) }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (p: string) => p }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/authRequired", () => ({ handleDefinitiveAuthFailure: () => false, SESSION_EXPIRED_MESSAGE: "Session expired" }));
jest.mock("@/lib/activeBuilderNs", () => ({ getActiveBuilderNs: () => "general_nutrition" }));
jest.mock("@/lib/api", () => ({ logEnvironmentFingerprint: jest.fn(), ApiError: class ApiError extends Error {} }));
jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock("@/hooks/useGlp1Shots", () => ({
  useGlp1Shots: () => ({ data: mockShots, isLoading: false, isError: false, refetch: jest.fn() }),
  useCreateShot: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateShot: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useDeleteShot: () => ({ mutateAsync: mockDelete, isPending: false }),
}));
jest.mock("@/hooks/useGlycemicSettings", () => ({ useGlycemicSettings: () => ({ data: mockGlycemicData, save: mockSavePreferences, isSaving: false }) }));
jest.mock("@/hooks/useMeasurementSystem", () => ({ useMeasurementSystem: () => "imperial" }));
jest.mock("@/lib/waterLogsApi", () => ({
  getWaterLogs: async () => ({ items: [], localDate: "2026-11-18" }), createWaterLog: (...a: any[]) => mockWater(...a),
}));
jest.mock("@/lib/hydrationApi", () => ({
  getHydrationHubState: (...a: any[]) => mockHydration(...a),
  addHydrationWater: jest.fn(), createHydrationHelp: jest.fn(), saveHydrationHubBarriers: jest.fn(),
  saveHydrationHubPreferences: jest.fn(), activateHydrationLiquidProtocol: jest.fn(),
  createHydrationLiquidProtocol: jest.fn(), createHydrationHandoff: jest.fn(), recordHydrationInterventionEvent: jest.fn(),
}));
jest.mock("@/hooks/useDiabetes", () => ({
  useSaveDiabetesProfile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useLogGlucose: () => ({ mutateAsync: mockGlucose, isPending: false }),
  useGlucoseLogs: () => ({ data: mockGlucoseLogs, isLoading: false }),
  useDiabetesProfile: () => ({ data: null, isLoading: false }),
}));
jest.mock("@/hooks/useQuickTour", () => ({ useQuickTour: () => ({ isOpen: false, openTour: jest.fn(), closeTour: jest.fn() }) }));
jest.mock("@/hooks/useGLP1CurrentUse", () => ({ useGLP1CurrentUse: () => ({ data: { effectiveActive: mockGlp1Active }, isError: false, isLoading: false }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ isClinicalOrAbove: () => false }));
jest.mock("@/hooks/useCreateWithChefRequest", () => ({ useCreateWithChefRequest: () => ({ generateMeal: mockGenerate, cancel: mockCancel }) }));
jest.mock("@/hooks/useSnackCreatorRequest", () => ({ useSnackCreatorRequest: () => ({ generateSnack: mockGenerate, cancel: mockCancel }) }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock("@/components/copilot/CopilotBrain", () => ({ CopilotBrain: () => null }));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: ({ label }: any) => <span>{label}</span> }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: ({ trigger }: any) => trigger ?? null }));
jest.mock("@/components/guided/QuickTourModal", () => ({ QuickTourModal: () => null }));
jest.mock("@/components/guided/QuickTourButton", () => ({ QuickTourButton: () => null }));
jest.mock("@/components/GlucoseGuardExplainerModal", () => ({ GlucoseGuardExplainerModal: () => null }));
jest.mock("@/components/diabetic/GLP1CompanionModal", () => ({ GLP1CompanionModal: () => null }));
jest.mock("@/components/glp1/GLP1DailyCheckin", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/glp1/GLP1MealPreflight", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/performance/PerformanceNutritionSetupForm", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/TrashButton", () => ({ __esModule: true, default: ({ onClick, ariaLabel, confirmMessage }: any) => <button aria-label={ariaLabel} onClick={onClick}>{confirmMessage}</button> }));
jest.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>, DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}));

beforeEach(async () => {
  cleanup(); localStorage.clear(); jest.clearAllMocks(); mockSearch = "";
  mockGlp1Active = false;
  mockDevelopmentRuntime = false;
  await i18n.changeLanguage("en");
  mockPreflight = {
    checkin: { id: "offline-checkin", appetiteLevel: "reduced", fatigue: "mild", notifyCareTeam: "physician", medicationName: "ORIGINAL_MEDICATION" },
    tolerance: null, isLoading: false, isSubmitting: false, hasLoaded: true,
    submit: mockSubmitPreflight.mockResolvedValue(true), reload: mockReloadPreflight, error: null,
  };
  for (const fn of [mockCreate, mockUpdate, mockDelete, mockSavePreferences, mockWater]) fn.mockResolvedValue({});
  mockHydration.mockImplementation(() => new Promise(() => {})); // Safe shell, no authority or customer reads.
  global.fetch = jest.fn(async (url: any, init: any = {}) => {
    const path = String(url);
    if (path.startsWith("/api/weekly-board")) return { ok: true, json: async () => ({ week: { days: {} } }) };
    if (path.startsWith("/api/my-perfect-menu/context")) return { ok: true, json: async () => ({
      subject: { id: "offline-subject" }, builder: mockBuilder,
      diabetes: { applicable: false, needsRefresh: false }, glp1: { active: false },
    }) };
    if (path.startsWith("/api/my-perfect-menu/concepts")) return { ok: true, status: 200, json: async () => ({
      subject: { id: "offline-subject" }, builder: mockBuilder, categories: {}, concepts: init.method === "POST" ? mockConcepts : [],
    }) };
    throw new Error(`Unexpected offline request: ${path}`);
  }) as any;
});
afterEach(cleanup);

test.each([
  ["en", "es-MX", "en"], ["es", "en-US", "es"], ["auto", "en-US", "en"], ["auto", "es-MX", "es"],
])("%s on %s localizes the five real areas without changing saved language intent", async (preference, device, language) => {
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
  await i18n.changeLanguage(resolveLanguagePreference(preference as any, device));
  let view = render(<ShotTrackerPanel userId="offline-subject" onClose={jest.fn()} />);
  expect(screen.getByRole("heading", { name: i18n.t("Shot Tracker", { ns: "consumerJourney" }) })).toBeVisible();
  expect(screen.getByText("ORIGINAL_SAVED_NOTES")).toBeVisible();
  captureReview(`shot-${language}`);
  view.unmount();
  view = render(<GlycemicSettingsModal open onClose={jest.fn()} />);
  expect(screen.getAllByRole("button", { name: language === "es" ? "Frutos rojos" : "Berries" })).toHaveLength(3);
  expect(screen.getByText(language === "es" ? "Opciones de carbohidratos según la glucosa" : "Glucose-Based Carb Choices")).toBeVisible();
  captureReview(`carb-choices-${language}`);
  view.unmount();
  view = render(<HydrationCenter />);
  expect(screen.getByTestId("hydration-door-everyday")).toHaveTextContent(language === "es" ? "Hidratación cotidiana" : "Everyday Hydration");
  expect(screen.getByTestId("basic-hydration-submit")).toHaveTextContent(language === "es" ? "Registrar líquido" : "Log fluid");
  captureReview(`hydration-loading-${language}`);
  view.unmount();
  view = render(<DiabeticHub />);
  expect(screen.getByText(language === "es" ? "Lecturas recientes" : "Recent Readings")).toBeVisible();
  expect(screen.getByText(language === "es" ? "(En ayunas)" : "(Fasted)")).toBeVisible();
  captureReview(`diabetic-${language}`);
  view.unmount();
  render(<MyPerfectMenu />);
  expect(await screen.findByText(language === "es" ? "¿Qué te apetece?" : "What sounds good?")).toBeVisible();
  captureReview(`menu-empty-${language}`);
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockSavePreferences).not.toHaveBeenCalled(); expect(mockGenerate).not.toHaveBeenCalled();
});

test("Shot Tracker language changes preserve typed data; create/edit/delete keep canonical payloads", async () => {
  const view = render(<ShotTrackerPanel userId="offline-subject" onClose={jest.fn()} />);
  fireEvent.change(view.container.querySelector('select')!, { target: { value: "Ozempic" } });
  fireEvent.change(view.container.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-11-18T15:07" } });
  fireEvent.change(view.container.querySelectorAll('select')[1], { target: { value: "upper_arm" } });
  fireEvent.change(screen.getByPlaceholderText("e.g., 2 inches from navel", { exact: false }), { target: { value: "ORIGINAL_TYPED_NOTES" } });
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByDisplayValue("ORIGINAL_TYPED_NOTES")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Guardar inyección" }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
    dateUtc: new Date("2026-11-18T15:07").toISOString(), doseMg: 2.5, location: "upper_arm", medicationName: "Ozempic", notes: "ORIGINAL_TYPED_NOTES",
  }));
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByPlaceholderText("Notas (opcionales)"), { target: { value: "ORIGINAL_EDITED_NOTES" } });
  fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
    id: mockShot.id, doseMg: 2.5, location: "thigh", medicationName: "Zepbound", notes: "ORIGINAL_EDITED_NOTES",
  })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Eliminar inyección" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Eliminar inyección" }));
  expect(mockDelete).toHaveBeenCalledWith("offline-shot");
});

test("Spanish food buttons save English catalog identities and preserve legacy selections", async () => {
  await i18n.changeLanguage("es"); render(<GlycemicSettingsModal open onClose={jest.fn()} />);
  fireEvent.click(screen.getAllByRole("button", { name: /^Frutos rojos$/ })[0]);
  await act(async () => { await i18n.changeLanguage("en"); });
  fireEvent.click(screen.getByRole("button", { name: "Save Glucose Carb Preferences" }));
  await waitFor(() => expect(mockSavePreferences).toHaveBeenCalledWith({
    bloodGlucose: 105, preferredCarbs: ["LEGACY_FOOD", "Berries"], lowRangeCarbs: ["LEGACY_FOOD", "Berries"],
    midRangeCarbs: [], highRangeCarbs: [], glycemicPreferencesConfigured: true,
  }));
});

test("Shot Tracker localizes ordinary validation and Other without changing medication identities", async () => {
  await i18n.changeLanguage("es");
  const alert = jest.spyOn(window, "alert").mockImplementation(() => {});
  try {
    const view = render(<ShotTrackerPanel userId="offline-subject" onClose={jest.fn()} />);
    expect(screen.getByRole("option", { name: "Otro medicamento" })).toHaveValue("Other");
    fireEvent.change(view.container.querySelector('input[type="number"]')!, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar inyección" }));
    expect(alert).toHaveBeenCalledWith("Introduce una dosis válida (mg).");
    expect(mockCreate).not.toHaveBeenCalled();
    // Separate attempts use fresh controls; the real shared button deliberately
    // ignores a second click within its 300 ms double-submit protection.
    view.unmount();
    const validView = render(<ShotTrackerPanel userId="offline-subject" onClose={jest.fn()} />);
    fireEvent.change(validView.container.querySelector("select")!, { target: { value: "Other" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar inyección" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ medicationName: "Other", doseMg: 2.5 })));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getAllByRole("option", { name: "Otro medicamento" })).toHaveLength(2);
    expect(screen.getByDisplayValue("ORIGINAL_SAVED_NOTES")).toBeVisible();
  } finally {
    alert.mockRestore();
  }
});

test("Diabetic Hub localizes its tutorial and symptom-panel controls without saving", async () => {
  mockGlp1Active = true;
  mockDevelopmentRuntime = true;
  await i18n.changeLanguage("es");
  render(<DiabeticHub />);
  expect(screen.getByText("Tutorial del centro")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar los síntomas diarios de GLP-1" }));
  expect(screen.getByRole("button", { name: "Ocultar el panel diario de síntomas" })).toBeVisible();
  expect(mockSubmitPreflight).not.toHaveBeenCalled();
  expect(mockGlucose).not.toHaveBeenCalled();
});

test("Spanish carb-choice range controls wrap and the long Save label remains multiline", async () => {
  await i18n.changeLanguage("es");
  render(<GlycemicSettingsModal open onClose={jest.fn()} />);
  for (const button of screen.getAllByRole("button", { name: "Seleccionar todo" })) {
    expect(button.parentElement).toHaveClass("flex-wrap", "gap-2");
  }
  expect(screen.getByRole("button", { name: "Guardar preferencias de carbohidratos según la glucosa" })).toHaveClass("h-auto", "whitespace-normal");
  expect(mockSavePreferences).not.toHaveBeenCalled();
});

test("hydration labels do not alter fluid units, quantities or beverage identifiers", async () => {
  await i18n.changeLanguage("es"); render(<BasicHydrationLogger userId="offline-subject" />);
  fireEvent.click(screen.getByTestId("basic-hydration-beverage-tea"));
  fireEvent.change(screen.getByTestId("basic-hydration-amount"), { target: { value: "12" } });
  fireEvent.click(screen.getByTestId("basic-hydration-submit"));
  await waitFor(() => expect(mockWater).toHaveBeenCalledWith({ amount: 12, unit: "oz", beverageClass: "tea" }));
});

test("Menu keeps original generated ideas while localizing category and replacement controls", async () => {
  await i18n.changeLanguage("es"); render(<MyPerfectMenu />);
  await waitFor(() => expect(screen.queryByText("Restaurando tus ideas de menú guardadas…")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Ideas de desayuno/ }));
  expect(await screen.findByText("ORIGINAL_IDEA_0")).toBeVisible();
  expect(screen.getAllByText("ORIGINAL_GENERATED_DESCRIPTION")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Probar 3 más" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Probar 3 más" }));
  expect(screen.getByText("¿Probar 3 ideas nuevas?")).toBeVisible();
  captureReview("menu-replacement-dialog-es");
  fireEvent.click(screen.getByRole("button", { name: "Conservar estas ideas" }));
  expect(screen.getByText("ORIGINAL_IDEA_0")).toBeVisible();
  const posted = (global.fetch as jest.Mock).mock.calls.find(([url, init]) => String(url).endsWith("/concepts") && init?.method === "POST");
  expect(JSON.parse(posted![1].body).ideaType).toBe("breakfast");
  expect(mockGenerate).not.toHaveBeenCalled();
});

test("destination picker language switch retains date/slot authority and original meal title", async () => {
  const choose = jest.fn(); render(<MealPlanDestinationPicker open onOpenChange={jest.fn()} title="ORIGINAL_RECIPE_TITLE" onSelect={choose} builderKey="general_nutrition" menuIdeaType="breakfast" />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Meal 1/ })).toBeEnabled());
  const reads = (global.fetch as jest.Mock).mock.calls.length;
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByText("ORIGINAL_RECIPE_TITLE")).toBeVisible();
  expect((global.fetch as jest.Mock).mock.calls).toHaveLength(reads);
  fireEvent.click(screen.getByRole("button", { name: /Comida 1/ }));
  expect(choose).toHaveBeenCalledWith(expect.objectContaining({ slot: "breakfast", builderType: "generalNutrition" }));
});

test("closed food and slot display maps cover the canonical catalogs without replacing governance helpers", async () => {
  const { result } = renderHook(() => ({ foods: useGlycemicFoodLabels(), contexts: useGlucoseContextLabels(), menu: useMenuDisplayCopy() }));
  for (const food of new Set([...LOW_RANGE_OPTIONS, ...MID_RANGE_OPTIONS, ...HIGH_RANGE_OPTIONS])) expect(result.current.foods[food]).toBeTruthy();
  for (const type of ["breakfast", "lunch", "dinner", "snack"]) expect(result.current.menu.instructions[type]).toEqual(getMyPerfectMenuSlotInstruction(type));
  expect(result.current.menu.guidance).toEqual(getMyPerfectMenuSlotGuidance("breakfast", "snacks"));
  expect(result.current.contexts.FASTED).toBe("Fasted");
  expect(result.current.foods["ORIGINAL_UNKNOWN_FOOD"]).toBeUndefined();
});

const ActualPreflight = jest.requireActual("@/components/glp1/GLP1MealPreflight").default;
const ActualDailyCheckin = jest.requireActual("@/components/glp1/GLP1DailyCheckin").default;

// Optional passive browser evidence, produced only from these mocked, actual
// components. No application bootstrap, scripts, media or external requests.
function captureReview(name: string) {
  if (!process.env.BATCH_ONE_REVIEW_HTML) return;
  const css = readFileSync(process.env.BATCH_ONE_REVIEW_CSS!, "utf8")
    .replace(/@import[^;]+;/g, "").replace(/url\([^)]*\)/g, "none");
  const body = document.body.cloneNode(true) as HTMLElement;
  body.querySelectorAll("script,iframe,video,audio,source,link").forEach(node => node.remove());
  body.querySelectorAll("*").forEach(node => {
    for (const attr of Array.from(node.attributes)) {
      if (/^(src|srcset|poster|action|formaction)$/i.test(attr.name) || /^on/i.test(attr.name)) node.removeAttribute(attr.name);
      if (attr.name === "style") node.setAttribute("style", attr.value.replace(/url\([^)]*\)/g, "none"));
    }
  });
  const html = `<!doctype html><html lang="${i18n.resolvedLanguage}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} — actual component, synthetic state</title><style>${css}\nbody{background:#020617;color:white;font-family:system-ui,sans-serif;margin:0}</style></head><body>${body.innerHTML}</body></html>`;
  expect(html).not.toMatch(/<script|<iframe|<video|<audio|<source|\ssrc=|@import|url\(/i);
  mkdirSync("generated-artifacts/batch-one-review", { recursive: true });
  writeFileSync(`generated-artifacts/batch-one-review/${name}.html`, html);
}

test("GLP-1 preflight localizes every ordinary question and preserves unsaved answers and canonical submission", async () => {
  const saved = jest.fn().mockResolvedValue(undefined);
  const view = render(<ActualPreflight open onOpenChange={jest.fn()} onSaved={saved} onOpenSettings={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Appetite today"), { target: { value: "suppressed" } });
  fireEvent.change(screen.getByLabelText("Nausea"), { target: { value: "moderate" } });
  captureReview("glp1-preflight-en");
  const reads = (global.fetch as jest.Mock).mock.calls.length;
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByLabelText("Apetito de hoy")).toHaveValue("suppressed");
  expect(screen.getByLabelText("Náuseas")).toHaveValue("moderate");
  for (const label of ["Reflujo", "Estreñimiento", "Diarrea", "Hinchazón", "Saciedad temprana", "Aversión a los alimentos", "Vómitos"]) expect(screen.getByLabelText(label)).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
  expect(screen.getAllByRole("option", { name: "Varias veces" })).toHaveLength(1);
  expect((global.fetch as jest.Mock).mock.calls.length).toBe(reads);
  captureReview("glp1-preflight-es");
  fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
  await waitFor(() => expect(mockSubmitPreflight).toHaveBeenCalledWith(expect.objectContaining({
    appetiteLevel: "suppressed", nausea: "moderate", fatigue: "mild",
    notifyCareTeam: "physician", medicationName: "ORIGINAL_MEDICATION",
  })));
  expect(saved).toHaveBeenCalledTimes(1);
  view.unmount();
});

test("GLP-1 load failures, retry, loading and pending save use the real component without a service request", async () => {
  await i18n.changeLanguage("es");
  mockPreflight = { ...mockPreflight, hasLoaded: false, checkin: null };
  const props = { open: true, onOpenChange: jest.fn(), onSaved: jest.fn(), onOpenSettings: jest.fn() };
  const view = render(<ActualPreflight {...props} />);
  expect(screen.getByText("No pudimos cargar el registro de GLP-1 de hoy.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Guardar y continuar" })).not.toBeInTheDocument();
  captureReview("glp1-load-error-es");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(mockReloadPreflight).toHaveBeenCalledTimes(1);
  mockPreflight = { ...mockPreflight, isLoading: true };
  view.rerender(<ActualPreflight {...props} />);
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  mockPreflight = { ...mockPreflight, isLoading: false, hasLoaded: true, isSubmitting: true };
  view.rerender(<ActualPreflight {...props} />);
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  expect(mockSubmitPreflight).not.toHaveBeenCalled();
});

test("the actual daily check-in physician option inherits the ordinary consumer translation", async () => {
  await i18n.changeLanguage("es");
  render(<ActualDailyCheckin />);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
  fireEvent.click(screen.getByRole("button", { name: "Avisar a mi médico" }));
  captureReview("glp1-daily-expanded-es");
  fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));
  await waitFor(() => expect(mockSubmitPreflight).toHaveBeenCalledWith(expect.objectContaining({ notifyCareTeam: "physician" })));
});

test("all four hydration doors use translated descriptions, symptoms and liquid types without changing user fields", async () => {
  const state: any = { localDate: "2026-11-18", liquidProtocol: null };
  render(<HydrationFourDoorPanels state={state} navigate={mockNavigate} onReload={jest.fn()} />);
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByText("Organiza el apoyo en torno a tu actividad, sin una fórmula.")).toBeVisible();
  fireEvent.click(screen.getByTestId("hydration-door-athletic"));
  captureReview("hydration-athletic-es");
  fireEvent.click(screen.getByTestId("hydration-door-sick_day"));
  expect(screen.getByText("Náuseas")).toBeVisible();
  fireEvent.click(screen.getByTestId("sick-day-unable_to_keep_fluids"));
  expect(screen.getByTestId("sick-day-escalation")).toBeVisible(); // Original warning retained.
  captureReview("hydration-sick-es");
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByTestId("sick-day-unable_to_keep_fluids")).toBeChecked();
  fireEvent.click(screen.getByTestId("hydration-door-liquid_nutrition"));
  fireEvent.change(screen.getByTestId("liquid-protocol-original-text"), { target: { value: "ORIGINAL_CLINICIAN_WORDING" } });
  fireEvent.change(screen.getByTestId("liquid-protocol-type"), { target: { value: "full_liquid" } });
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByTestId("liquid-protocol-type")).toHaveValue("full_liquid");
  expect(screen.getByRole("option", { name: "Líquidos completos" })).toHaveValue("full_liquid");
  expect(screen.getByTestId("liquid-protocol-original-text")).toHaveValue("ORIGINAL_CLINICIAN_WORDING");
  captureReview("hydration-liquid-es");
  expect(createHydrationLiquidProtocol).not.toHaveBeenCalled();
});

test("loaded Hydration shows its ordinary policy heading and empty history with the original clinical boundary", async () => {
  await i18n.changeLanguage("es");
  mockHydration.mockResolvedValue({
    localDate: "2026-11-18", totalLoggedMl: 0, todayHistory: [], interventions: [],
    numericPolicy: { status: "TRACK_ONLY" },
  });
  render(<HydrationCenter />);
  expect(await screen.findByText("Registra sin una fórmula")).toBeVisible();
  expect(screen.getByText("No personal numeric target has been set by an authorized clinician. You can still track fluids and get practical help.")).toBeVisible();
  captureReview("hydration-loaded-es");
  expect(screen.getByRole("heading", { name: /Empieza aquí/i })).toBeVisible();
  captureReview("hydration-guide-es");
  expect(mockCreate).not.toHaveBeenCalled();
});

test("Athletic Hydration still hands off canonical English context, never its Spanish display copy", async () => {
  await i18n.changeLanguage("es");
  (createHydrationHandoff as jest.Mock).mockResolvedValue({ token: "offline-handoff" });
  render(<HydrationFourDoorPanels state={{ localDate: "2026-11-18" } as any} navigate={mockNavigate} onReload={jest.fn()} />);
  fireEvent.click(screen.getByTestId("hydration-door-athletic"));
  fireEvent.change(screen.getByTestId("athletic-hydration-phase"), { target: { value: "during" } });
  fireEvent.click(screen.getByTestId("athletic-hydration-creator"));
  await waitFor(() => expect(createHydrationHandoff).toHaveBeenCalledWith({
    door: "athletic",
    description: "Hydration context: during activity. Activity: training. Environment context: unknown. Do not invent hydration targets, electrolyte dosing, or medical treatment. Preserve all saved dietary and safety constraints.",
  }));
});

test("known Menu error text follows live language; unknown service detail and clinical messages remain original", async () => {
  const { result } = renderHook(() => useBatchOneErrorCopy());
  const base = "We couldn't complete three compatible ideas this time. Your settings were not changed.";
  const notice = "Your existing compatible choices are still available.";
  await act(async () => { await i18n.changeLanguage("es"); });
  const es = result.current(`${base} ${notice}`);
  expect(es).toBe("Esta vez no pudimos completar tres ideas compatibles. No se modificaron tus ajustes. Tus opciones compatibles existentes siguen disponibles.");
  expect(result.current("ORIGINAL_PROVIDER_DETAIL")).toBe("ORIGINAL_PROVIDER_DETAIL");
  expect(result.current("Your current GLP-1 guidance needs attention before creating meal ideas. Review it in the GLP-1 Hub.")).toContain("Your current");
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(result.current(es)).toBe(`${base} ${notice}`);
});

test("actual Menu failed-generation alert translates the known service message and retention notice", async () => {
  await i18n.changeLanguage("es");
  const previousFetch = global.fetch;
  const error = "We couldn't complete three compatible ideas this time. Your settings were not changed.";
  global.fetch = jest.fn(async (url: any, init: any = {}) => {
    if (String(url).startsWith("/api/my-perfect-menu/concepts") && init.method === "POST") return {
      ok: false, status: 422, json: async () => ({ error, message: error, previousChoicesAvailability: "withheld" }),
    };
    return previousFetch(url, init);
  }) as any;
  render(<MyPerfectMenu />);
  await waitFor(() => expect(screen.queryByText("Restaurando tus ideas de menú guardadas…")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /Ideas de desayuno/ }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Esta vez no pudimos completar tres ideas compatibles.");
  expect(alert).not.toHaveTextContent("We couldn't");
  captureReview("menu-error-es");
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(alert).toHaveTextContent(error);
  expect(mockGenerate).not.toHaveBeenCalled();
});

test("mounted success notifications and interpolated hydration labels switch without stale English", async () => {
  render(<GlycemicSettingsModal open onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Save Glucose Carb Preferences" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalled());
  const notification = mockToast.mock.calls.at(-1)![0];
  cleanup();
  render(<div role="status">{notification.title}<FluidLogNotice amount={12} unit="oz" beverageClass="tea" /></div>);
  expect(screen.getByRole("status")).toHaveTextContent("Glucose carb preferences saved");
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.getByRole("status")).toHaveTextContent("Preferencias de carbohidratos según la glucosa guardadas");
  expect(screen.getByRole("status")).toHaveTextContent("12 oz");
  expect(screen.getByRole("status")).not.toHaveTextContent("Tea");
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByRole("status")).toHaveTextContent("Glucose carb preferences saved");
});

test("exact built-in hydration suggestions localize for display without touching record or clinical suffix", async () => {
  const original = { optionKey: "visible-cue", title: "Use a visible cue", description: "Keep your usual cup or bottle where your next routine starts. ORIGINAL_CLINICAL_SUFFIX" };
  const { result } = renderHook(() => useHydrationInterventionDisplay());
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(result.current(original)).toEqual({
    ...original, title: "Usa un recordatorio visible",
    description: "Deja tu vaso o botella habitual donde comienza tu próxima rutina. ORIGINAL_CLINICAL_SUFFIX",
  });
  expect(original.title).toBe("Use a visible cue");
  const modified = { ...original, description: "ORIGINAL_MODIFIED_DESCRIPTION" };
  expect(result.current(modified).description).toBe(modified.description);
  const unknown = { ...original, optionKey: "ORIGINAL_UNKNOWN_OPTION" };
  expect(result.current(unknown)).toBe(unknown);
});
