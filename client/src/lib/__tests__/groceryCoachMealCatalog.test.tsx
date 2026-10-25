/** @jest-environment jsdom */
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: true }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
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
jest.mock("@/lib/queryClient", () => ({ apiRequest: jest.fn(), queryClient: { invalidateQueries: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { items: [] } }) }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "catalog-user" } }) }));
jest.mock("@/components/ui/pill-button", () => ({ PillButton: () => null }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import GroceryStoreCoachSheet from "@/components/shopping/GroceryStoreCoachSheet";
import MealIngredientBrands from "@/components/shopping/MealIngredientBrands";
import { packagedProductEligibility, recipeShoppingQuantity } from "@/lib/groceryCoachPackagedIngredients";
import { post, get } from "@/lib/api";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";

const ingredient = { item: "Spaghetti sauce", quantity: "1.5", unit: "cups", category: "Pantry" };
const meal = {
  meal: { name: "Turkey Spaghetti", description: "Dinner", prepTime: "20m", servings: 2 },
  servingCount: 2, macros: { calories: 700, protein: 40, carbs: 70, fat: 20 },
  reasoning: [], followUpSuggestions: [],
  shoppingList: [ingredient, { item: "Cucumber", quantity: "1", unit: "", category: "Produce" }],
  ownedIngredients: [{ item: "Parmesan cheese", quantity: "2", unit: "tbsp" }],
};
function analysis(name = "Example Tomato Sauce"): IngredientScanResult {
  return {
    analysisMethod: "by_name", productName: "", alignmentGrade: "B",
    overallSummary: "Personalized product guidance", verdict: "Consider after checking the current label.",
    verdictLevel: "caution", analysisProfile: ["Food allergy"],
    scoreCards: Object.fromEntries(["kids", "adults", "diet", "fitnessGoal"].map(k => [k, { verdict: "neutral", reason: "" }])) as any,
    outcomeCards: [], profileFactorsUsed: ["Food allergy"], whatMattersMost: [],
    betterAlternatives: [{ category: name, whyBetter: ["Compare sodium for your goals"], targetCriteria: "Check the current ingredient and allergen label." }],
    ingredientDecoder: [], ingredientConsiderations: ["Do not consume until relevant safety information is confirmed."],
    mayNotAlignWith: [], betterFor: [], householdNotes: [],
    educationalFooter: "Not allergy or medical safety clearance.",
    extractedIngredients: [], highRiskFindings: [], ocrConfidenceLow: false,
    fallbackUsed: false, isFrontLabel: false, productNameMissing: false,
  };
}
const response = (name?: string) => ({ ok: true, result: analysis(name) });
const addItems = jest.fn();
function seed(shoppingList = meal.shoppingList) {
  localStorage.setItem("grocery-coach-session:catalog-user", JSON.stringify({
    result: { ...meal, shoppingList }, conversation: [], savedAt: Date.now(),
    cardPhase: "ready", mealCard: { id: "existing-card", destination: "/favorites" },
  }));
}
beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  (get as jest.Mock).mockResolvedValue({ items: [] });
  (post as jest.Mock).mockResolvedValue(response());
  (useShoppingListStore as unknown as jest.Mock).mockReturnValue(addItems);
});

describe("explicit packaged-product discovery eligibility", () => {
  it.each([["1.5", 1.5], ["1/2", .5], ["1 1/2", 1.5], ["½", .5], ["1½", 1.5], ["to taste", null], ["1-2", null], ["1/0", null]])("preserves exact recipe quantity %s without inventing packages", (raw, expected) => {
    expect(recipeShoppingQuantity(String(raw))).toBe(expected);
  });
  it.each(["Spaghetti", "spaghetti sauce", "Parmesan cheese", "vegetable broth", "tofu", "milk", "plain milk"])("allows %s", name => {
    expect(packagedProductEligibility(name)).toEqual({ eligible: true, reason: "packaged_product" });
  });
  it.each(["Cucumber", "Lemon", "Chicken breast", "Ground turkey", "Olive oil", "Mixed greens", "spaghetti squash", "homemade spaghetti sauce", "unknown item", "breast milk"])("does not require brands for %s", name => {
    expect(packagedProductEligibility(name).eligible).toBe(false);
  });
});

describe("Development ingredient-level Product Scan reuse", () => {
  it.each(["Parmesan cheese", "Whole wheat spaghetti", "Spaghetti sauce"])("analyzes the exact %s ingredient only after clicking", async item => {
    render(<MealIngredientBrands ingredient={{ ...ingredient, item }} servings={2} onSelect={jest.fn()} onAddProduct={jest.fn()} />);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Tomato Sauce");
    expect(post).toHaveBeenCalledWith("/api/biometrics/ingredient-scan-by-name", { productName: item });
    expect(screen.queryByTestId("catalog-product-match")).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose for shopping/)).not.toBeInTheDocument();
    expect(screen.getByText(/Do not consume until/)).toBeInTheDocument();
    expect(screen.getByText("Not allergy or medical safety clearance.")).toBeInTheDocument();
  });

  it("uses real shared cards and Add to transfer the ingredient, exact fraction, recipe and unverified choice", async () => {
    seed([{ ...ingredient, quantity: "1/2" }, meal.shoppingList[1]]);
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    await screen.findByText("Turkey Spaghetti");
    expect(screen.getAllByText("Find brands")).toHaveLength(1);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Tomato Sauce");
    expect(screen.getByText(/Recipe amount: 1\/2 cups · 2 servings/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ingredientSheet.add" }));
    const selected = addItems.mock.calls[0][0][0];
    expect(selected).toMatchObject({
      name: "Spaghetti sauce", quantity: .5, unit: "cups",
      ingredientMetadata: {
        ingredient: { originalName: "Spaghetti sauce" },
        selectedProduct: {
          name: "Example Tomato Sauce", evidence: [],
          source: { source: "Product Scan by-name guidance" },
          assessment: { status: "review_required", unresolvedRequirements: ["current_profile_and_label_review"] },
        },
      },
    });
    expect(selected.ingredientMetadata.contributions[0]).toMatchObject({
      quantity: "1/2", unit: "cups", recipeId: "existing-card", recipeName: "Turkey Spaghetti",
    });
    expect(JSON.parse(selected.ingredientMetadata.selectedProduct.sourcePayloadJson)).toEqual(analysis());
    expect(selected.ingredientMetadata.selectedProduct).not.toHaveProperty("upc");
    expect(selected.notes).toContain("2 servings");
    expect(selected.notes).toContain("not medically revalidated");
    expect(meal.shoppingList[0]).toEqual(ingredient);
    const header = screen.getByText("ingredientSheet.header.intelligence").parentElement!.parentElement!;
    fireEvent.click(within(header).getByRole("button"));
    expect(screen.getByText("Turkey Spaghetti")).toBeInTheDocument();
    expect(screen.getByText("1/2 cups")).toBeInTheDocument();
    expect(screen.queryByText("Example Tomato Sauce")).not.toBeInTheDocument();
  });

  it("Find a Product and the original Add All transfer remain unchanged", async () => {
    seed();
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    await screen.findByText("Turkey Spaghetti");
    fireEvent.click(screen.getByTestId("tab-find-product"));
    fireEvent.change(screen.getByTestId("input-find-product"), { target: { value: "spaghetti sauce" } });
    fireEvent.click(screen.getByTestId("button-product-search"));
    await screen.findByText("Example Tomato Sauce");
    expect(post).toHaveBeenCalledWith("/api/biometrics/ingredient-scan-by-name", { productName: "spaghetti sauce" });
    fireEvent.click(screen.getByTestId("tab-build-meal"));
    expect(screen.getByText("Turkey Spaghetti")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add All to Shopping List"));
    expect(addItems.mock.calls[0][0][0]).toMatchObject({ name: "Spaghetti sauce", quantity: 1.5, unit: "cups" });
  });

  it("keeps errors local and retries without losing the meal", async () => {
    seed();
    (post as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    render(<GroceryStoreCoachSheet open onOpenChange={jest.fn()} />);
    fireEvent.click(await screen.findByText("Find brands"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't look up brands for Spaghetti sauce");
    expect(screen.getByText("Turkey Spaghetti")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Tomato Sauce");
  });

  it("does not fabricate options for an empty result or show Add for an unknown amount", async () => {
    const empty = analysis();
    empty.betterAlternatives = [];
    (post as jest.Mock).mockResolvedValue({ ok: true, result: empty });
    render(<MealIngredientBrands ingredient={{ ...ingredient, quantity: "to taste" }} servings={2} onSelect={jest.fn()} onAddProduct={jest.fn()} />);
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Personalized product guidance");
    expect(screen.queryByRole("button", { name: "ingredientSheet.add" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Review the recipe amount");
  });

  it("keeps simultaneous ingredients and their Add callbacks separate even when responses arrive out of order", async () => {
    let finish!: (data: any) => void;
    (post as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response("Example Pasta"));
    const firstAdd = jest.fn(), secondAdd = jest.fn();
    render(<>
      <section data-testid="sauce"><MealIngredientBrands ingredient={ingredient} servings={2} onSelect={jest.fn()} onAddProduct={firstAdd} /></section>
      <section data-testid="pasta"><MealIngredientBrands ingredient={{ ...ingredient, item: "Whole wheat spaghetti" }} servings={2} onSelect={jest.fn()} onAddProduct={secondAdd} /></section>
    </>);
    fireEvent.click(within(screen.getByTestId("sauce")).getByText("Find brands"));
    fireEvent.click(within(screen.getByTestId("pasta")).getByText("Find brands"));
    await screen.findByText("Example Pasta");
    await act(async () => { finish(response()); });
    fireEvent.click(within(screen.getByTestId("pasta")).getByRole("button", { name: "ingredientSheet.add" }));
    expect(secondAdd).toHaveBeenCalledWith("Example Pasta", analysis("Example Pasta"));
    expect(firstAdd).not.toHaveBeenCalled();
    expect(within(screen.getByTestId("sauce")).queryByText("Example Pasta")).not.toBeInTheDocument();
  });

  it("discards a late response after changing the ingredient on the same component", async () => {
    let finish!: (data: any) => void;
    (post as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response("Example Pasta"));
    const onAddProduct = jest.fn();
    const view = render(<MealIngredientBrands ingredient={ingredient} servings={2} onSelect={jest.fn()} onAddProduct={onAddProduct} />);
    fireEvent.click(screen.getByText("Find brands"));
    view.rerender(<MealIngredientBrands ingredient={{ ...ingredient, item: "Whole wheat spaghetti" }} servings={2} onSelect={jest.fn()} onAddProduct={onAddProduct} />);
    fireEvent.click(screen.getByText("Find brands"));
    await screen.findByText("Example Pasta");
    await act(async () => { finish(response()); });
    expect(screen.queryByText("Example Tomato Sauce")).not.toBeInTheDocument();
    expect(screen.getByText("Example Pasta")).toBeInTheDocument();
  });

  it("treats provider fallback as a retryable failure, not a recommendation", async () => {
    (post as jest.Mock).mockResolvedValue({ ok: true, result: { ...analysis(), fallbackUsed: true } });
    render(<MealIngredientBrands ingredient={ingredient} servings={2} onSelect={jest.fn()} onAddProduct={jest.fn()} />);
    fireEvent.click(screen.getByText("Find brands"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't look up brands"));
    expect(screen.queryByText("Example Tomato Sauce")).not.toBeInTheDocument();
  });
});
