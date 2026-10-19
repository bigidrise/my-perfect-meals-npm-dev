/** @jest-environment jsdom */
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: true }));
jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), createPortal: (node: any) => node }));
jest.mock("@/components/MealRefinementSheet", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ __esModule: true, default: () => null }));
jest.mock("wouter", () => ({ useLocation: () => ["/", jest.fn()] }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "catalog-user" } }) }));
jest.mock("@/components/ui/pill-button", () => ({ PillButton: () => null }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import GroceryStoreCoachSheet from "@/components/shopping/GroceryStoreCoachSheet";
import MealIngredientBrands from "@/components/shopping/MealIngredientBrands";
import { packagedProductEligibility, recipeShoppingQuantity } from "@/lib/groceryCoachPackagedIngredients";
import { post, get } from "@/lib/api";
import { useShoppingListStore } from "@/stores/shoppingListStore";

const ingredient = { item: "Spaghetti sauce", quantity: "1.5", unit: "cups", category: "Pantry" };
const meal = {
  meal: { name: "Turkey Spaghetti", description: "Dinner", prepTime: "20m", servings: 2 },
  servingCount: 2, macros: { calories: 700, protein: 40, carbs: 70, fat: 20 },
  reasoning: [], followUpSuggestions: [],
  shoppingList: [ingredient, { item: "Cucumber", quantity: "1", unit: "", category: "Produce" }],
  ownedIngredients: [{ item: "Parmesan cheese", quantity: "2", unit: "tbsp" }],
};
const product = {
  productKey: "exact-record-1", brand: "Example", name: "Tomato Sauce", barcode: "012345678901",
  ingredients: "Tomatoes, water", serving: "125 g", source: "USDA FoodData Central",
  sourceRecordId: "record-1", catalogDate: null,
  evidenceStatus: "needs_verification" as const, recommendationStatus: "review" as const,
  verificationMessage: "Allergen precaution information unavailable. Check the label.",
  nutrition: [{ statement: "Sodium 100 mg per 100 g", source: "USDA" }],
};
const catalog = { advice: [], profileUsed: ["Food allergy"], catalogMatches: [product], excludedReasons: ["Known milk conflict"] };
const addItems = jest.fn();
function seed() {
  localStorage.setItem("grocery-coach-session:catalog-user", JSON.stringify({
    result: meal, conversation: [], savedAt: Date.now(),
    cardPhase: "ready", mealCard: { id: "existing-card", destination: "/favorites" },
  }));
}
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockResolvedValue(catalog);
  (useShoppingListStore as unknown as jest.Mock).mockReturnValue(addItems);
});

describe("explicit packaged-product discovery eligibility", () => {
  it.each([["1.5", 1.5], ["1/2", .5], ["1 1/2", 1.5], ["½", .5], ["1½", 1.5], ["to taste", null], ["1-2", null], ["1/0", null]])("preserves exact recipe quantity %s without inventing packages", (raw, expected) => {
    expect(recipeShoppingQuantity(String(raw))).toBe(expected);
  });
  it.each(["Spaghetti", "spaghetti sauce", "Parmesan cheese", "vegetable broth", "tofu"])("allows %s", name => {
    expect(packagedProductEligibility(name)).toEqual({ eligible: true, reason: "packaged_product" });
  });
  it.each(["Cucumber", "Lemon", "Chicken breast", "Ground turkey", "Olive oil", "Mixed greens", "spaghetti squash", "homemade spaghetti sauce", "unknown item"])("does not require brands for %s", name => {
    expect(packagedProductEligibility(name).eligible).toBe(false);
  });
});

describe("Development Grocery Coach catalog integration", () => {
  it("never auto-searches; offers brands only for eligible items to buy, preserving the selected quantity and servings", async () => {
    seed();
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    await screen.findByText("Turkey Spaghetti");
    expect(screen.getAllByText("Find brands")).toHaveLength(1);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Tomato Sauce");
    expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
      ingredients: ["Spaghetti sauce"], mode: "find_product",
    });
    expect(screen.getByText(/Recipe amount: 1.5 cups · 2 servings/)).toBeInTheDocument();
    expect(screen.getByText("Check the Label")).toBeInTheDocument();
    expect(screen.getByText(/Allergen precaution information unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Known milk conflict/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Choose for shopping — label review needed"));
    fireEvent.click(screen.getByText("Add All to Shopping List"));
    const selected = addItems.mock.calls[0][0][0];
    expect(selected).toMatchObject({ name: "Example Tomato Sauce", quantity: 1.5, unit: "cups" });
    expect(selected.notes).toContain("2 servings");
    expect(selected.notes).toContain("UPC 012345678901");
    expect(selected.notes).toContain("not medically revalidated");
    expect(meal.shoppingList[0]).toEqual(ingredient);
    expect(meal.servingCount).toBe(2);
    expect(screen.getByText(/Catalog serving: 125 g \(not the recipe quantity\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear choice"));
    expect(screen.queryByText(/Shopping choice:/)).not.toBeInTheDocument();
  });

  it("Find a Product uses the same catalog endpoint and preserves the meal on return", async () => {
    seed();
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    await screen.findByText("Turkey Spaghetti");
    fireEvent.click(screen.getByTestId("tab-find-product"));
    fireEvent.change(screen.getByTestId("input-find-product"), { target: { value: "spaghetti sauce" } });
    fireEvent.click(screen.getByTestId("button-product-search"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
      ingredients: ["spaghetti sauce"], mode: "find_product",
    }));
    await screen.findByText(/Example.*Tomato Sauce/);
    fireEvent.click(screen.getByTestId("tab-build-meal"));
    await screen.findByText("Turkey Spaghetti");
    expect(screen.getByText("1.5 cups")).toBeInTheDocument();
  });

  it("keeps lookup errors local to the ingredient and permits retry without losing the meal", async () => {
    seed();
    (post as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    await screen.findByText("Turkey Spaghetti");
    fireEvent.click(screen.getByText("Find brands"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't look up brands for Spaghetti sauce");
    expect(screen.getByText("Turkey Spaghetti")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Tomato Sauce");
  });

  it("does not show invented replacements when no candidates pass", async () => {
    (post as jest.Mock).mockResolvedValue({ ...catalog, catalogMatches: [] });
    render(<MealIngredientBrands ingredient={ingredient} servings={2} onSelect={jest.fn()} />);
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText(/No suitable catalog options/);
    expect(screen.queryByText(/Choose for shopping/)).not.toBeInTheDocument();
  });

  it("discards a late lookup after its ingredient is removed", async () => {
    let finish!: (data: any) => void;
    (post as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onSelect = jest.fn();
    const view = render(<MealIngredientBrands ingredient={ingredient} servings={2} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Find brands"));
    view.unmount();
    await act(async () => { finish(catalog); });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
