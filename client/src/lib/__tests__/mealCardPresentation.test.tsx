/** @jest-environment jsdom */
import React from "react";
import fs from "fs";
import ts from "typescript";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TrashButton from "@/components/ui/TrashButton";
import FavoriteButton from "@/components/FavoriteButton";
import { ChefHat } from "lucide-react";

const mockFavoriteSave = jest.fn();
jest.mock("@/hooks/useSavedMeals", () => ({
  useToggleSavedMeal: () => ({ mutate: mockFavoriteSave }), useSavedMealsCheck: () => ({ data: [] }),
  isMealSaved: () => false,
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useMealShopping", () => ({ useMealShopping: () => ({ available: false }) }));
jest.mock("@/lib/mealShoppingApi", () => ({ withShoppingProvenance: (meal: any) => meal }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "synthetic-visual-fixture" } }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ hasActivePaidSubscription: () => true }));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { cleanup(); jest.clearAllMocks(); });

test("meal-card trash is red by default with a compact outline and a separate 44px touch target", () => {
  render(<TrashButton appearance="meal-card" onClick={jest.fn()} />);
  const button = screen.getByRole("button", { name: "Delete" });
  expect(button).toHaveAttribute("data-appearance", "meal-card");
  expect(button).toHaveClass("text-red-400", "bg-transparent", "min-h-[44px]", "min-w-[44px]",
    "before:inset-1.5", "before:border-white/20");
  expect(button).not.toHaveClass("bg-red-600");
});
test("legacy default trash controls now share the compact red appearance globally", () => {
  render(<TrashButton onClick={jest.fn()} />);
  expect(screen.getByRole("button")).toHaveClass("text-red-400", "bg-transparent", "min-h-[44px]", "min-w-[44px]");
  expect(screen.getByRole("button")).not.toHaveClass("bg-red-600", "text-white");
  expect(screen.getByRole("button")).toHaveAttribute("data-appearance", "default");
});
test("direct meal deletion preserves the callback, disabled state and event isolation", () => {
  const remove = jest.fn(), expand = jest.fn();
  const view = render(<div onClick={expand}><TrashButton appearance="meal-card" onClick={remove} /></div>);
  fireEvent.click(screen.getByRole("button"));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(expand).not.toHaveBeenCalled();
  view.rerender(<div onClick={expand}><TrashButton appearance="meal-card" onClick={remove} disabled /></div>);
  fireEvent.click(screen.getByRole("button"));
  expect(remove).toHaveBeenCalledTimes(1);
});
test("meal-card deletion still requires confirmation when configured", () => {
  const remove = jest.fn();
  render(<TrashButton appearance="meal-card" onClick={remove} confirm confirmMessage="Remove this recipe?" />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByText("Remove this recipe?")).toBeVisible();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
  expect(remove).toHaveBeenCalledTimes(1);
});

function actualCreateDishHeader() {
  const file = "client/src/pages/lifestyle/CreateDishPage.tsx";
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(p =>
      ts.isJsxAttribute(p) && p.name.getText(source) === "data-meal-card-header")) header = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!header) throw new Error("Missing real finalized Create a Dish header");
  const compiled = ts.transpileModule(`return (${header.getText(source)});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, alwaysStrict: false },
  }).outputText;
  const reset = Object.fromEntries(["setGeneratedMeals", "setSelectedDishId", "clearDishCache",
    "setMealOptions", "clearOptionsCache", "updateDishInput", "setSubstitutedStarchTerms", "clearStarchAlert"]
    .map(name => [name, jest.fn()]));
  const meal = { id: "synthetic-header", name: "A very long salmon recipe title that must wrap naturally without overlapping Favorites or Create New controls", servings: 2 };
  const scope = { React, FavoriteButton, ChefHat, meal, servings: 2, ...reset };
  return { element: new Function("scope", `with(scope) { ${compiled} }`)(scope), meal, reset };
}
test("actual Create a Dish header puts independent controls before the full wrapping title", () => {
  const fixture = actualCreateDishHeader();
  const view = render(fixture.element);
  const header = view.container.querySelector("[data-meal-card-header]")!;
  const controls = header.querySelector("[data-meal-card-controls]")!;
  const title = screen.getByRole("heading", { name: fixture.meal.name });
  expect(header.firstElementChild).toBe(controls);
  expect(controls).not.toContainElement(title);
  expect(title).toHaveClass("whitespace-normal", "break-words", "min-w-0");
  expect(title).not.toHaveClass("truncate");
  fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
  expect(mockFavoriteSave).toHaveBeenCalledWith(
    { title: fixture.meal.name, sourceType: "create-dish", mealData: fixture.meal }, expect.any(Object));
  fireEvent.click(screen.getByRole("button", { name: "Create New" }));
  expect(fixture.reset.setGeneratedMeals).toHaveBeenCalledWith([]);
  expect(fixture.reset.setSelectedDishId).toHaveBeenCalledWith(null);
  expect(fixture.reset.updateDishInput).toHaveBeenCalledWith("");
  for (const name of ["clearDishCache", "clearOptionsCache", "clearStarchAlert"]) {
    expect(fixture.reset[name]).toHaveBeenCalledTimes(1);
  }
});
test("all designated existing meal-card consumers use the single meal-card trash appearance", () => {
  for (const file of ["components/SavedMealRow.tsx", "components/MealCard.tsx", "components/MealCardDynamic.tsx", "components/MealCardFull.tsx",
    "components/BuilderDayBoard.tsx", "components/FixedMenuPicker.tsx", "pages/lifestyle/CreateDishPage.tsx",
    "pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx", "pages/lifestyle/GatheringsPage.tsx",
    "pages/craving-creator.tsx", "pages/CravingDessertCreator.tsx", "pages/SushiCreator.tsx",
    "pages/BeverageCreator.tsx", "pages/AthleteBeverageCreator.tsx", "pages/fridge-rescue.tsx"]) {
    expect(fs.readFileSync(`client/src/${file}`, "utf8")).toContain('appearance="meal-card"');
  }
});
test("MealCardFull keeps its optional deletion gate and existing immediate callback", () => {
  const file = "client/src/components/MealCardFull.tsx";
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxExpression(node) && node.expression?.getText(source).startsWith("showDeleteMeal && onDeleteMeal")) {
      expression = node.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error("Existing MealCardFull deletion gate was lost");
  const js = ts.transpileModule(`return (${expression.getText(source)});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, alwaysStrict: false },
  }).outputText;
  const element = new Function("scope", `with(scope) { ${js} }`);
  const remove = jest.fn();
  const t = jest.fn((key: string) => {
    expect(key).toBe("shoppingTransfer:deleteMeal");
    return require("../../i18n/locales/en.json").shoppingTransfer.deleteMeal;
  });
  const view = render(element({ React, TrashButton, t, showDeleteMeal: false, onDeleteMeal: remove }));
  expect(screen.queryByRole("button", { name: "Delete Meal" })).not.toBeInTheDocument();
  view.rerender(element({ React, TrashButton, t, showDeleteMeal: true, onDeleteMeal: remove }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Meal" }));
  expect(remove).toHaveBeenCalledTimes(1);
});
