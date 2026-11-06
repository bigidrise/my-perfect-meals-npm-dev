import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { builderMealMacros, summarizeBuilderDay, formatBuilderMacro } from "@/lib/builderMacroCalculation";
import { DailyMacroTotalsRow } from "@/components/DailyMacroTotalsRow";
import { RemainingMacrosFooter } from "@/components/biometrics/RemainingMacrosFooter";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => ({
    "common.today": "Today",
    "remainingMacros.remainingToday": "Remaining Today",
    "remainingMacros.protein": "Protein",
    "remainingMacros.starchy": "Starchy",
    "remainingMacros.fibrous": "Fibrous",
    "remainingMacros.fat": "Fat",
    "remainingMacros.overLimit": "Over limit",
    "remainingMacros.limit": "Limit",
  } as Record<string, string>)[key] ?? key }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "offline-only" } }) }));
jest.mock("@/hooks/useTodayMacros", () => ({ useTodayMacros: () => ({
  protein: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0,
}) }));

const builders = [
  ["General Nutrition", "pro/GeneralNutritionBuilder", "general_nutrition"],
  ["Anti-Inflammatory", "physician/AntiInflammatoryMenuBuilder", "anti_inflammatory"],
  ["Diabetic", "physician/DiabeticMenuBuilder", "diabetic"],
  ["GLP-1", "physician/GLP1MealBuilder", "metabolic_medication"],
  ["Performance", "pro/PerformanceCompetitionBuilder", "performance"],
];
const targets = { calories_kcal: 1634, protein_g: 129, carbs_g: 101, starchyCarbs_g: 37, fibrousCarbs_g: 64, fat_g: 78 };
const meal = (starchy: number, fibrous: number) => ({
  servings: 1, nutrition: { calories: 100, protein: 10, carbs: starchy + fibrous, starchyCarbs: starchy, fibrousCarbs: fibrous, fat: 5 },
});
const day = {
  breakfast: [meal(3, 5)], lunch: [meal(27, 4)], dinner: [meal(0, 5)],
  meal4: [meal(11, 3)], meal5: [meal(0, 4)], meal6: [meal(0, 4)], snacks: [],
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/&gt;/g, ">").replace(/&lt;/g, "<");

function compileExpression(expression: string, context: Record<string, unknown>) {
  const module = { exports: undefined as any };
  vm.runInNewContext(ts.transpileModule(`module.exports = ${expression}`, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, React, ...context }, { timeout: 1500 });
  return module.exports;
}

// Render the actual MealCard macro JSX, without importing unrelated app/auth/media
// dependencies. The Builder nutrition function is the same one used in the card.
const cardSource = ts.createSourceFile("MealCard.tsx", readFileSync("client/src/components/MealCard.tsx", "utf8"),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let macroGrid: ts.JsxElement | undefined;
function findGrid(node: ts.Node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.getText(cardSource)
    .includes('className="mt-3 grid grid-cols-3 gap-2 text-center"')) macroGrid = node;
  ts.forEachChild(node, findGrid);
}
findGrid(cardSource);
if (!macroGrid) throw new Error("Actual MealCard macro grid not found");
const CardMacros = compileExpression(`({ snapshot }) => {
  const { protein, carbs, fat, starchyCarbs, fibrousCarbs } = snapshot;
  const hasStarchyFibrous = true;
  const displayMacro = (key, value) => snapshot.uncertainFields.includes(key) ? "—" : formatBuilderMacro(value);
  return (${macroGrid.getText(cardSource)});
}`, { formatBuilderMacro, t: (key: string) => key });

describe.each(builders)("%s: actual summary callback and displayed nutrition", (_name, file, origin) => {
  const sourceText = readFileSync(`client/src/pages/${file}.tsx`, "utf8");
  const source = ts.createSourceFile(`${file}.tsx`, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Expression | undefined;
  const topProps: string[] = [];
  const footerProps: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "dayTotals" &&
      node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
    if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(source) === "DailyMacroTotalsRow") topProps.push(node.attributes.getText(source));
      if (node.tagName.getText(source) === "RemainingMacrosFooter") footerProps.push(node.attributes.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!callback) throw new Error("Actual Builder dayTotals callback not found");
  const summary = compileExpression(callback.getText(source), {
    summarizeBuilderDay, board: { days: { "2026-11-06": day } }, activeDayISO: "2026-11-06",
    getDayLists: (board: any, date: string) => board.days[date],
  })();

  it("passes one canonical day summary and identical resolved targets to both displays", () => {
    expect(summary).toMatchObject({ carbs: 66, starchyCarbs: 41, fibrousCarbs: 25, count: 6 });
    expect(topProps).toHaveLength(1);
    expect(topProps[0]).toContain("totals={dayTotals}");
    expect(topProps[0]).toContain("targetsOverride={effectiveTargets}");
    expect(footerProps[0]).toContain("consumedOverride={consumed}");
    expect(footerProps[0]).toContain("targetsOverride={effectiveTargets}");
    expect(sourceText).toContain("const consumed = dayTotals;");
    expect(sourceText).not.toContain("computeSlotMacros");
    expect(sourceText).toContain(`originBuilder="${origin}"`);
    expect(readFileSync("client/src/components/MealCard.tsx", "utf8")).toContain("builderMealMacros(meal)");
  });

  it("renders all six top indicators in order and a real +4g overage", () => {
    const html = renderToStaticMarkup(<DailyMacroTotalsRow totals={summary} prescription={null}
      targetsOverride={targets} activeDayISO="2026-11-06" />);
    expect([...html.matchAll(/data-macro="([^"]+)"/g)].map(match => match[1]))
      .toEqual(["calories", "protein", "carbs", "starchyCarbs", "fibrousCarbs", "fat"]);
    expect(text(html)).toContain("Total Carbs 66 / 101g");
    expect(text(html)).toContain("Starchy Carbs 41 / 37g (+4g over)");
    expect(text(html)).toContain("Fibrous Carbs 25 / 64g");
    expect(html).toContain("flex-wrap");
  });

  it("reconciles actual card macro markup with the top and remaining footer", () => {
    const cards = Object.values(day).flat().map(entry => builderMealMacros(entry));
    expect(cards.reduce((sum, card) => sum + card.starchyCarbs, 0)).toBe(summary.starchyCarbs);
    expect(cards.reduce((sum, card) => sum + card.fibrousCarbs, 0)).toBe(summary.fibrousCarbs);
    expect(text(renderToStaticMarkup(<CardMacros snapshot={cards[1]} />))).toContain("27S / 4F");
    const html = renderToStaticMarkup(<RemainingMacrosFooter consumedOverride={summary}
      targetsOverride={targets} layoutMode="inline" />);
    expect(text(html)).toContain("+4g");
    expect(text(html)).toContain("Over limit");
    expect(text(html)).toContain("39g");
    expect(html).toContain("bg-pink-500");
  });
});

it("renders partial servings and fractional overages consistently, without a zero clamp", () => {
  const snapshot = builderMealMacros({ ...meal(27, 3), servings: 2, consumedServings: 0.5 });
  expect(text(renderToStaticMarkup(<CardMacros snapshot={snapshot} />))).toContain("6.75S / 0.75F");
  const summary = summarizeBuilderDay({ breakfast: [{ ...meal(27, 3), servings: 2, consumedServings: 0.5 }] });
  const smallTargets = { ...targets, starchyCarbs_g: 6.5 };
  const top = text(renderToStaticMarkup(<DailyMacroTotalsRow totals={summary} prescription={null}
    targetsOverride={smallTargets} activeDayISO="2026-11-06" />));
  const footer = text(renderToStaticMarkup(<RemainingMacrosFooter consumedOverride={summary}
    targetsOverride={smallTargets} layoutMode="inline" />));
  expect(top).toContain("Starchy Carbs 6.75 / 6.5g (+0.25g over)");
  expect(footer).toContain("+0.25g");
});

it("makes unknown data, estimates and unclassified carbohydrate visible rather than precise zeros", () => {
  const unknown = summarizeBuilderDay({ breakfast: [{ nutrition: { calories: 100, protein: 10, carbs: 20, fat: 2 } }] });
  const top = renderToStaticMarkup(<DailyMacroTotalsRow totals={unknown} prescription={null}
    targetsOverride={targets} activeDayISO="2026-11-06" />);
  const footer = renderToStaticMarkup(<RemainingMacrosFooter consumedOverride={unknown}
    targetsOverride={targets} layoutMode="inline" />);
  expect(text(top)).toContain("Totals incomplete");
  expect(text(footer)).toContain("Incomplete");
  expect(text(footer)).toContain("Some nutrition values are unknown");
  const estimated = summarizeBuilderDay({ breakfast: [{
    nutrition: { calories: 100, protein: 10, carbs: 30, fat: 2 }, ingredients: ["rice", "broccoli"],
  }] });
  expect(text(renderToStaticMarkup(<DailyMacroTotalsRow totals={estimated} prescription={null}
    targetsOverride={targets} activeDayISO="2026-11-06" />))).toContain("Carb split estimated");
});

it("shows a pink overage against a genuine zero starch target", () => {
  const summary = summarizeBuilderDay({ breakfast: [meal(3, 4)] });
  const zeroStarch = { ...targets, starchyCarbs_g: 0 };
  const top = renderToStaticMarkup(<DailyMacroTotalsRow totals={summary} prescription={null}
    targetsOverride={zeroStarch} activeDayISO="2026-11-06" />);
  const footer = renderToStaticMarkup(<RemainingMacrosFooter consumedOverride={summary}
    targetsOverride={zeroStarch} layoutMode="inline" />);
  expect(text(top)).toContain("Starchy Carbs 3 / 0g (+3g over)");
  expect(text(footer)).toContain("+3g");
  expect(top).toContain("bg-pink-500/60");
  expect(footer).toContain("text-pink-400");
});
