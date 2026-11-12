/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import MealCardActions from "@/components/MealCardActions";
import { sendShoppingSelections, rememberShoppingTranslation, withShoppingProvenance, canonicalShoppingRecipe } from "@/lib/mealShoppingApi";
import { selectionForRecipe, prepareShoppingSelection, templateShoppingSelectionId } from "@shared/mealShoppingSelection";
import { apiRequest } from "@/lib/apiRequest";

const mockHydrate = jest.fn(async () => undefined);
const mockNavigate = jest.fn();
let mockLocation = "/fixture";
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: { getState: () => ({ hydrate: mockHydrate }) },
}));
jest.mock("wouter", () => ({ useLocation: () => [mockLocation, mockNavigate] }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key === "more" ? "More" : key }) }));
jest.mock("@/lib/productionGates", () => ({ isFeatureEnabled: () => true }));
jest.mock("@/lib/safeChefHandoff", () => ({ writeChefHandoffMeal: jest.fn() }));
jest.mock("@/components/ShareRecipeButton", () => ({ __esModule: true, default: () => <button>Share</button> }));
jest.mock("@/components/TranslateToggle", () => ({ __esModule: true, default: () => <button>Translate</button> }));
let serial = 0;
let post: jest.Mock;
const recipe = () => ({ id: "recipe-a", name: "Chicken", servings: 3,
  ingredients: [{ name: "chicken", quantity: 2, unit: "lb" }] });
const ack = (status = "added") => ({ ok: true, committed: true,
  results: [{ selectionId: "recipe:recipe-a", version: 1, status }] });
beforeEach(() => {
  mockLocation = "/fixture";
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("userId", `synthetic-shopping-${++serial}`);
  jest.clearAllMocks();
  global.fetch = jest.fn(() => { throw new Error("Live network forbidden"); });
  post = jest.fn(async () => ack());
  (apiRequest as jest.Mock).mockImplementation((url: string, init?: any) =>
    url.endsWith("/capabilities") ? Promise.resolve({ available: true }) : post(url, init));
});
afterEach(cleanup);
async function shoppingButton() {
  const button = screen.getByRole("button", { name: "Shopping: Chicken" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}
test("one shared Shopping action waits for acknowledgement and blocks accidental repeat clicks", async () => {
  let finish: (value: any) => void = () => undefined;
  post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<MealCardActions source="fixture" shoppingRecipe={recipe()} />);
  const button = await shoppingButton();
  fireEvent.click(button); fireEvent.click(button);
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Saving…: Chicken" })).toBeDisabled();
  expect(screen.queryByText("Saved to your shopping list.")).not.toBeInTheDocument();
  expect(mockHydrate).not.toHaveBeenCalled();
  finish(ack());
  await screen.findByText("Saved to your shopping list.");
  expect(mockHydrate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
test("failed saves stay retryable and never report Added or hydrate", async () => {
  post.mockRejectedValue(new Error("Synthetic failed save"));
  render(<MealCardActions source="fixture" shoppingRecipe={recipe()} />);
  fireEvent.click(await shoppingButton());
  await screen.findByText("Synthetic failed save");
  expect(screen.queryByRole("button", { name: "Added: Chicken" })).not.toBeInTheDocument();
  expect(mockHydrate).not.toHaveBeenCalled();
  post.mockResolvedValue(ack());
  fireEvent.click(await shoppingButton());
  await screen.findByRole("button", { name: "Added: Chicken" });
});
test("recipe changes require a second explicit Update Shopping action with the receipt version", async () => {
  const original = recipe();
  const view = render(<MealCardActions source="fixture" shoppingRecipe={original} />);
  fireEvent.click(await shoppingButton());
  await screen.findByRole("button", { name: "Added: Chicken" });
  view.rerender(<MealCardActions source="fixture" shoppingRecipe={{ ...original,
    ingredients: [{ name: "chicken", quantity: 4, unit: "lb" }] }} />);
  post.mockResolvedValueOnce({ committed: false, results: [{
    selectionId: "recipe:recipe-a", version: 1, status: "update_required",
  }] });
  fireEvent.click(await shoppingButton());
  const update = await screen.findByRole("button", { name: "Update Shopping: Chicken" });
  expect(mockHydrate).toHaveBeenCalledTimes(1);
  fireEvent.click(update);
  await screen.findByRole("button", { name: "Added: Chicken" });
  const body = JSON.parse(post.mock.calls[2][1].body);
  expect(body.operation).toBe("replace");
  expect(body.selections[0]).toMatchObject({ expectedVersion: 1, ingredients: [{ name: "chicken", quantity: 4, unit: "lb" }] });
});
test("missing/to-taste quantities are explained rather than fabricated", async () => {
  render(<MealCardActions source="fixture" shoppingRecipe={{ ...recipe(),
    ingredients: [{ name: "salt", quantity: "to taste", unit: "" }] }} />);
  await screen.findByText(/unknown\/to-taste/);
  expect(screen.getByRole("button", { name: "Shopping: Chicken" })).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});
test("builder cards retain the hidden individual Shopping policy", () => {
  render(<MealCardActions source="builder" shoppingRecipe={recipe()} showShopping={false} />);
  expect(screen.queryByRole("button", { name: /Shopping/ })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();
});
test("professional client workspaces do not send a client's recipe to the actor's grocery list", () => {
  mockLocation = "/pro/clients/synthetic";
  render(<MealCardActions source="fixture" shoppingRecipe={recipe()} />);
  expect(screen.queryByRole("button", { name: /Shopping/ })).not.toBeInTheDocument();
  expect(apiRequest).not.toHaveBeenCalled();
});
test("canonical original ingredients survive translation and saved-recipe serialization", () => {
  const original = recipe();
  canonicalShoppingRecipe(original);
  const translated = { name: "Pollo", ingredients: [{ name: "pollo", quantity: 2, unit: "lb" }] };
  rememberShoppingTranslation(original, translated);
  const saved = JSON.parse(JSON.stringify(withShoppingProvenance({ ...original, ...translated }, "fixture")));
  const restored = selectionForRecipe(saved, "favorites").selection!;
  expect(restored.selectionId).toBe("recipe:recipe-a");
  expect(restored.ingredients).toEqual(original.ingredients);
  expect(restored.recipeYield).toBe(3);
});
test("a malformed acknowledgement is not treated as successful persistence", async () => {
  const selection = selectionForRecipe(recipe(), "fixture").selection!;
  await expect(sendShoppingSelections([selection], "add", jest.fn(async () => ({
    committed: true, results: [],
  })), mockHydrate)).rejects.toThrow(/not confirmed/);
  expect(mockHydrate).not.toHaveBeenCalled();
});
test("late acknowledgement cannot reconcile or expose a previous account's groceries", async () => {
  let finish: (value: any) => void = () => undefined;
  const request = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const promise = sendShoppingSelections([selectionForRecipe(recipe(), "fixture").selection!], "add", request as any, mockHydrate);
  localStorage.setItem("userId", "another-synthetic-account");
  finish(ack());
  await expect(promise).rejects.toThrow(/Account changed/);
  expect(mockHydrate).not.toHaveBeenCalled();
});
test("canonical evidence stays original while three shopping servings become six", () => {
  const original = { ...recipe(), shoppingServings: 3 };
  canonicalShoppingRecipe(original);
  const selected = selectionForRecipe(canonicalShoppingRecipe({ ...original, shoppingServings: 6 }), "fixture").selection!;
  expect(selected.shoppingServings).toBe(6);
  expect(selected.recipeYield).toBe(3);
  expect(prepareShoppingSelection(selected)[0].quantity).toBe(4);
  expect(selected.ingredients).toEqual(original.ingredients);
});
test("a previously missing yield becomes valid without changing ingredients", () => {
  const original = { ...recipe(), servings: undefined };
  expect(selectionForRecipe(canonicalShoppingRecipe(original), "fixture").selection).toBeUndefined();
  const selected = selectionForRecipe(canonicalShoppingRecipe({ ...original, recipeYield: 3 }), "fixture").selection!;
  expect(selected.recipeYield).toBe(3);
  expect(prepareShoppingSelection(selected)[0].quantity).toBe(2);
});
test("yield and quantity-basis changes update while translated ingredients remain noncanonical", () => {
  const original = recipe();
  rememberShoppingTranslation(original, { ingredients: [{ name: "pollo", quantity: 2, unit: "lb" }] });
  const changed = canonicalShoppingRecipe({ ...original, recipeYield: 6, shoppingServings: 6,
    shoppingQuantityBasis: "per_serving", ingredients: [{ name: "pollo", quantity: 2, unit: "lb" }] });
  const selected = selectionForRecipe(changed, "fixture").selection!;
  expect(selected.recipeYield).toBe(6);
  expect(selected.quantityBasis).toBe("per_serving");
  expect(selected.ingredients).toEqual(original.ingredients);
  expect(prepareShoppingSelection(selected)[0].quantity).toBe(12);
});
test("stable template keys survive opening, save serialization and restoration without variant collisions", () => {
  const classic = templateShoppingSelectionId("chicken");
  const opened = templateShoppingSelectionId("chicken", "classic");
  expect(opened).toBe(classic);
  const full = { ...recipe(), shoppingSelectionId: opened };
  const restored = JSON.parse(JSON.stringify(withShoppingProvenance(full, "recipe-template")));
  expect(selectionForRecipe(restored, "favorites").selection!.selectionId).toBe(classic);
  expect(templateShoppingSelectionId("chicken", "light")).not.toBe(classic);
  expect(templateShoppingSelectionId("chicken", "highProtein")).not.toBe(classic);
});
