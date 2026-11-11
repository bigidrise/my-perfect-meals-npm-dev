/** @jest-environment jsdom */
import React from "react";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MealCardActions, { MealCardAction, mealCardActionLayout } from "@/components/MealCardActions";
import TranslateToggle from "@/components/TranslateToggle";

jest.mock("wouter", () => ({ useLocation: () => ["/fixture", jest.fn()] }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (key: string, options?: any) => options?.defaultValue || ({ more: "More", "savedMeals.addToMacros": "Add to Macros", "savedMeals.remove": "Remove" } as any)[key] || key,
}) }));
jest.mock("@/lib/productionGates", () => ({ isFeatureEnabled: () => true }));
jest.mock("@/lib/safeChefHandoff", () => ({ writeChefHandoffMeal: jest.fn() }));
jest.mock("@/components/ShareRecipeButton", () => ({
  __esModule: true, default: () => <button>Share</button>,
}));
jest.mock("@/components/TranslateToggle", () => ({
  __esModule: true,
  default: ({ onTranslate }: any) => <button onClick={() => onTranslate({ name: "Translated", instructions: "Step" })}>Translate</button>,
}));

const hosts = [
  "pages/lifestyle/CreateDishPage.tsx", "pages/lifestyle/GatheringsPage.tsx",
  "pages/craving-creator.tsx", "pages/CravingDessertCreator.tsx", "pages/SushiCreator.tsx",
  "pages/BeverageCreator.tsx", "pages/AthleteBeverageCreator.tsx", "pages/fridge-rescue.tsx",
  "pages/lifestyle/ChefsKitchenPage.tsx", "pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx",
  "components/MealCard.tsx", "components/SavedMealRow.tsx",
  "components/RecipeQuickActions.tsx", "pages/companion/CompanionMealGenerator.tsx",
];
const source = (file: string) => fs.readFileSync(path.join(process.cwd(), "client/src", file), "utf8");
function actualFooter(file: string) {
  const tree = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let footer: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "MealCardActions" && !footer) footer = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!footer) throw new Error(`Missing shared footer in ${file}`);
  // Only the real footer expression is evaluated with synthetic data/components.
  // No page modules, providers, database, generator or paid services are imported.
  const js = ts.transpileModule(`return (${footer.getText(tree)});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, alwaysStrict: false },
  }).outputText;
  return new Function("scope", `with (scope) { ${js} }`);
}
function fixture(file: string, overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, jest.Mock> = {};
  const ingredient = { name: "Chicken", item: "Chicken", quantity: 2, amount: 2, unit: "lb" };
  const recipe = {
    id: "synthetic-recipe", name: "Synthetic recipe", recipeName: "Synthetic recipe",
    title: "Synthetic recipe", slug: "synthetic-recipe", type: "dinner", servings: 3,
    ingredients: [ingredient], instructions: ["Cook thoroughly"], nutrition: { protein: 11, carbs: 12, fat: 13, calories: 209 },
  };
  const button = ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>;
  const handler = (key: string) => handlers[key] ||= jest.fn();
  const values: Record<string, any> = {
    React, Math, Date, String, Number, Boolean, Array, Object, JSON,
    MealCardActions, MealCardAction, TranslateToggle,
    GlassButton: button, Button: button, PillButton: button,
    Heart: () => <span />, RefreshCw: () => <span />, Lock: () => <span />,
    ShareRecipeButton: () => <button>Share</button>,
    AddToMealPlanButton: ({ meal }: any) => <button onClick={() => handler("plan")(meal)}>Add to Plan</button>,
    MacroBridgeButton: ({ meal }: any) => <button onClick={() => handler("macroBridge")(meal)}>Add to Macros</button>,
    recipe, meal: recipe, course: recipe, generatedDessert: recipe, generatedBeverage: recipe, generatedMeal: recipe,
    row: { ...recipe, sourceType: "synthetic" }, d: recipe, index: 0, servings: 3,
    t: (key: string, options?: any) => options?.defaultValue || ({ "savedMeals.addToMacros": "Add to Macros", "savedMeals.remove": "Remove" } as any)[key] || key,
    displayTitle: recipe.name, displayDescription: "", displayIngredients: recipe.ingredients, displayInstructions: recipe.instructions,
    date: "2026-11-09", macroMealSlot: "dinner", builderSnapshot: { uncertainFields: [] },
    builderType: "general", originBuilder: "general", developmentGrocery: false,
    protein: 11, carbs: 12, fat: 13, kcal: 209, starchyCarbs: 5, fibrousCarbs: 7,
    calories: 209, storedStarchy: 5, storedFibrous: 7,
    beverageStarchAlert: { show: false }, isFree: false, saved: false,
    saveMutation: { mutate: handler("save"), isPending: false },
    addToCalendarMutation: { mutate: handler("calendar"), isPending: false }, sharing: false,
    getMealNutrition: () => ({ protein_g: 11, carbs_g: 12, fat_g: 13, calories: 209, starchyCarbs: 5, fibrousCarbs: 7 }),
    creatorMealNutrition: () => ({ protein: 11, carbs: 12, fat: 13, calories: 209 }),
    ...overrides,
  };
  const scope = new Proxy(values, {
    has: () => true,
    get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key as string] : handler(String(key)),
  });
  return { element: () => actualFooter(file)(scope), handlers, recipe };
}
beforeEach(() => { global.fetch = jest.fn(() => { throw new Error("Live network forbidden"); }); });
afterEach(() => { mealCardActionLayout.columns = 2; cleanup(); });

test.each(hosts)("%s inherits shared layout and secondary translation from its real footer", file => {
  const f = fixture(file);
  const view = render(f.element());
  const primary = view.container.querySelector("[data-meal-card-primary]") as HTMLElement;
  expect(primary).toHaveStyle({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
  expect(within(primary).queryByRole("button", { name: "Translate" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Shopping/i })).not.toBeInTheDocument();
  if (!file.includes("RecipeQuickActions") && !file.includes("CompanionMeal")) {
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("button", { name: "Translate" })).toBeInTheDocument();
  }
  // One change at the shared owner, no host footer edits or alternate renderers.
  mealCardActionLayout.columns = 1;
  view.rerender(f.element());
  expect(primary).toHaveStyle({ gridTemplateColumns: "repeat(1, minmax(0, 1fr))" });
});
test("Create a Dish keeps its existing macro callback and original recipe Plan handoff", () => {
  const f = fixture(hosts[0]);
  render(f.element());
  fireEvent.click(screen.getByRole("button", { name: "Add to Macros" }));
  expect(f.handlers.setQuickView).toHaveBeenCalledWith(expect.objectContaining({ protein: 11, carbs: 12, fat: 13, calories: 209 }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Plan" }));
  expect(f.handlers.plan).toHaveBeenCalledWith(f.recipe);
  expect(f.recipe.ingredients[0].quantity).toBe(2);
});
test("saved/Favorites callbacks and explicit Translate override remain available", () => {
  const f = fixture("components/SavedMealRow.tsx");
  render(f.element());
  fireEvent.click(screen.getByRole("button", { name: "Add to Macros" }));
  expect(f.handlers.onAddToMacros).toHaveBeenCalledWith(expect.objectContaining({ id: "synthetic-recipe" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(f.handlers.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "synthetic-recipe" }));
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("button", { name: "Translate" })).toBeInTheDocument();
});
test("pediatric footer retains Kitchen and working translation without acquiring adult macro actions", () => {
  const f = fixture("pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx");
  render(f.element());
  expect(screen.getByRole("button", { name: "Walk Through Kitchen" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add to Macros" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  fireEvent.click(screen.getByRole("button", { name: "Translate" }));
  expect(f.handlers.onUpdateRecipe).toHaveBeenCalledWith(expect.objectContaining({ recipeName: "Translated", instructions: ["Step"] }));
  expect(f.recipe.ingredients[0].quantity).toBe(2);
});
test("builder macro uncertainty guard survives shared composition", () => {
  const f = fixture("components/MealCard.tsx", { builderSnapshot: { uncertainFields: ["protein"] } });
  render(f.element());
  expect(screen.queryByRole("button", { name: "Add to Macros" })).not.toBeInTheDocument();
  expect(screen.getByText("Review incomplete nutrition before logging.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add to Plan" })).toBeInTheDocument();
});
test("shared actions are composition-only and do not add a shopping transport or alternate card", () => {
  const text = source("components/MealCardActions.tsx");
  expect(text).not.toMatch(/shoppingListStore|sendMealsToShopping|fetch\s*\(/);
  expect(text).toContain("data-meal-card-primary");
});
