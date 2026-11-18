/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { consumerDailyDisplaySpanish, nutritionSummaryLabelSources } from "@/i18n/consumerDailyDisplayCopy";
import GetInspiration from "@/pages/GetInspiration";
import { NutritionPersonalizationSummaryCard } from "@/components/protocol/NutritionPersonalizationSummaryCard";
import type { NutritionPersonalizationSummary } from "@/types/nutritionSummary";

const mockToast = jest.fn(), mockNavigate = jest.fn(), mockSummary = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/hooks/useNutritionSummary", () => ({ useNutritionSummary: (...args: unknown[]) => mockSummary(...args) }));
jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", mockNavigate] }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, initial, animate, transition, ...props }: any) => <div {...props}>{children}</div> },
}));

const language = createInstance();
beforeAll(async () => {
  await language.use(initReactI18next).init({
    lng: "es", fallbackLng: "en", defaultNS: "consumerJourney",
    interpolation: { escapeValue: false },
    resources: {
      en: { consumerJourney: consumerEnglish },
      es: { consumerJourney: consumerSpanish },
    },
  });
});
beforeEach(async () => {
  cleanup(); localStorage.clear(); jest.clearAllMocks();
  mockSummary.mockReturnValue({});
  await language.changeLanguage("es");
  localStorage.setItem("dailyQuote", "Small wins stack up. Celebrate each one.");
  localStorage.setItem("quoteDate", new Date().toDateString());
});
afterEach(cleanup);
const mount = (ui: React.ReactElement) => render(<I18nextProvider i18n={language}>{ui}</I18nextProvider>);
const switchLanguage = (lng: string) => act(async () => { await language.changeLanguage(lng); });
const originalEntry = () => ({
  id: "offline-journal-entry", date: "ORIGINAL_SAVED_DATE",
  timestamp: Date.now() - 60_000, content: "Save Entry",
});
const summary = (): NutritionPersonalizationSummary => ({
  activeInputs: {
    health: [
      { key: "glp-1", label: "GLP-1 Protocol", priority: "high" },
      { key: "therapeutic-support", label: "Therapeutic Support", priority: "moderate" },
    ],
    macros: null, performance: null, pregnancy: null, therapeutic: null, dietary: [],
    cuisine: "Thai Cuisine", goal: "Weight Maintenance",
  },
  dietaryIdentity: [], mealBuilderLabel: "GLP-1 Builder",
  nutritionDrivers: {
    medicalConditions: [], liveMetrics: [],
    therapeuticInputs: [{ name: "ORIGINAL_MEDICATION", dose: "200 mg/week" }],
  },
  nutritionPriorities: [
    "Therapeutic nutrition support", "Portion density priority",
    "High protein, low fat meals", "No carbonated beverages",
  ],
  compositeExplanation: "ORIGINAL_CLINICAL_EXPLANATION", conflictPolicy: "ORIGINAL_CLINICAL_POLICY",
  hasAnyActiveProtocol: true, carbCycleActive: false, alphaGal: null,
  hydration: {
    tracking: { status: "TRACK_ONLY", targetKind: null, targetMl: null, minimumMl: null, maximumMl: null, validThrough: null },
    liquidNutrition: null, href: "/hydration",
  },
  meta: { generatedAt: "2026-11-18T00:00:00.000Z" },
});

it("provides centralized English/Spanish parity and labels for every allowed plan value", () => {
  for (const [source, spanish] of Object.entries(consumerDailyDisplaySpanish)) {
    expect(consumerEnglish[source]).toBe(source);
    expect(consumerSpanish[source]).toBeTruthy();
    expect(spanish).not.toBe(source);
  }
  for (const source of nutritionSummaryLabelSources) expect(consumerSpanish[source]).toBeTruthy();
});

it("renders the dashboard screenshot labels in Spanish without altering the plan or medication", async () => {
  const data = summary(), snapshot = JSON.stringify(data);
  mount(<NutritionPersonalizationSummaryCard source="provided" summary={data} defaultExpanded />);
  for (const label of [
    "Protocolo de GLP-1", "Apoyo terapéutico", "Cocina tailandesa", "Mantenimiento del peso",
    "Creador de comidas de GLP-1", "Hidratación",
    "Seguimiento activo: no se ha establecido un objetivo numérico.",
    "Apoyo nutricional terapéutico", "Prioridad de densidad de las porciones",
    "Comidas ricas en proteínas y bajas en grasa", "Sin bebidas con gas",
  ]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  expect(screen.getByText("ORIGINAL_MEDICATION")).toBeVisible();
  expect(screen.getByText("(200 mg/week)")).toBeVisible();
  expect(screen.getByText("ORIGINAL_CLINICAL_EXPLANATION")).toBeVisible();
  expect(screen.getByText("ORIGINAL_CLINICAL_POLICY")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Abrir hidratación" }));
  expect(mockNavigate).toHaveBeenCalledWith("/hydration");
  expect(mockSummary).toHaveBeenCalledWith(false);
  await switchLanguage("en");
  expect(screen.getByText("Thai Cuisine")).toBeVisible();
  expect(screen.getByText("Tracking active — no numeric target established.")).toBeVisible();
  expect(JSON.stringify(data)).toBe(snapshot);
});

it("does not translate unknown professional labels even when they match another interface key", () => {
  const data = summary();
  data.activeInputs.cuisine = "Save Entry";
  data.activeInputs.goal = "ORIGINAL_CUSTOM_GOAL";
  data.nutritionPriorities = ["ORIGINAL_CUSTOM_PRIORITY"];
  mount(<NutritionPersonalizationSummaryCard source="provided" summary={data} defaultExpanded />);
  expect(screen.getByText("Save Entry")).toBeVisible();
  expect(screen.getByText("ORIGINAL_CUSTOM_GOAL")).toBeVisible();
  expect(screen.getByText("ORIGINAL_CUSTOM_PRIORITY")).toBeVisible();
});

it("localizes active-plan date labels without changing supplied dates or amounts", () => {
  const data = summary();
  data.hydration!.tracking = {
    status: "NUMERIC_ACTIVE", targetKind: "point", targetMl: 1000,
    minimumMl: null, maximumMl: null, validThrough: "2026-11-20T12:00:00.000Z",
  };
  data.hydration!.liquidNutrition = {
    status: "active", startsOn: "2026-11-18", endsOn: "2026-11-20",
    currentDay: 2, verificationStatus: "verified",
  };
  const original = JSON.stringify(data);
  mount(<NutritionPersonalizationSummaryCard source="provided" summary={data} defaultExpanded />);
  expect(screen.getByText(/Activo hasta el/)).toBeVisible();
  expect(screen.getByText(/Día 2 · Finaliza el/)).toBeVisible();
  expect(JSON.stringify(data)).toBe(original);
});

it("translates journal labels, cached built-in quotes and dates, never saved journal prose", async () => {
  const entry = originalEntry(), serialized = JSON.stringify([entry]);
  localStorage.setItem("dailyJournalEntries", serialized);
  mount(<GetInspiration />);
  expect(await screen.findByText("Entradas anteriores")).toBeVisible();
  expect(screen.getByText("Diario de salud")).toBeVisible();
  expect(screen.getByText("Las pequeñas victorias se acumulan. Celebra cada una.", { exact: false })).toBeVisible();
  expect(screen.getByRole("button", { name: /Entrada por voz/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Guardar entrada/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /Exportar el diario como archivo de texto/ })).toBeVisible();
  expect(screen.getByText("Save Entry")).toBeVisible();
  const dateOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" };
  expect(screen.getByText(new Date(entry.timestamp).toLocaleDateString("es", dateOptions))).toBeVisible();
  fireEvent.change(screen.getByTestId("inspire-journal-input"), { target: { value: "ORIGINAL_UNSAVED_DRAFT" } });
  await switchLanguage("en");
  expect(screen.getByTestId("inspire-journal-input")).toHaveValue("ORIGINAL_UNSAVED_DRAFT");
  expect(screen.getByText("Past Entries")).toBeVisible();
  expect(screen.getByText(new Date(entry.timestamp).toLocaleDateString("en", dateOptions))).toBeVisible();
  expect(localStorage.getItem("dailyJournalEntries")).toBe(serialized);
  expect(localStorage.getItem("dailyQuote")).toBe("Small wins stack up. Celebrate each one.");
});

it("keeps original dates when an old journal entry has no usable timestamp", async () => {
  localStorage.setItem("dailyJournalEntries", JSON.stringify([{ ...originalEntry(), timestamp: null }]));
  mount(<GetInspiration />);
  expect(await screen.findByText("ORIGINAL_SAVED_DATE")).toBeVisible();
});

it("saves and deletes only the chosen synthetic journal entry through the unchanged controls", async () => {
  const original = originalEntry();
  localStorage.setItem("dailyJournalEntries", JSON.stringify([original]));
  mount(<GetInspiration />);
  await screen.findByText("Save Entry");
  fireEvent.change(screen.getByTestId("inspire-journal-input"), { target: { value: "NEW_ORIGINAL_JOURNAL_TEXT" } });
  fireEvent.click(screen.getByRole("button", { name: /Guardar entrada/ }));
  const saved = JSON.parse(localStorage.getItem("dailyJournalEntries")!);
  expect(saved).toHaveLength(2);
  expect(saved[0].content).toBe("NEW_ORIGINAL_JOURNAL_TEXT");
  expect(saved[1]).toEqual(original);
  expect(screen.getByTestId("inspire-journal-input")).toHaveValue("");
  mount(<div data-testid="journal-toast-copy">{mockToast.mock.calls.at(-1)![0].title}{mockToast.mock.calls.at(-1)![0].description}</div>);
  expect(screen.getByTestId("journal-toast-copy")).toHaveTextContent("¡Entrada guardada!");
  await switchLanguage("en");
  expect(screen.getByTestId("journal-toast-copy")).toHaveTextContent("Entry saved!");
  fireEvent.click(screen.getByTestId(`button-delete-${saved[0].id}`));
  expect(JSON.parse(localStorage.getItem("dailyJournalEntries")!)).toEqual([original]);
});

it("exports original records with the translated export action", async () => {
  const entry = originalEntry(), serialized = JSON.stringify([entry]);
  localStorage.setItem("dailyJournalEntries", serialized);
  const createUrl = jest.fn((_blob: Blob) => "blob:offline-journal");
  const revokeUrl = jest.fn();
  const previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
  URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl;
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    mount(<GetInspiration />);
    fireEvent.click(await screen.findByRole("button", { name: /Exportar el diario como archivo de texto/ }));
    const exported = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(createUrl.mock.calls[0][0]);
    });
    expect(exported).toContain(entry.date);
    expect(exported).toContain(entry.content);
    expect(revokeUrl).toHaveBeenCalledWith("blob:offline-journal");
    expect(localStorage.getItem("dailyJournalEntries")).toBe(serialized);
  } finally {
    URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke; click.mockRestore();
  }
});
