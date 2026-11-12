/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import MealCardActions from "@/components/MealCardActions";
import SavedMealRow from "@/components/SavedMealRow";
import { sendShoppingSelections, rememberShoppingTranslation, withShoppingProvenance, canonicalShoppingRecipe } from "@/lib/mealShoppingApi";
import { selectionForRecipe, prepareShoppingSelection, templateShoppingSelectionId } from "@shared/mealShoppingSelection";
import { apiRequest } from "@/lib/apiRequest";
import { sendSavedMealToShopping } from "@/lib/savedMealShopping";

const mockHydrate = jest.fn(async () => undefined);
const mockNavigate = jest.fn();
const mockToast = jest.fn();
let mockLocation = "/fixture";
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: { getState: () => ({ hydrate: mockHydrate }) },
}));
jest.mock("wouter", () => ({ useLocation: () => [mockLocation, mockNavigate] }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => ({
  more: "More", "savedMeals.addToMacros": "Add to Macros",
  "savedMeals.remove": "Remove", "savedMeals.cal": "Cal",
}[key] || key) }) }));
jest.mock("@/hooks/useTranslatedMeal", () => ({ useTranslatedMeal: () => ({ data: null, isLoading: false }) }));
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: false }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
jest.mock("@/components/ui/MealImageSlot", () => ({
  MealImageSlot: ({ mealName, imageUrl }: any) => <div data-testid="meal-image" data-image-url={imageUrl}>{mealName}</div>,
}));
jest.mock("@/components/DiabetesProtocolIndicator", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/AlphaGalBadge", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/shopping/GroceryCoachMacroTiles", () => ({ GroceryCoachMacroTiles: () => <div>Canonical nutrition</div> }));
jest.mock("@/components/AddToMealPlanButton", () => ({
  __esModule: true, default: () => <button>Add to Plan</button>,
}));
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
  HTMLElement.prototype.scrollIntoView = jest.fn();
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
const savedRow = () => ({
  id: "favorite-record-a", title: "Chicken", sourceType: "create_a_dish",
  dayMismatchNote: "Original saved-day clinical warning remains visible.",
  mealData: { ...recipe(), instructions: ["Cook thoroughly."], imageUrl: "/saved-chicken.jpg" },
});
test("saved card uses creator action order and an independent top trash control", async () => {
  const row = savedRow(), remove = jest.fn(), macros = jest.fn();
  const { container } = render(<SavedMealRow row={row} sourceLabel={() => "Create a Dish"}
    onRemove={remove} onAddToMacros={macros} initialExpanded />);
  await shoppingButton();
  const primary = container.querySelector("[data-meal-card-primary]")!;
  expect(Array.from(primary.children).map(node => node.getAttribute("data-meal-action")))
    .toEqual(["macros", "plan", "prepare", "share", "shopping"]);
  expect(primary.querySelector('[data-meal-action="macros"]')).toHaveStyle({ gridColumn: "1 / -1" });
  expect(primary.querySelector('[data-meal-action="prepare"]')).not.toHaveClass("col-span-full");
  const trash = screen.getByRole("button", { name: "Remove: Chicken" });
  expect(trash.closest("[data-meal-card-primary]")).toBeNull();
  expect(trash.parentElement?.closest("button")).toBeNull();
  expect(screen.getAllByTestId("meal-image")).toHaveLength(1);
  expect(screen.getByText(row.dayMismatchNote)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Add to Macros" }));
  expect(macros).toHaveBeenCalledWith(row);
  fireEvent.click(trash);
  expect(remove).toHaveBeenCalledWith(row);
  expect(screen.getByRole("button", { expanded: true })).toHaveAttribute("aria-expanded", "true");
});
test("saved card Shopping sends canonical recipe quantities and waits for acknowledgement", async () => {
  const row = savedRow();
  render(<SavedMealRow row={row} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  fireEvent.click(await shoppingButton());
  await screen.findByText("Saved to your shopping list.");
  const body = JSON.parse(post.mock.calls[0][1].body);
  expect(body.selections[0]).toEqual(expect.objectContaining({
    selectionId: "recipe:recipe-a", recipeYield: 3, shoppingServings: 3, quantityBasis: "recipe_total",
  }));
  expect(prepareShoppingSelection(body.selections[0])[0].quantity).toBe(2);
  expect(mockHydrate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2?from=saved-meals");
});
test("saved card offers the existing aggregate-bar flow without enabling guarded transfers", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({
    available: false, reason: "Shopping transfers await reviewed migration and activation.",
  });
  render(<SavedMealRow row={savedRow()} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  await shoppingButton();
  expect(screen.queryByText("Shopping transfers await reviewed migration and activation.")).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});
test("saved card's existing-endpoint path awaits save before navigation and prevents double clicks", async () => {
  let finish: (value: any) => void = () => undefined;
  const save = jest.fn((_url: string, _init: any) => new Promise(resolve => { finish = resolve; }));
  const owner = localStorage.getItem("userId");
  (apiRequest as jest.Mock).mockImplementation((url: string, init?: any) =>
    url.endsWith("/capabilities") ? Promise.resolve({ available: false })
    : init?.method === "POST" ? save(url, init)
    : Promise.resolve({ shoppingMetadataVersion: 1, ownerUserId: owner, items: [] }));
  render(<SavedMealRow row={savedRow()} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  const button = await shoppingButton();
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toBe("/api/shopping-list");
  const body = JSON.parse(save.mock.calls[0][1].body);
  expect(body).toEqual(expect.objectContaining({ scopeType: "adhoc", scopeKey: "inbox" }));
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toEqual(expect.objectContaining({ name: "chicken", quantity: 2, unit: "lb" }));
  expect(mockNavigate).not.toHaveBeenCalled();
  finish({ ok: true, added: 1, shoppingMetadataVersion: 1, ownerUserId: owner });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2?from=saved-meals"));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved to Shopping List" }));
  expect(post).not.toHaveBeenCalled();
  expect(mockHydrate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Added: Chicken" })).toBeDisabled();
});
test("saved-card legacy save failures show the error and never navigate or optimistically add", async () => {
  const owner = localStorage.getItem("userId");
  (apiRequest as jest.Mock).mockImplementation((url: string, init?: any) =>
    url.endsWith("/capabilities") ? Promise.resolve({ available: false })
    : init?.method === "POST" ? Promise.reject(new Error("Shopping server is unavailable."))
    : Promise.resolve({ shoppingMetadataVersion: 1, ownerUserId: owner, items: [] }));
  render(<SavedMealRow row={savedRow()} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  fireEvent.click(await shoppingButton());
  expect(await screen.findByText("Shopping server is unavailable.")).toBeVisible();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockHydrate).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});
test("saved-card preflight rejects malformed readiness before any writes", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({});
  await expect(sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, true))
    .rejects.toThrow("readiness could not be confirmed");
  expect((apiRequest as jest.Mock).mock.calls.every(([, init]) => !init?.method)).toBe(true);
});
test("Saved Meals Shopping unwraps async Web Locks results and deduplicates concurrent sends", async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  const requestLock = jest.fn(async (_key: string, operation: () => Promise<unknown>) => operation());
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: requestLock } });
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) =>
    init?.method === "POST" ? { ok: true, success: true, itemsAdded: 1 } : { items: [] });
  try {
    const selection = selectionForRecipe(recipe(), "saved-meals").selection!;
    const results = await Promise.all([
      sendSavedMealToShopping(selection, false),
      sendSavedMealToShopping(selection, false),
    ]);
    expect(results).toEqual([{ alreadyAdded: false }, { alreadyAdded: false }]);
    expect(requestLock).toHaveBeenCalledTimes(1);
    expect((apiRequest as jest.Mock).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  } finally {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else delete (navigator as any).locks;
  }
});
test("Saved Meals works with the existing metadata-free API and itemsAdded acknowledgement", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (url: string, init?: any) =>
    url.endsWith("/capabilities") ? { available: false }
    : init?.method === "POST" ? { ok: true, success: true, itemsAdded: 1 }
    : { items: [] });
  render(<SavedMealRow row={savedRow()} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  fireEvent.click(await shoppingButton());
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2?from=saved-meals"));
  const [, init] = (apiRequest as jest.Mock).mock.calls.find(([, options]) => options?.method === "POST")!;
  const payload = JSON.parse(init.body);
  expect(payload.items[0]).toEqual(expect.objectContaining({ name: "chicken", quantity: 2, unit: "lb" }));
  expect(payload.items[0]).not.toHaveProperty("ingredientMetadata");
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved to Shopping List" }));
});
test("metadata-capable reads do not require a metadata advertisement on the save acknowledgement", async () => {
  const owner = localStorage.getItem("userId");
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) =>
    init?.method === "POST" ? { ok: true, success: true, added: 1, itemsAdded: 1 }
    : { shoppingMetadataVersion: 1, ownerUserId: owner, items: [] });
  await sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, true);
  const [, init] = (apiRequest as jest.Mock).mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(JSON.parse(init.body).items[0]).toHaveProperty("ingredientMetadata");
});
test("unknown advertised metadata versions are rejected rather than silently downgraded", async () => {
  (apiRequest as jest.Mock).mockResolvedValue({ shoppingMetadataVersion: 2, items: [] });
  await expect(sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, true))
    .rejects.toThrow("does not support Development ingredient metadata");
  expect((apiRequest as jest.Mock).mock.calls).toHaveLength(1);
});
test("saved-card sender rejects an account switch before its write", async () => {
  const owner = localStorage.getItem("userId");
  (apiRequest as jest.Mock).mockImplementation(async () => {
    localStorage.setItem("userId", "different-account");
    return { shoppingMetadataVersion: 1, ownerUserId: owner, items: [] };
  });
  await expect(sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, true))
    .rejects.toThrow("Account changed");
  expect((apiRequest as jest.Mock).mock.calls).toHaveLength(1);
});
test("saved-card sender accepts the existing Production acknowledgement without metadata or new tables", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) =>
    init?.method === "POST" ? { ok: true, added: 1 } : { items: [] });
  await sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, false);
  expect((apiRequest as jest.Mock).mock.calls).toHaveLength(2);
  const [url, init] = (apiRequest as jest.Mock).mock.calls[1];
  expect(url).toBe("/api/shopping-list");
  expect(JSON.parse(init.body).items[0]).not.toHaveProperty("ingredientMetadata");
});
test("saved-card sender rejects an unconfirmed save rather than reporting success", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) =>
    init?.method === "POST" ? { ok: true, added: 0 } : { items: [] });
  await expect(sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, false))
    .rejects.toThrow("save was not confirmed");
});
test("returning to a saved recipe does not add its acknowledged server rows again", async () => {
  let saved = false;
  const posts = jest.fn();
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) => {
    if (init?.method === "POST") { posts(); saved = true; return { ok: true, itemsAdded: 1, items: [{ id: "stored-a" }] }; }
    return { items: saved ? [{ id: "stored-a" }] : [] };
  });
  const selection = selectionForRecipe(recipe(), "saved-meals").selection!;
  expect(await sendSavedMealToShopping(selection, true)).toEqual({ alreadyAdded: false });
  expect(await sendSavedMealToShopping(selection, true)).toEqual({ alreadyAdded: true });
  expect(posts).toHaveBeenCalledTimes(1);
});
test("removing the acknowledged recipe rows permits an intentional fresh add", async () => {
  const posts = jest.fn();
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) => {
    if (init?.method === "POST") { posts(); return { ok: true, added: 1, items: [{ id: `stored-${posts.mock.calls.length}` }] }; }
    return { items: [] };
  });
  const selection = selectionForRecipe(recipe(), "saved-meals").selection!;
  await sendSavedMealToShopping(selection, false);
  await sendSavedMealToShopping(selection, false);
  expect(posts).toHaveBeenCalledTimes(2);
});
test("a browser receipt-cache failure never reports a confirmed database save as failed", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (_url: string, init?: any) =>
    init?.method === "POST" ? { ok: true, added: 1, items: [{ id: "stored-a" }] } : { items: [] });
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await expect(sendSavedMealToShopping(selectionForRecipe(recipe(), "saved-meals").selection!, false))
      .resolves.toEqual({ alreadyAdded: false });
  } finally { storage.mockRestore(); warning.mockRestore(); }
});
test("saved cards retain an explicitly stored legacy recipe yield", async () => {
  const original = savedRow();
  const { servings, ...mealData } = original.mealData;
  render(<SavedMealRow row={{ ...original, mealData: { ...mealData, recipeServings: servings } }}
    sourceLabel={() => "Create a Dish"} onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  fireEvent.click(await shoppingButton());
  await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  expect(JSON.parse(post.mock.calls[0][1].body).selections[0].recipeYield).toBe(3);
});
test("saved header groups metadata and controls above a full-width title and image", () => {
  const row = savedRow();
  row.title = "Classic Baked Salmon with Roasted Seasonal Vegetables and a Long Recipe Title";
  const remove = jest.fn();
  const { container } = render(<SavedMealRow row={row} sourceLabel={() => "Create a Dish"}
    onRemove={remove} onAddToMacros={jest.fn()} />);
  const header = container.querySelector("[data-saved-meal-header]")!;
  const metadata = header.querySelector("[data-saved-meal-metadata]")!;
  const controls = header.querySelector("[data-saved-meal-controls]")!;
  const title = header.querySelector<HTMLElement>("[data-saved-meal-title]")!;
  const trash = screen.getByRole("button", { name: `Remove: ${row.title}` });
  expect(metadata).toHaveTextContent("Create a Dish");
  expect(metadata).toHaveTextContent("Cal / serving");
  expect(controls).toContainElement(trash);
  expect(controls.querySelector(".lucide-chevron-right")).not.toBeNull();
  expect(controls).not.toContainElement(title);
  expect(title).toHaveTextContent(row.title);
  expect(title).toHaveClass("whitespace-normal", "break-words");
  expect(title).not.toHaveClass("truncate");
  expect(screen.getByRole("button", { expanded: false })).toHaveClass("w-full", "!p-0");
  const image = screen.getByTestId("meal-image");
  expect(header).not.toContainElement(image);
  expect(header.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(trash);
  expect(remove).toHaveBeenCalledWith(row);
  expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  fireEvent.click(title);
  expect(screen.getByRole("button", { expanded: true })).toHaveAttribute("aria-controls", `saved-meal-details-${row.id}`);
  expect(controls.querySelector(".lucide-chevron-down")).not.toBeNull();
  expect(screen.getAllByTestId("meal-image")).toHaveLength(1);
});
test("saved header expands without title truncation and keeps removal independent", () => {
  const { container } = render(<SavedMealRow row={savedRow()} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} />);
  const toggle = screen.getByRole("button", { expanded: false, name: /Chicken/ });
  expect(toggle.querySelector(".truncate")).toBeNull();
  expect(toggle.querySelector(".whitespace-normal")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Add to Macros" })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getAllByTestId("meal-image")).toHaveLength(1);
  fireEvent.click(toggle);
  expect(container.querySelector("[data-meal-card-actions]")).toBeNull();
  expect(screen.getByRole("button", { name: "Remove: Chicken" })).toBeVisible();
  fireEvent.click(screen.getByTestId("meal-image"));
  expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
});
test("saved recipes with unknown quantities stay blocked even when Shopping is activated", async () => {
  const row = savedRow();
  row.mealData.ingredients = [{ name: "chicken", quantity: 0, unit: "lb" }];
  render(<SavedMealRow row={row} sourceLabel={() => "Create a Dish"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  expect(await screen.findByText(/Review ingredient names and quantities/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Shopping: Chicken" })).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});
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
