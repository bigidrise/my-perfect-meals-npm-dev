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

const mockNavigate = jest.fn(), mockToast = jest.fn(), mockSavePreferences = jest.fn();
const mockCreate = jest.fn(), mockUpdate = jest.fn(), mockDelete = jest.fn(), mockWater = jest.fn();
const mockCancel = jest.fn(), mockGenerate = jest.fn(), mockHouseholdSwitch = jest.fn(), mockHydration = jest.fn();
const mockGlucose = jest.fn();
const mockGlycemicData = { bloodGlucose: 105, lowRangeCarbs: ["LEGACY_FOOD"], midRangeCarbs: [], highRangeCarbs: [] };
const mockShot = { id: "offline-shot", dateUtc: "2026-11-18T15:07:00Z", doseMg: 2.5, medicationName: "Zepbound", location: "thigh", notes: "ORIGINAL_SAVED_NOTES" };
const mockShots = [mockShot];
const mockGlucoseLogs = { data: [{ valueMgdl: 100, context: "FASTED", recordedAt: "2026-11-18T15:07:00Z" }] };
const mockBuilder = { key: "general_nutrition", namespace: "generalNutrition", displayName: "General Nutrition Builder", generationMode: "builder" };
const mockConcepts = Array.from({ length: 3 }, (_, index) => ({
  id: `idea-${index}`, ideaType: "breakfast", title: `ORIGINAL_IDEA_${index}`, description: "ORIGINAL_GENERATED_DESCRIPTION",
}));
let mockSearch = "";

jest.mock("@/lib/developmentRuntimeFlag", () => ({ isDevelopmentRuntime: false }));
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
jest.mock("@/hooks/useGLP1CurrentUse", () => ({ useGLP1CurrentUse: () => ({ data: { effectiveActive: false }, isError: false, isLoading: false }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ isClinicalOrAbove: () => false }));
jest.mock("@/hooks/useCreateWithChefRequest", () => ({ useCreateWithChefRequest: () => ({ generateMeal: mockGenerate, cancel: mockCancel }) }));
jest.mock("@/hooks/useSnackCreatorRequest", () => ({ useSnackCreatorRequest: () => ({ generateSnack: mockGenerate, cancel: mockCancel }) }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock("@/components/copilot/CopilotBrain", () => ({ CopilotBrain: () => null }));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
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
  await i18n.changeLanguage("en");
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
  view.unmount();
  view = render(<GlycemicSettingsModal open onClose={jest.fn()} />);
  expect(screen.getAllByRole("button", { name: language === "es" ? "Frutos rojos" : "Berries" })).toHaveLength(3);
  expect(screen.getByText("Glucose-Based Carb Choices")).toBeVisible(); // Registry-protected.
  view.unmount();
  view = render(<HydrationCenter />);
  expect(screen.getByTestId("hydration-door-everyday")).toHaveTextContent(language === "es" ? "Hidratación cotidiana" : "Everyday Hydration");
  expect(screen.getByTestId("basic-hydration-submit")).toHaveTextContent(language === "es" ? "Registrar líquido" : "Log fluid");
  view.unmount();
  view = render(<DiabeticHub />);
  expect(screen.getByText(language === "es" ? "Lecturas recientes" : "Recent Readings")).toBeVisible();
  expect(screen.getByText(language === "es" ? "(En ayunas)" : "(Fasted)")).toBeVisible();
  view.unmount();
  render(<MyPerfectMenu />);
  expect(await screen.findByText(language === "es" ? "¿Qué te apetece?" : "What sounds good?")).toBeVisible();
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
