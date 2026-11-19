/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import ts from "typescript";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { consumerSpanish } from "@/i18n/consumerJourney";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { resolveLanguagePreference, LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import { DailyMacroTotalsRow } from "@/components/DailyMacroTotalsRow";
import { DailyTargetsCard } from "@/components/biometrics/DailyTargetsCard";
import { RemainingMacrosFooter } from "@/components/biometrics/RemainingMacrosFooter";
import { DayChips } from "@/components/DayChips";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { GlobalMealActionBar } from "@/components/GlobalMealActionBar";
import { JustDescribeItModal } from "@/components/JustDescribeItModal";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import MealGenerationProgress from "@/components/MealGenerationProgress";
import { formatWeekLabel, formatDateDisplay } from "@/utils/midnight";
import { getMealGenerationCopy } from "@/lib/mealGenerationProgress";
import { BuilderHeader } from "@/components/pro/BuilderHeader";

const mockUser: any = { id: "offline-builder", performanceModeEnabled: false };
const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/fixture", mockNavigate], useSearch: () => "" }));
jest.mock("@/contexts/ProClientContext", () => ({ useProClient: () => ({
  client: { name: "UNCHANGED_CLIENT_NAME" }, isProCareMode: true,
}) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/hooks/useTodayMacros", () => ({ useTodayMacros: () => ({
  protein: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0,
}) }));
jest.mock("@/hooks/useStarchGuardPrecheck", () => ({ useStarchGuardPrecheck: () => ({
  alert: null, checkStarch: jest.fn(), clearAlert: jest.fn(), setDecision: jest.fn(),
}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/components/voice/VoiceInputButton", () => ({
  VoiceInputButton: ({ label }: any) => <button aria-label={label} />,
}));
jest.mock("@/components/StarchGuardIntercept", () => ({ StarchGuardIntercept: () => null }));
jest.mock("@/featureFlags", () => ({ FEATURES: { showCreateWithAI: true } }));

const date = "2026-11-16";
const targets = Object.freeze({ calories_kcal: 1634, protein_g: 129, carbs_g: 101,
  starchyCarbs_g: 37, fibrousCarbs_g: 64, fat_g: 78 });
const totals = Object.freeze({ calories: 600, protein: 60, carbs: 66, fat: 30,
  starchyCarbs: 41, fibrousCarbs: 25 });
beforeEach(() => {
  localStorage.clear();
  mockUser.performanceModeEnabled = false;
  mockUser.weeklyTrainingSchedule = null;
  global.fetch = jest.fn(() => { throw new Error("Unexpected network in offline builder fixture"); }) as any;
});
afterEach(() => { cleanup(); jest.useRealTimers(); });
const copy = (language: string, key: string) => language === "es" ? consumerSpanish[key] : key;

describe.each(["en", "es"])("%s shared builder display", language => {
  beforeEach(async () => { await i18n.changeLanguage(language); });

  test("daily summaries preserve target values, split, order, overages and missing evidence", () => {
    const before = JSON.stringify({ totals, targets });
    render(<DailyMacroTotalsRow totals={totals} prescription={null} targetsOverride={targets} activeDayISO={date} />);
    const summary = screen.getByTestId("builder-today-macros");
    expect([...summary.querySelectorAll("[data-macro]")].map(el => el.getAttribute("data-macro")))
      .toEqual(["calories", "protein", "carbs", "starchyCarbs", "fibrousCarbs", "fat"]);
    expect(summary.querySelector('[data-macro="starchyCarbs"]')?.textContent)
      .toBe(`${copy(language, "Starchy Carbs")} 41 / 37g (+4g ${language === "es" ? "por encima" : "over"})`);
    expect(summary.querySelector('[data-macro="fibrousCarbs"]')).toHaveTextContent(`${copy(language, "Fibrous Carbs")} 25 / 64g`);
    expect(JSON.stringify({ totals, targets })).toBe(before);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("uncertainty, estimated splits and authored evidence retain their meaning", () => {
    render(<DailyMacroTotalsRow totals={{ ...totals, estimated: true, unclassifiedCarbs: 7,
      uncertainFields: ["protein"], issues: ["ORIGINAL_EVIDENCE"] }}
      prescription={null} targetsOverride={targets} activeDayISO={date} />);
    expect(screen.getByText(/ORIGINAL_EVIDENCE/)).toHaveTextContent(copy(language, "Carb split estimated. ").trim());
    expect(screen.getByText(/ORIGINAL_EVIDENCE/)).toHaveTextContent(language === "es"
      ? "7g de otros carbohidratos o sin clasificar." : "7g other/unclassified carbs.");
    expect(screen.getByText(/ORIGINAL_EVIDENCE/)).toHaveTextContent("≥");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([false, true])("target card and its loading labels agree (loading=%s)", loading => {
    render(<DailyTargetsCard targetsOverride={targets} isLoading={loading} />);
    for (const key of ["Daily Targets", "Protein", "Total Carbs", "Starchy", "Fibrous", "Fat"])
      expect(screen.getByText(copy(language, key))).toBeVisible();
    if (!loading) for (const value of ["129g", "101g", "37g", "64g", "78g"])
      expect(screen.getByText(value)).toBeVisible();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("training badge uses existing session translations, not a dynamic resource path", () => {
    const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    mockUser.performanceModeEnabled = true;
    mockUser.weeklyTrainingSchedule = { [keys[new Date().getDay()]]: "strength" };
    render(<DailyTargetsCard targetsOverride={targets} />);
    expect(screen.getByText(language === "es" ? "Día de fuerza" : "Strength Day")).toBeVisible();
  });

  test("remaining macros retain exact arithmetic and uncertainty while labels translate", () => {
    render(<RemainingMacrosFooter consumedOverride={{ ...totals, uncertainFields: ["protein"] }}
      targetsOverride={targets} layoutMode="inline" />);
    expect(screen.getByText("+4")).toBeVisible();
    expect(screen.getByText("39")).toBeVisible();
    expect(screen.getByText(copy(language, "Incomplete"))).toBeVisible();
    expect(screen.getByText(i18n.t("remainingMacros.starchy"))).toBeVisible();
    expect(screen.getByText(i18n.t("remainingMacros.fibrous"))).toBeVisible();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("calendar translates dates on the same canonical day and preserves navigation IDs", () => {
    const change = jest.fn();
    render(<DayChips weekDates={[date, "2026-11-17"]} activeDayISO={date} onDayChange={change} />);
    expect(screen.getByText(language === "es" ? "lun" : "Mon")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(change).toHaveBeenCalledWith("2026-11-17");
    expect(formatWeekLabel(date, "America/Chicago", language)).toBe(language === "es" ? "16 nov–22 nov" : "Nov 16–Nov 22");
    expect(formatDateDisplay(date, { weekday: "long" }, "America/Chicago", language))
      .toBe(language === "es" ? "lunes" : "Monday");
  });

  test("duplicate dialog translates selection/count and returns unchanged ISO dates", () => {
    const confirm = jest.fn();
    render(<DuplicateDayModal isOpen onClose={jest.fn()} onConfirm={confirm}
      sourceDateISO={date} availableDates={[date, "2026-11-17", "2026-11-18"]} />);
    expect(screen.getByText(language === "es" ? "Duplicar lunes" : "Duplicate Monday")).toBeVisible();
    const duplicate = screen.getByTestId("duplicate-confirm-button");
    expect(duplicate).toBeDisabled();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(duplicate).toHaveTextContent(language === "es" ? "Duplicar a 1 día" : "Duplicate to 1 day");
    fireEvent.click(screen.getByRole("button", { name: copy(language, "Select All") }));
    expect(duplicate).toHaveTextContent(language === "es" ? "Duplicar a 2 días" : "Duplicate to 2 days");
    fireEvent.click(duplicate);
    expect(confirm).toHaveBeenCalledWith(["2026-11-17", "2026-11-18"]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("shared actions translate favorites, description and snack controls without generating", () => {
    const favorites = jest.fn(), chef = jest.fn(), snack = jest.fn();
    const view = render(<GlobalMealActionBar slot="lunch" onCreateWithAI={jest.fn()} onCreateWithChef={chef}
      onFavorites={favorites} onSave={jest.fn()} />);
    expect(screen.getByText(copy(language, "Describe It"))).toBeVisible();
    fireEvent.click(screen.getByTitle(copy(language, "Pick from My Favorites")));
    expect(favorites).toHaveBeenCalledTimes(1);
    expect(chef).not.toHaveBeenCalled();
    view.rerender(<GlobalMealActionBar slot="snacks" onCreateWithAI={jest.fn()} onCreateWithChef={chef}
      onSnackCreator={snack} onSave={jest.fn()} />);
    expect(screen.getByText(copy(language, "Snack Creator"))).toBeVisible();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("shared header translates navigation without changing client identity or exit destination", () => {
    render(<BuilderHeader title="ORIGINAL_BUILDER_TITLE" onOpenTour={jest.fn()} clientId="offline-client" />);
    expect(screen.getByText(language === "es" ? "Trabajando con: UNCHANGED_CLIENT_NAME" : "Working with: UNCHANGED_CLIENT_NAME")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: copy(language, "Exit Client") }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/pro/clients/offline-client");
    expect(screen.getByRole("heading")).toHaveTextContent("ORIGINAL_BUILDER_TITLE");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("description input is translated but never submitted or rewritten by locale changes", () => {
    render(<JustDescribeItModal open onClose={jest.fn()} onAdd={jest.fn()} />);
    expect(screen.getByRole("heading", { name: copy(language, "Just Describe It") })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "UNCHANGED_USER_DESCRIPTION" } });
    expect(screen.getByRole("textbox")).toHaveValue("UNCHANGED_USER_DESCRIPTION");
    expect(screen.getByRole("button", { name: copy(language, "Estimate") })).toBeEnabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("restored description results translate portion choices without changing stored nutrition", () => {
    const saved = { description: "SAVED_DESCRIPTION", estimate: { ...totals, description: "SAVED_DESCRIPTION" },
      portion: "typical", logged: false, generatedAt: "2026-11-16T12:00:00Z" };
    const raw = JSON.stringify(saved);
    localStorage.setItem("mpm.justDescribeIt.v1", raw);
    render(<JustDescribeItModal open onClose={jest.fn()} onAdd={jest.fn()} />);
    expect(screen.getByText('"SAVED_DESCRIPTION"')).toBeVisible();
    for (const size of ["smaller", "typical", "larger"])
      expect(screen.getByRole("button", { name: copy(language, size) })).toBeVisible();
    expect(screen.getByText("41g")).toBeVisible();
    expect(screen.getByText("25g")).toBeVisible();
    const restored = JSON.parse(localStorage.getItem("mpm.justDescribeIt.v1")!);
    expect({ ...restored, generatedAt: saved.generatedAt }).toEqual(saved);
    expect(Number.isNaN(Date.parse(restored.generatedAt))).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("progress rotates translated copy; protected diabetes and GLP-1 messages stay English", () => {
    jest.useFakeTimers();
    const view = render(<MealGenerationProgress context="general" />);
    expect(screen.getByRole("status")).toHaveTextContent(copy(language, "Chef is crafting your meal…"));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByRole("status")).toHaveTextContent(copy(language, "Reviewing your dietary preferences…"));
    for (const context of ["diabetes", "glp1"] as const) {
      view.rerender(<MealGenerationProgress context={context} />);
      expect(screen.getByRole("status")).toHaveTextContent(getMealGenerationCopy(context).messages[0]);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("weekly overview keeps the supplied board and jump behavior unchanged", () => {
    const jump = jest.fn();
    render(<WeeklyOverviewModal open onClose={jest.fn()} board={null} weekStartISO={date} onJumpToDay={jump} />);
    expect(screen.getByRole("heading", { name: copy(language, "Week Overview") })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Ir a lun" : "Go to Mon" }));
    expect(jump).toHaveBeenCalledWith(date);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

test.each([["es", "en-US", "es"], ["en", "es-MX", "en"], ["auto", "es-MX", "es"], ["auto", "en-US", "en"]])(
  "builder presentation follows %s on %s without replacing stored intent", async (preference, device, expected) => {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
    await i18n.changeLanguage(resolveLanguagePreference(preference, device));
    render(<DailyTargetsCard targetsOverride={targets} />);
    expect(screen.getByText(copy(expected, "Daily Targets"))).toBeVisible();
    expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
    expect(global.fetch).not.toHaveBeenCalled();
  },
);

// Evaluate only existing source-owned display expressions, not the authenticated
// page module or its persistence hooks. This is not a mounted full-page test.
const generalFile = "client/src/pages/pro/GeneralNutritionBuilder.tsx";
const general = ts.createSourceFile(generalFile, fs.readFileSync(generalFile, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function sourceExpression(predicate: (node: ts.Node) => boolean) {
  let result: ts.Node | undefined;
  function visit(node: ts.Node) { if (predicate(node)) result = node; ts.forEachChild(node, visit); }
  visit(general);
  if (!result) throw new Error("General Nutrition display expression missing");
  return result.getText(general);
}
function evaluate(expression: string, scope: Record<string, unknown>) {
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: {
    jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, alwaysStrict: false,
  } }).outputText;
  return new Function("scope", `with (scope) { ${js} }`)(scope);
}
test.each(["en", "es"])("%s real General Nutrition display wiring renders translated chrome", async language => {
  await i18n.changeLanguage(language);
  const header = sourceExpression(n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(general) === "BuilderHeader");
  const loading = sourceExpression(n => ts.isJsxElement(n) &&
    n.openingElement.tagName.getText(general) === "div" && n.getText(general).startsWith('<div className="text-white/80 p-6 text-center">'));
  const lists = sourceExpression(n => ts.isVariableDeclaration(n) && n.name.getText(general) === "lists");
  const listCall = lists.slice(lists.indexOf("=> [") + 3, lists.lastIndexOf(", [t])"));
  function Fixture() {
    const { t } = useConsumerCopy();
    const scope = { React, t, quickTour: { openTour: jest.fn() }, isProCareMode: false,
      clientId: "offline", user: mockUser, getBuilderProtocolBadges: () => [],
      BuilderHeader: ({ title }: any) => <h1>{title}</h1> };
    return <>{evaluate(header, scope)}{evaluate(loading, scope)}
      {evaluate(listCall, scope).map(([key, label]: string[]) => <h2 key={key}>{label}</h2>)}</>;
  }
  render(<Fixture />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("generalNutritionBuilder.pageTitle"));
  expect(screen.getByText(i18n.t("metabolicBuilder.loadingBoard"))).toBeVisible();
  expect(within(document.body).getAllByRole("heading", { level: 2 }).map(el => el.textContent))
    .toEqual(Array.from({ length: 6 }, (_, i) => i18n.t(`metabolicBuilder.meal${i + 1}`)));
  expect(global.fetch).not.toHaveBeenCalled();
});
