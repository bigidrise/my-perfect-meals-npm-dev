/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { resolveLanguagePreference, LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";
import { formatWeekLabel, formatDateDisplay } from "@/utils/midnight";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { DayChips } from "@/components/DayChips";
import { DailyMacroTotalsRow } from "@/components/DailyMacroTotalsRow";
import { DailyTargetsCard } from "@/components/biometrics/DailyTargetsCard";
import { Button } from "@/components/ui/button";
import { ChefHat, Sparkles } from "lucide-react";

const mockNavigate = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/fixture", mockNavigate], useSearch: () => "" }));
jest.mock("@/contexts/ProClientContext", () => ({ useProClient: () => ({ client: null, isProCareMode: false }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@/hooks/useTodayMacros", () => ({ useTodayMacros: () => ({
  protein: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0,
}) }));

const builders = [
  ["Anti-Inflammatory", "physician/AntiInflammatoryMenuBuilder", "antiInflammatoryBuilder"],
  ["Diabetic", "physician/DiabeticMenuBuilder", "diabeticBuilder"],
  ["GLP-1", "physician/GLP1MealBuilder", "metabolicBuilder"],
  ["Performance", "pro/PerformanceCompetitionBuilder", "performanceCompetitionBuilder"],
] as const;
const sources = builders.map(([, file]) => {
  const filename = `client/src/pages/${file}.tsx`;
  return ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
});
const date = "2026-11-16";
const targets = Object.freeze({ calories_kcal: 1634, protein_g: 129, carbs_g: 101,
  starchyCarbs_g: 37, fibrousCarbs_g: 64, fat_g: 78 });
const totals = Object.freeze({ calories: 600, protein: 60, carbs: 66, fat: 30, starchyCarbs: 41, fibrousCarbs: 25 });

function nodes(source: ts.SourceFile, predicate: (node: ts.Node) => boolean) {
  const result: ts.Node[] = [];
  function visit(node: ts.Node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(source);
  return result;
}
function first(source: ts.SourceFile, predicate: (node: ts.Node) => boolean) {
  const result = nodes(source, predicate)[0];
  if (!result) throw new Error(`Missing source-owned display expression in ${source.fileName}`);
  return result;
}
// Read actual page JSX/notification expressions. Never import authenticated
// page modules, mount persistence hooks, make provider calls or write accounts.
function evaluate(expression: string, scope: Record<string, unknown>) {
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: {
    jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, alwaysStrict: false,
  } }).outputText;
  return new Function("scope", `with (scope) { ${js} }`)(scope);
}
function useScope(overrides: Record<string, unknown> = {}) {
  const { t } = useConsumerCopy();
  return { React, t, i18n, BuilderHeader, Button, ChefHat, Sparkles, key: "breakfast", formatWeekLabel, formatDateDisplay,
    quickTour: { openTour: jest.fn() }, proClientId: null, clientId: null, mode: "personal",
    user: null, getBuilderProtocolBadges: () => [], activePrimaryBadge: null,
    resolvedProtocol: { modifierBadges: [] }, extraDerivedBadges: [], supplementalBadges: [],
    weekStartISO: date, activeDayISO: date, onPrevWeek: jest.fn(), onNextWeek: jest.fn(),
    ...overrides };
}
function header(source: ts.SourceFile) {
  return first(source, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(source) === "BuilderHeader");
}
function calendar(source: ts.SourceFile) {
  return first(source, n => ts.isJsxElement(n) && n.children.some(c =>
    ts.isJsxExpression(c) && !!c.expression && c.expression.getText(source).startsWith(
      source.fileName.includes("Performance") ? "formatWeekLabel(" : "weekStartISO ? formatWeekLabel(",
    ))).parent;
}
function listExpression(source: ts.SourceFile) {
  const declaration = first(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === "lists"
    && !!n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(source) === "useMemo") as ts.VariableDeclaration;
  return ((declaration.initializer as ts.CallExpression).arguments[0] as ts.ArrowFunction).body;
}
function displayNodes(source: ts.SourceFile) {
  return nodes(source, n => ts.isJsxElement(n) && (
    ["h2", "p"].includes(n.openingElement.tagName.getText(source)) &&
    n.children.some(c => ts.isJsxExpression(c) && !!c.expression && /t\("(metabolicBuilder.snacks|Training Nutrition Schedule|Adjust daily macro targets)/.test(c.expression.getText(source)))
  ));
}
function Chrome({ index }: { index: number }) {
  const source = sources[index], scope = useScope();
  return <>{evaluate(header(source).getText(source), scope)}
    <main className="mx-auto max-w-3xl px-4 pt-28 pb-12 space-y-4">
      <section className="rounded-2xl bg-zinc-900 p-4 flex justify-center">{evaluate(calendar(source).getText(source), scope)}</section>
      <DayChips weekDates={[date, "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]}
        activeDayISO={date} onDayChange={jest.fn()} />
      <DailyTargetsCard targetsOverride={targets} />
      <DailyMacroTotalsRow totals={totals} prescription={null} targetsOverride={targets} activeDayISO={date} />
      <section className="rounded-2xl bg-zinc-900 p-4 space-y-3">
        {displayNodes(source).map((node, index) => <React.Fragment key={index}>{evaluate(node.getText(source), scope)}</React.Fragment>)}
        {index === 3 && nodes(source, n => ts.isJsxElement(n) && n.openingElement.tagName.getText(source) === "Button"
          && n.children.some(c => ts.isJsxExpression(c) && !!c.expression && c.expression.getText(source) === 't("Create with Chef")'))
          .map((node, index) => <React.Fragment key={index}>{evaluate(node.getText(source), scope)}</React.Fragment>)}
        {evaluate(listExpression(source).getText(source), scope).map(([id, label]: string[]) =>
          <h2 className="text-lg font-medium text-white/90" key={id} data-slot={id}>{label}</h2>)}
        <p data-authored-content className="text-white">ORIGINAL_RECIPE_TITLE • receta escrita por la persona</p>
      </section>
    </main>
  </>;
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(() => { throw new Error("Unexpected network in offline builder display test"); }) as any;
});
afterEach(cleanup);

describe.each(builders.map((builder, index) => [builder[0], index] as const))("%s page-owned interface", (_name, index) => {
  test.each([
    ["en", "es-MX", "en"], ["es", "en-US", "es"],
    ["auto", "es-MX", "es"], ["auto", "en-US", "en"],
  ])("%s on %s renders source-owned chrome without replacing intent", async (preference, device, language) => {
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
    await i18n.changeLanguage(resolveLanguagePreference(preference, device));
    const before = JSON.stringify({ targets, totals });
    const view = render(<Chrome index={index} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t(`${builders[index][2]}.pageTitle`));
    expect(screen.getByText(language === "es" ? "16 nov–22 nov" : "Nov 16–Nov 22")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Objetivos diarios" : "Daily Targets")).toBeVisible();
    const slots = Array.from(view.container.querySelectorAll("[data-slot]"));
    expect(slots.map(el => el.getAttribute("data-slot"))).toEqual(["breakfast", "lunch", "dinner", "meal4", "meal5", "meal6"]);
    expect(slots.map(el => el.textContent)).toEqual(Array.from({ length: 6 }, (_, i) => i18n.t(`metabolicBuilder.meal${i + 1}`)));
    expect(view.container.querySelector("[data-authored-content]")).toHaveTextContent("ORIGINAL_RECIPE_TITLE • receta escrita por la persona");
    expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe(preference);
    expect(JSON.stringify({ targets, totals })).toBe(before);
    expect(global.fetch).not.toHaveBeenCalled();

    // Optional review assets are static real-component markup with compiled
    // application CSS, no scripts, links, external assets, API or auth runtime.
    const directory = process.env.SPANISH_BUILDER_FIXTURE_DIR;
    if (directory) {
      const cssDirectory = path.join(directory, "../client/assets");
      const css = fs.readdirSync(cssDirectory).filter(file => file.endsWith(".css"))
        .map(file => fs.readFileSync(path.join(cssDirectory, file), "utf8")).join("\n");
      fs.mkdirSync(directory, { recursive: true });
      const file = `${index}-${preference}-${language}.html`;
      fs.writeFileSync(path.join(directory, file), `<!doctype html><html lang="${language}"><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'">
        <title>${builders[index][0]} – ${preference}/${language} static component review</title>
        <style>${css}</style></head><body class="bg-black text-white">${view.container.innerHTML}</body></html>`);
    }
  });

  test.each(["en", "es"])("%s calendar callbacks and lock notice preserve ISO identity", async language => {
    await i18n.changeLanguage(language);
    const onPrevWeek = jest.fn(), onNextWeek = jest.fn();
    function Calendar() { const scope = useScope({ onPrevWeek, onNextWeek }); return evaluate(calendar(sources[index]).getText(sources[index]), scope); }
    render(<Calendar />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("metabolicBuilder.prevWeek") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("metabolicBuilder.nextWeek") }));
    expect(onPrevWeek).toHaveBeenCalledTimes(1);
    expect(onNextWeek).toHaveBeenCalledTimes(1);
    const expression = first(sources[index], n => ts.isCallExpression(n) && n.expression.getText(sources[index]) === "t"
      && n.arguments[0]?.getText(sources[index]) === '"{{date}} has been locked."');
    function LockMessage() { const scope = useScope(); return <p>{evaluate(expression.getText(sources[index]), scope)}</p>; }
    render(<LockMessage />);
    expect(screen.getByText(language === "es" ? "Se ha bloqueado el día lunes, 16 nov." : "Monday, Nov 16 has been locked.")).toBeVisible();
    expect(date).toBe("2026-11-16");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

test.each(["en", "es"])("%s GLP-1 duplicate results translate all branches and preserve counts", async language => {
  await i18n.changeLanguage(language);
  const source = sources[2];
  const handler = first(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === "handleDuplicateDay") as ts.VariableDeclaration;
  const callback = (handler.initializer as ts.CallExpression).arguments[0];
  for (const result of [
    { currentWeekDayCount: 1, otherWeeksSaved: 1, totalDays: 3, errors: ["fixture"] },
    { currentWeekDayCount: 0, otherWeeksSaved: 2, totalDays: 2, errors: [] },
    { currentWeekDayCount: 1, otherWeeksSaved: 2, totalDays: 3, errors: [] },
    { currentWeekDayCount: 2, otherWeeksSaved: 0, totalDays: 2, errors: [] },
  ]) {
    const toast = jest.fn(), duplicateAcrossWeeks = jest.fn(async () => result);
    function Notification() {
      const scope = useScope({ board: { lists: {} }, activeDayISO: date, isDayLocked: () => false, effectiveUserId: "offline",
        getDayLists: () => ({}), duplicateAcrossWeeks, BUILDER_NS: { GLP1: "glp1" }, saveBoard: jest.fn(), toast });
      return <button onClick={() => evaluate(callback.getText(source), scope)(["2026-11-17", "2026-11-18"])}>duplicate</button>;
    }
    const view = render(<Notification />);
    await act(async () => { fireEvent.click(screen.getByText("duplicate")); });
    expect(duplicateAcrossWeeks).toHaveBeenCalledWith(expect.objectContaining({ targetDates: ["2026-11-17", "2026-11-18"], namespace: "glp1" }));
    const description = toast.mock.calls[0][0].description;
    expect(description).not.toContain("{{");
    expect(description).toMatch(language === "es" ? /días?|semanas?/ : /days?|weeks?/);
    if (result.errors.length) expect(description).toContain("2");
    view.unmount();
  }
});

test.each(builders.map((builder, index) => [builder[0], index] as const))(
  "%s existing duplicate callback follows an in-place language change", async (_name, index) => {
    await i18n.changeLanguage("en");
    const source = sources[index];
    const declaration = first(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === "handleDuplicateDay") as ts.VariableDeclaration;
    const toast = jest.fn(), board = { lists: {} }, saveBoard = jest.fn();
    const duplicateAcrossWeeks = jest.fn(async () => ({ currentWeekDayCount: 2, otherWeeksSaved: 0, totalDays: 2, errors: [] }));
    function Notification() {
      const scope = useScope({ useCallback: React.useCallback, board, saveBoard, toast, duplicateAcrossWeeks,
        effectiveUserId: "offline", namespace: "anti_inflammatory", isDayLocked: () => false, getDayLists: () => ({}),
        BUILDER_NS: { GLP1: "glp1", ANTI: "anti", DIABETIC: "diabetic", PERFORMANCE: "performance" } });
      const callback = evaluate(declaration.initializer!.getText(source), scope);
      return <button onClick={() => callback(["2026-11-17", "2026-11-18"])}>duplicate</button>;
    }
    render(<Notification />);
    await act(async () => { fireEvent.click(screen.getByText("duplicate")); });
    expect(toast.mock.calls[0][0].description).toContain("day(s)");
    await act(async () => { await i18n.changeLanguage("es"); });
    await act(async () => { fireEvent.click(screen.getByText("duplicate")); });
    expect(toast.mock.calls[1][0].description).toContain("día(s)");
    expect(duplicateAcrossWeeks).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalled();
  },
);

test.each(["en", "es"])("%s result messages retain authored recipe names, slot IDs and macro counts", async language => {
  await i18n.changeLanguage(language);
  for (const [index, key, overrides, expected] of [
    [0, "metabolicBuilder.aiMealCreatedDesc", { generatedMeal: { name: "ORIGINAL_RECIPE" }, slot: "breakfast" }, "ORIGINAL_RECIPE"],
    [1, "metabolicBuilder.allMealsLoggedDesc", { successCount: 3 }, "3"],
    [3, "{{name}} added to {{slot}}", { generatedMeal: { name: "ORIGINAL_RECIPE" }, slot: "breakfast",
      lists: [["breakfast", "ORIGINAL_SLOT_LABEL"]] }, "ORIGINAL_SLOT_LABEL"],
    [3, "generalNutritionBuilder.mealAddedDesc", { snack: { title: "ORIGINAL_SNACK" } }, "ORIGINAL_SNACK"],
  ] as const) {
    const source = sources[index];
    const expression = first(source, n => ts.isCallExpression(n) && n.expression.getText(source) === "t" &&
      ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === key);
    const unchanged = JSON.stringify(overrides);
    function Message() { const scope = useScope(overrides); return <p>{evaluate(expression.getText(source), scope)}</p>; }
    const view = render(<Message />);
    expect(view.container).toHaveTextContent(expected);
    expect(view.container.textContent).not.toContain("{{");
    expect(JSON.stringify(overrides)).toBe(unchanged);
    if (index === 0) expect(view.container).toHaveTextContent("breakfast");
    view.unmount();
  }
  expect(global.fetch).not.toHaveBeenCalled();
});

test("all four owners retain shared cards, clinical indicators and centralized language ownership", () => {
  for (const source of sources) {
    const code = source.getFullText();
    expect(code).toContain('from "@/i18n/useConsumerCopy"');
    for (const tag of ["MealCard", "DayChips", "DailyTargetsCard", "DailyMacroTotalsRow", "GlobalMealActionBar",
      "DuplicateDayModal", "BuilderHeader", "BuilderGuidanceTour"])
      expect(nodes(source, n => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(source) === tag).length).toBeGreaterThan(0);
    expect(code).toContain('from "@/components/MealCard"');
    expect(code).not.toMatch(/changeLanguage|saveLanguagePreference|createInstance|<select[^>]+language/i);
    for (const callback of nodes(source, n => ts.isCallExpression(n) && n.expression.getText(source) === "useCallback"
      && /\bt\(/.test(n.arguments[0]?.getText(source) || "")) as ts.CallExpression[]) {
      expect((callback.arguments[1] as ts.ArrayLiteralExpression).elements.map(n => n.getText(source))).toContain("t");
    }
  }
  // Ordinary back navigation is authorized for platform-wide localization.
  expect(sources[1].getFullText()).toContain('{t("diabeticBuilder.backLabel")}');
  // Support-strip labels are now explicitly in scope; clinical explanations remain review-gated.
  expect(sources[0].getFullText()).toContain('<ClinicalSupportLabel label="Active Protocol:"');
  for (const index of [1, 3]) expect(sources[index].getFullText()).toContain('<ClinicalSupportLabel label="Active Clinical Supports:"');
  for (const source of sources) expect(source.getFullText()).toContain('"Alpha-gal Syndrome"');
});
