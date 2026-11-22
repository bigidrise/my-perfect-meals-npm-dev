/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { post } from "@/lib/api";
import ShoppingProductPicker from "@/components/shopping/ShoppingProductPicker";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import { BetterAlternativesSection } from "@/components/biometrics/IngredientIntelligenceSheet";
import { parseShoppingProductReference } from "@shared/shoppingProductSelection";
import * as actionsGate from "@/lib/shoppingProductActionsGate";
import type { ShoppingIngredientRequest, ShoppingProductReference, ShoppingProductSelection } from "@shared/shoppingProductSelection";

jest.mock("@/lib/api", () => ({ post: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "offline-shopping-user" } }) }));
jest.mock("@/components/shopping/RecommendedProductActions", () => ({
  __esModule: true,
  default: jest.fn(({ label }) => <button>{label || "Coach Save recommendation"}</button>),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key === "common.cancel" ? "Cancel" : key === "common.tryAgain" ? "Try again" : key }),
}));
jest.mock("@/components/ui/universal-modal", () => ({
  PickerModal: ({ open, title, description, children, footer }: any) => open
    ? <section role="dialog" aria-label={title}><p>{description}</p>{children}{footer}</section>
    : null,
}));

const ingredient: ShoppingIngredientRequest = {
  originalName: "plain milk",
  requirements: [],
};
const selection = {
  ingredient,
  product: {
    productKey: "milk-a",
    name: "Whole Milk",
    brand: "Northfield",
    source: { source: "synthetic test", sourceRecordId: "record-1" },
    evidence: [
      { kind: "ingredients", statement: "Milk", provenance: { source: "synthetic test" } },
      { kind: "nutrition", statement: "Synthetic sourced nutrition", provenance: { source: "synthetic test" } },
    ],
    assessment: { status: "eligible_at_evaluation", unresolvedRequirements: [], reasons: [],
      subjectReference: "member-a", contextReference: "profile-a", evaluatedAt: "2026-10-21", policyVersion: "synthetic-only" },
  },
} as unknown as ShoppingProductSelection;
const supported = {
  productKey: "milk-a",
  name: "Whole Milk",
  brand: "Northfield",
  barcode: null,
  ingredients: "Milk",
  serving: "1 cup",
  catalogDate: null,
  source: "Synthetic catalog",
  sourceRecordId: "record-1",
  evidenceStatus: "eligible",
  recommendationStatus: "profile_matched_pick",
  verificationMessage: "Existing evidence supports this option.",
  shoppingSelection: { eligible: true, selection },
};
const review = {
  ...supported,
  productKey: "milk-review",
  name: "Unverified Milk",
  brand: "Other",
  evidenceStatus: "needs_verification",
  shoppingDisplay: "label_review",
  shoppingCaution: "Compatibility with your requirements isn't confirmed. Check the current label.",
  shoppingSelection: { eligible: false, reason: "needs_review" },
};

function makeShoppingReference(
  productKey = "synthetic-reference-oil",
  ingredientRequest: ShoppingIngredientRequest = { originalName: "olive oil", requirements: [] },
  decisionStatus: "needs_verification" | "rejected" = "needs_verification",
): ShoppingProductReference {
  const identity = {
    match: "exact_variant",
    key: productKey,
    name: "Olive Oil",
    brand: "Synthetic Alpha",
    variant: "Cold-pressed",
    provenance: { source: "Synthetic catalog", sourceRecordId: "reference-record" },
  };
  return parseShoppingProductReference({
    ingredient: ingredientRequest,
    product: {
      ...selection.product,
      selectionKind: "unverified_shopping_reference",
      productKey,
      name: "Olive Oil",
      brand: "Synthetic Alpha",
      variant: "Cold-pressed",
      packageDescription: "500 mL glass bottle",
      upc: "12345678",
      source: { source: "Synthetic catalog", sourceRecordId: "reference-record" },
      sourcePayloadJson: JSON.stringify({
        identity: { ...identity, barcode: "12345678", packageSize: "500 mL glass bottle" },
        decision: {
          status: decisionStatus,
          productKey,
          subjectId: "member-a",
          contextFingerprint: "profile-a",
          reasons: decisionStatus === "rejected" ? [{ code: "hard_conflict" }] : [],
        },
      }),
      assessment: {
        status: "review_required",
        unresolvedRequirements: ["Current ingredient label not reviewed", "Dietary context unresolved"],
        reasons: ["Reference is not an eligibility decision"],
        subjectReference: "member-a",
        contextReference: "profile-a",
        evaluatedAt: "2026-10-21",
        policyVersion: "synthetic-only",
      },
    },
  });
}

function referenceResponse(options: {
  reference?: ShoppingProductReference;
  catalogReference?: ShoppingProductReference;
  identityVerified?: boolean;
} = {}) {
  const response: any = sharedResponse("olive oil");
  const reference = options.reference ?? makeShoppingReference();
  response.recommendations = response.recommendations.slice(0, 1);
  response.catalogMatches = [{
    ...response.catalogMatches[0],
    productKey: reference.product.productKey,
    name: reference.product.name,
    brand: reference.product.brand!,
    variant: reference.product.variant,
    recommendationIdentityVerified: options.identityVerified ?? true,
    ...(options.identityVerified === false ? { shoppingDisplay: "label_review" } : {}),
    recommendationLead: response.recommendations[0].category,
    shoppingReference: options.catalogReference ?? reference,
    shoppingSelection: { eligible: false, reason: "reference_only" },
  }];
  response.recommendationChecks = [{
    recommendationCategory: response.recommendations[0].category,
    status: "review_only",
    catalogProductKey: reference.product.productKey,
    reason: "Label review remains unresolved.",
    reference,
  }];
  return response;
}

function renderPicker(props: Partial<React.ComponentProps<typeof ShoppingProductPicker>> = {}) {
  const onOpenChange = jest.fn();
  const onCommit = jest.fn().mockResolvedValue(undefined);
  const result = render(
    <ShoppingProductPicker
      open={false}
      onOpenChange={onOpenChange}
      ingredient={ingredient}
      quantityLabel="2 cups"
      sessionKey="member-a:profile-a"
      currentSelection={null}
      onCommit={onCommit}
      {...props}
    />,
  );
  return { ...result, onOpenChange, onCommit };
}

function sharedResponse(originalName = "olive oil") {
  const rowIngredient = { originalName, requirements: [] };
  const recommendations = ["Alpha", "Beta", "Gamma"].map(brand => ({
    category: `Synthetic ${brand} Olive Oil`, brand: `Synthetic ${brand}`, productName: "Olive Oil",
    whyBetter: [`Original personalized ${brand} explanation`],
    targetCriteria: `Check the ${brand} label`,
  }));
  const catalogMatches = recommendations.map((alternative, index) => {
    const productKey = `synthetic-oil-${index}`;
    return {
      ...supported, productKey, name: "Olive Oil", brand: alternative.brand,
      ingredients: "Olive oil", shoppingDisplay: "selectable",
      recommendationIdentityVerified: true,
      recommendationLead: alternative.category,
      shoppingSelection: { eligible: true, selection: {
        ...selection, ingredient: rowIngredient,
        product: { ...selection.product, productKey, name: "Olive Oil", brand: alternative.brand },
      } },
    };
  });
  return {
    catalogSearchAvailable: true, recommendations, catalogMatches,
    recommendationChecks: recommendations.map((alternative, index) => ({
      recommendationCategory: alternative.category, status: "eligible",
      productKey: catalogMatches[index].productKey, reason: "Exact record passed.",
    })),
    recommendationContext: { query: originalName, educationalFooter: "Original education", verdictLevel: "buy" },
  };
}

test.each(["olive oil", "Synthetic Brand Olive Oil"])(
  "shared Find a Product cards auto-search %s and commit only the chosen exact reference",
  async originalName => {
    const response = sharedResponse(originalName);
    (post as jest.Mock).mockResolvedValue(response);
    const { onCommit } = renderPicker({ open: true, ingredient: { originalName, requirements: [] } });
    const choices = await screen.findAllByRole("button", { name: "Choose Product" });
    expect(choices).toHaveLength(3);
    response.recommendations.forEach(alt => {
      expect(screen.getByText(alt.category)).toBeInTheDocument();
      expect(screen.getByText(alt.whyBetter[0])).toBeInTheDocument();
      expect(screen.getByText(new RegExp(alt.targetCriteria))).toBeInTheDocument();
    });
    expect(screen.queryByText("Coach Save recommendation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ingredientSheet.add$/ })).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
      mode: "find_product", ingredients: [originalName], shoppingIngredient: { originalName, requirements: [] },
    });
    expect(screen.getByText(/Original amount: 2 cups/)).toBeInTheDocument();
    fireEvent.click(choices[1]);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(response.catalogMatches[1].shoppingSelection.selection));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  },
);

test("Find a Product retains its original Add and Save action presentation without the adapter", () => {
  const response = sharedResponse();
  const add = jest.fn();
  render(<BetterAlternativesSection alternatives={response.recommendations} branded
    query="olive oil" educationalFooter="Original education" onAddToList={add} />);
  expect(screen.getAllByText("Coach Save recommendation")).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: "ingredientSheet.add" })[1]);
  expect(add).toHaveBeenCalledWith("Synthetic Beta Olive Oil");
  expect(screen.getByRole("button", { name: "ingredientSheet.added" })).toBeInTheDocument();
});

test("review-only cards preserve original explanations and the exact unresolved requirement", async () => {
  const response = sharedResponse();
  response.recommendationChecks = response.recommendationChecks.map(check => ({
    ...check, status: "review_only", reason: "Current allergen statement is unavailable.",
  }));
  (post as jest.Mock).mockResolvedValue(response);
  const { onCommit } = renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
  expect(await screen.findAllByText("This product could not be reliably identified. Choose another option or keep the ingredient generic.")).toHaveLength(3);
  expect(screen.getByText("Original personalized Alpha explanation")).toBeInTheDocument();
  screen.getAllByRole("button", { name: "Choose Product" }).forEach(button => expect(button).toBeDisabled());
  expect(onCommit).not.toHaveBeenCalled();
});

test("one click selects an identifiable unverified product and retains its assessment only in the payload", async () => {
  const response = referenceResponse();
  const onCommitReference = jest.fn().mockResolvedValue(undefined);
  (post as jest.Mock).mockResolvedValue(response);
  renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] }, onCommitReference });

  fireEvent.click(await screen.findByRole("button", { name: "Choose Product" }));
  await waitFor(() => expect(onCommitReference).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Confirm shopping reference" })).not.toBeInTheDocument();
  expect(screen.queryByText("Review product identity and label evidence")).not.toBeInTheDocument();
  expect(onCommitReference).toHaveBeenCalledWith(response.recommendationChecks[0].reference);
  expect(onCommitReference.mock.calls[0][0].product.selectionKind).toBe("unverified_shopping_reference");
  expect(onCommitReference.mock.calls[0][0].product.assessment.status).toBe("review_required");
});

test("an identifiable named product selects directly even when package verification is incomplete", async () => {
  const response = referenceResponse({ identityVerified: false });
  const reference: ShoppingProductReference = response.catalogMatches[0].shoppingReference;
  const onCommitReference = jest.fn().mockResolvedValue(undefined);
  (post as jest.Mock).mockResolvedValue(response);
  const { onCommit } = renderPicker({ open: true, ingredient: reference.ingredient, onCommitReference });
  fireEvent.click(await screen.findByRole("button", { name: "Choose Product" }));
  await waitFor(() => expect(onCommitReference).toHaveBeenCalledWith(reference));
  expect(screen.getByText("Product details not fully verified.")).toBeInTheDocument();
  expect(screen.queryByText("Review the actual catalog product")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm shopping reference" })).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(reference.product.assessment.status).toBe("review_required");
});

test("Primal Kitchen Avocado Oil can never select a buffalo sauce catalog record", async () => {
  const original = makeShoppingReference();
  const snapshot = JSON.parse(original.product.sourcePayloadJson!);
  snapshot.identity.brand = "Primal Kitchen";
  snapshot.identity.name = "Hot Buffalo Sauce Made With Avocado Oil";
  const reference: ShoppingProductReference = {
    ...original, product: { ...original.product, brand: snapshot.identity.brand,
      name: snapshot.identity.name, sourcePayloadJson: JSON.stringify(snapshot) },
  };
  const response = referenceResponse({ reference, identityVerified: false });
  response.recommendations[0].category = "Primal Kitchen Avocado Oil";
  response.recommendationChecks[0].recommendationCategory = "Primal Kitchen Avocado Oil";
  response.catalogMatches[0].recommendationLead = "Primal Kitchen Avocado Oil";
  const onCommitReference = jest.fn();
  (post as jest.Mock).mockResolvedValue(response);
  const { onCommit } = renderPicker({ open: true, ingredient: reference.ingredient, onCommitReference });
  expect(await screen.findByRole("button", { name: "Choose Product" })).toBeDisabled();
  expect(onCommitReference).not.toHaveBeenCalled();
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.queryByText(/Review the actual catalog product/)).not.toBeInTheDocument();
});

test("Shopping availability uses gold text and a larger matching pin without changing its wording or green reasons", async () => {
  const response = sharedResponse();
  (post as jest.Mock).mockResolvedValue(response);
  renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
  const availability = await screen.findByText(response.recommendations[0].targetCriteria);
  expect(availability.closest("p")).toHaveClass("font-medium", "text-[#FACC15]");
  expect(availability.closest("p")!.querySelector("svg")).toHaveClass("h-3.5", "w-3.5", "text-[#FACC15]");
  expect(screen.getByText(response.recommendations[0].whyBetter[0]).closest("span.inline-flex")).toHaveClass("text-emerald-300");
});

test.each(["different exact product", "known conflict", "unverified catalog identity"])(
  "reference action fails closed for %s",
  async defect => {
    const reference = makeShoppingReference();
    let response: any;
    if (defect === "different exact product") {
      response = referenceResponse({ reference, catalogReference: makeShoppingReference("different-product") });
    } else if (defect === "known conflict") {
      const conflicted = {
        ...reference,
        product: {
          ...reference.product,
          sourcePayloadJson: JSON.stringify({
            identity: {
              match: "exact_variant", key: reference.product.productKey, name: reference.product.name,
              brand: reference.product.brand, variant: reference.product.variant,
              provenance: { source: "Synthetic catalog", sourceRecordId: "reference-record" },
              barcode: reference.product.upc,
            },
            decision: {
              status: "rejected", productKey: reference.product.productKey,
              subjectId: "member-a", contextFingerprint: "profile-a",
              reasons: [{ code: "hard_conflict" }],
            },
          }),
        },
      } as ShoppingProductReference;
      response = referenceResponse({ reference: conflicted, catalogReference: conflicted });
    } else {
      response = referenceResponse({ reference, identityVerified: false });
      const source = JSON.parse(reference.product.sourcePayloadJson!);
      source.identity.match = "unverified";
      response.catalogMatches[0].shoppingReference = {
        ...reference, product: { ...reference.product, sourcePayloadJson: JSON.stringify(source) },
      };
    }
    (post as jest.Mock).mockResolvedValue(response);
    const onCommitReference = jest.fn();
    renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] }, onCommitReference });
    expect(await screen.findByText("This product could not be reliably identified. Choose another option or keep the ingredient generic.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Product" })).toBeDisabled();
    expect(onCommitReference).not.toHaveBeenCalled();
  },
);

test.each(["missing key", "cross-linked brand", "wrong ingredient", "hidden", "unverified evidence", "missing selection", "unverified variant"])(
  "shared cards fail closed for %s despite a claimed eligible recommendation",
  async defect => {
    const response = sharedResponse();
    response.recommendations = response.recommendations.slice(0, 1);
    response.recommendationChecks = response.recommendationChecks.slice(0, 1);
    const record = response.catalogMatches[0];
    if (defect === "missing key") response.recommendationChecks[0].productKey = "not-present";
    if (defect === "cross-linked brand") response.recommendationChecks[0].productKey = response.catalogMatches[1].productKey;
    if (defect === "wrong ingredient") record.shoppingSelection.selection.ingredient.originalName = "sauce";
    if (defect === "hidden") record.shoppingDisplay = "hidden";
    if (defect === "unverified evidence") record.evidenceStatus = "needs_verification";
    if (defect === "missing selection") record.shoppingSelection.selection = null as any;
    if (defect === "unverified variant") record.recommendationIdentityVerified = false;
    (post as jest.Mock).mockResolvedValue(response);
    const { onCommit } = renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
    expect(await screen.findByText("This product could not be reliably identified. Choose another option or keep the ingredient generic.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Product" })).toBeDisabled();
    expect(screen.queryByText(/Exact record passed/)).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  },
);

test("unavailable cards retain source evidence internally without exposing an audit report or selection capability", async () => {
  const response = sharedResponse();
  response.recommendationChecks = response.recommendationChecks.map(check => ({
    ...check, status: "review_only", productKey: undefined as any,
    catalogProductKey: check.productKey,
    reason: "Reviewed checks aren't available for the foods you avoid (quinoa). This does not mean the product contains a restricted ingredient.",
  }));
  (post as jest.Mock).mockResolvedValue(response);
  const { onCommit } = renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
  expect(await screen.findAllByText("This product could not be reliably identified. Choose another option or keep the ingredient generic.")).toHaveLength(3);
  expect(screen.queryByText("Review product identity and label evidence")).not.toBeInTheDocument();
  expect(response.catalogMatches[0].ingredients).toBe("Olive oil");
  screen.getAllByRole("button", { name: "Choose Product" }).forEach(button => expect(button).toBeDisabled());
  expect(onCommit).not.toHaveBeenCalled();
});

test("catalog outage keeps recommendations visible with unavailable Choose and a safe alternative", async () => {
  const response = sharedResponse();
  response.catalogSearchAvailable = false;
  (post as jest.Mock).mockResolvedValue(response);
  renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
  expect(await screen.findByText("Synthetic Alpha Olive Oil")).toBeInTheDocument();
  expect(screen.getByText("Original personalized Gamma explanation")).toBeInTheDocument();
  expect(screen.getAllByText("This product could not be reliably identified. Choose another option or keep the ingredient generic.")).toHaveLength(3);
  screen.getAllByRole("button", { name: "Choose Product" }).forEach(button => expect(button).toBeDisabled());
  expect(screen.getByRole("button", { name: "Find new options" })).toBeInTheDocument();
});

beforeEach(() => {
  jest.clearAllMocks();
  (actionsGate as any).shoppingProductActionsDevelopmentEnabled = true;
});

test.each(["olive oil", "Muir Glen Organic Tomato Basil Sauce"])(
  "opening the picker forwards its %s row directly without a search field or Add/Save action",
  async originalName => {
    (post as jest.Mock).mockResolvedValue({ catalogSearchAvailable: true, catalogMatches: [] });
    const rowIngredient = { originalName, requirements: [] };
    const { onCommit } = renderPicker({ open: true, ingredient: rowIngredient });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
      mode: "find_product",
      ingredients: [originalName],
      shoppingIngredient: rowIngredient,
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(add|save)( |$)/i })).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  },
);

test("shows the reused personalized explanation while Choose still requires structured eligibility", async () => {
  const notice = "Personalized recommendations were found, but their exact products or required checks could not be fully verified.";
  (post as jest.Mock).mockResolvedValue({
    catalogSearchAvailable: true, recommendationCount: 2, recommendationNotice: notice,
    catalogMatches: [{ ...review, shoppingCaution: "Reviewed checks aren't available for your dietary requirements.",
      recommendationExplanation: { whyBetter: ["Personalized explanation from Find a Product."], targetCriteria: "Check the current serving basis." } }],
  });
  renderPicker({ open: true });
  expect(await screen.findByText("Personalized explanation from Find a Product.")).toBeInTheDocument();
  expect(screen.getByText(notice)).toBeInTheDocument();
  expect(screen.getByText(/Reviewed checks aren't available/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Choose this option/ })).not.toBeInTheDocument();
});

test("does not request on list render or while the picker is closed", () => {
  renderPicker();
  expect(post).not.toHaveBeenCalled();
});

test("StrictMode dispatches one request per real opening and still refreshes on reopen", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [], catalogSearchAvailable: true });
  const props = {
    onOpenChange: jest.fn(), ingredient, quantityLabel: "2 cups",
    sessionKey: "member-a:profile-a", currentSelection: null,
    onCommit: jest.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<React.StrictMode><ShoppingProductPicker {...props} open /></React.StrictMode>);
  await screen.findByText(/No suitable specific product could be identified/);
  expect(post).toHaveBeenCalledTimes(1);
  rerender(<React.StrictMode><ShoppingProductPicker {...props} open={false} /></React.StrictMode>);
  rerender(<React.StrictMode><ShoppingProductPicker {...props} open /></React.StrictMode>);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  await screen.findByText(/No suitable specific product could be identified/);
  expect(post).toHaveBeenCalledTimes(2);
});

test("closing before dispatch cancels the abandoned lookup without blocking a fresh open", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [], catalogSearchAvailable: true });
  const props = {
    onOpenChange: jest.fn(), ingredient, quantityLabel: "2 cups",
    sessionKey: "member-a:profile-a", currentSelection: null,
    onCommit: jest.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<ShoppingProductPicker {...props} open />);
  rerender(<ShoppingProductPicker {...props} open={false} />);
  await act(async () => {});
  expect(post).not.toHaveBeenCalled();
  rerender(<ShoppingProductPicker {...props} open />);
  await screen.findByText(/No suitable specific product could be identified/);
  expect(post).toHaveBeenCalledTimes(1);
});

test("an explicit retry after failure sends a fresh request for the same ingredient", async () => {
  (post as jest.Mock).mockRejectedValueOnce({ status: 503 })
    .mockResolvedValueOnce({ catalogMatches: [supported], catalogSearchAvailable: true });
  const props = {
    onOpenChange: jest.fn(), ingredient, quantityLabel: "2 cups",
    sessionKey: "member-a:profile-a", currentSelection: null,
    onCommit: jest.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<ShoppingProductPicker {...props} open />);
  await screen.findByRole("alert");
  expect(post).toHaveBeenCalledTimes(1);
  rerender(<ShoppingProductPicker {...props} open={false} />);
  rerender(<ShoppingProductPicker {...props} open />);
  await screen.findByTestId("catalog-choice-milk-a");
  expect(post).toHaveBeenCalledTimes(2);
});

test("an abandoned ingredient lookup never sends and a changed product can be opened freshly", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [], catalogSearchAvailable: true });
  const nextIngredient = { originalName: "oatmeal", requirements: [] };
  const props = {
    onOpenChange: jest.fn(), quantityLabel: "2 cups",
    sessionKey: "member-a:profile-a", currentSelection: null,
    onCommit: jest.fn().mockResolvedValue(undefined),
  };
  const { rerender } = render(<ShoppingProductPicker {...props} ingredient={ingredient} open />);
  rerender(<ShoppingProductPicker {...props} ingredient={nextIngredient} open />);
  await act(async () => {});
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
  expect(post).not.toHaveBeenCalled();
  rerender(<ShoppingProductPicker {...props} ingredient={nextIngredient} open={false} />);
  rerender(<ShoppingProductPicker {...props} ingredient={nextIngredient} open />);
  await screen.findByText(/No suitable specific product could be identified/);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenLastCalledWith("/api/grocery-coach/product-advisor", {
    mode: "find_product", ingredients: ["oatmeal"], shoppingIngredient: nextIngredient,
  });
});

test("a new mount for the same ingredient does not reuse an earlier request", async () => {
  let resolveOld!: (value: any) => void;
  (post as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ catalogMatches: [], catalogSearchAvailable: true });
  const first = renderPicker({ open: true });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  first.unmount();
  renderPicker({ open: true });
  await screen.findByText(/No suitable specific product could be identified/);
  await act(async () => { resolveOld({ catalogMatches: [supported], catalogSearchAvailable: true }); });
  expect(post).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId("catalog-choice-milk-a")).not.toBeInTheDocument();
});

test.each([
  "oatmeal", "olive oil", "seasoning blend", "spice blend", "ketchup",
  "canned beans", "yogurt", "cereal", "bread", "tomato sauce",
])("the %s row offers a neutral, explicit product-options action without searching", name => {
  const onChoose = jest.fn();
  render(<SmartShoppingProductChoice
    item={{ name } as any}
    enabled
    hasAccess
    onChoose={onChoose}
    onUpgrade={jest.fn()}
    onClear={jest.fn().mockResolvedValue(undefined)}
  />);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "See Product Options" }));
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
});

test.each(["fresh tomatoes", "spinach", "fresh basil", "raw chicken", "homemade oatmeal"])(
  "%s does not offer a product lookup", name => {
    render(<SmartShoppingProductChoice
      item={{ name } as any}
      enabled
      hasAccess
      onChoose={jest.fn()}
      onUpgrade={jest.fn()}
      onClear={jest.fn().mockResolvedValue(undefined)}
    />);
    expect(screen.queryByRole("button", { name: "See Product Options" })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  },
);

test("the new action still upgrades a customer without access and never searches", () => {
  const onChoose = jest.fn(), onUpgrade = jest.fn();
  render(<SmartShoppingProductChoice
    item={{ name: "oatmeal" } as any}
    enabled
    hasAccess={false}
    onChoose={onChoose}
    onUpgrade={onUpgrade}
    onClear={jest.fn().mockResolvedValue(undefined)}
  />);
  fireEvent.click(screen.getByRole("button", { name: "See Product Options" }));
  expect(onUpgrade).toHaveBeenCalledTimes(1);
  expect(onChoose).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("the product-options action remains unavailable when Development metadata is disabled", () => {
  render(<SmartShoppingProductChoice
    item={{ name: "oatmeal" } as any}
    enabled={false}
    hasAccess
    onChoose={jest.fn()}
    onUpgrade={jest.fn()}
    onClear={jest.fn().mockResolvedValue(undefined)}
  />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test("disabled Smart Shopping does not expand historical Grocery Coach presentation", () => {
  render(<SmartShoppingProductChoice
    item={{ name: "oatmeal", ingredientMetadata: { ingredient: { originalName: "oatmeal" },
      selectedProduct: { ...selection.product, source: { source: "Product Scan by-name guidance" } } } } as any}
    enabled={false}
    hasAccess
    onChoose={jest.fn()}
    onUpgrade={jest.fn()}
    onClear={jest.fn().mockResolvedValue(undefined)}
  />);
  expect(screen.queryByText("Northfield Whole Milk")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test.each([0, 1, 2, 3])("renders %i sourced options without filling missing slots", async count => {
  const catalogMatches = Array.from({ length: count }, (_, index) => {
    const productKey = `milk-${index}`;
    return { ...supported, productKey, shoppingSelection: { eligible: true, selection: {
      ...selection, product: { ...selection.product, productKey },
    } } };
  });
  (post as jest.Mock).mockResolvedValue({ catalogMatches, catalogSearchAvailable: true });
  const { onCommit } = renderPicker({ open: true });
  expect(screen.getByRole("dialog", { name: "Finding your product options…" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.queryAllByRole("article")).toHaveLength(count);
  expect(screen.queryAllByRole("button", { name: "Choose this option" })).toHaveLength(count);
  expect(post).toHaveBeenCalledTimes(1);
  expect(onCommit).not.toHaveBeenCalled();
});

test("loading has structured shimmer placeholders and retry works without closing the modal", async () => {
  (post as jest.Mock).mockRejectedValueOnce({ status: 503 })
    .mockResolvedValueOnce({ catalogMatches: [supported], catalogSearchAvailable: true });
  const { container, onCommit, onOpenChange } = renderPicker({ open: true });
  expect(screen.getByRole("status", { name: "Loading product options" })).toBeInTheDocument();
  expect(container.querySelectorAll(".shopping-options-skeleton")).toHaveLength(2);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByTestId("catalog-choice-milk-a");
  expect(post).toHaveBeenCalledTimes(2);
  expect(onCommit).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("new options are explicit and never commit or erase the existing choice", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [supported], catalogSearchAvailable: true });
  const { onCommit } = renderPicker({ open: true, currentSelection: selection });
  await screen.findByTestId("catalog-choice-milk-a");
  fireEvent.click(screen.getByRole("button", { name: "Find new options" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post).toHaveBeenLastCalledWith("/api/grocery-coach/product-advisor",
    expect.objectContaining({ findNewOptions: true, shoppingIngredient: ingredient }));
  expect(onCommit).not.toHaveBeenCalled();
});

test("a denied Pro action has no picker mount and makes no request", () => {
  const onChoose = jest.fn();
  const onUpgrade = jest.fn();
  render(<SmartShoppingProductChoice
    item={{ name: "plain milk", ingredientMetadata: { ingredient: { originalName: "plain milk" }, selectedProduct: selection.product } } as any}
    enabled
    hasAccess={false}
    onChoose={onChoose}
    onUpgrade={onUpgrade}
    onClear={jest.fn().mockResolvedValue(undefined)}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(onUpgrade).toHaveBeenCalledTimes(1);
  expect(onChoose).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("explicit open sends one bounded lookup and shows up to three existing choices in server order", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [review, supported, ...["milk-b", "milk-c", "milk-d"].map(productKey => ({
      ...supported, productKey, shoppingSelection: { eligible: true, selection: {
        ...selection, product: { ...selection.product, productKey },
      } },
    }))],
  });
  renderPicker({ open: true });
  await screen.findByTestId("catalog-choice-milk-a");
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
    mode: "find_product",
    ingredients: ["plain milk"],
    shoppingIngredient: ingredient,
  });
  expect(screen.getByTestId("catalog-choice-milk-a")).toBeInTheDocument();
  expect(screen.getByTestId("catalog-choice-milk-b")).toBeInTheDocument();
  expect(screen.queryByTestId("catalog-choice-milk-c")).not.toBeInTheDocument();
  expect(screen.queryByTestId("catalog-choice-milk-d")).not.toBeInTheDocument();
  expect(screen.getByTestId("catalog-choice-milk-review")).toBeInTheDocument();
  expect(screen.getAllByRole("article").map(card => card.dataset.testid)).toEqual([
    "catalog-choice-milk-review", "catalog-choice-milk-a", "catalog-choice-milk-b",
  ]);
  expect(within(screen.getByTestId("catalog-choice-milk-review")).queryByRole("button", { name: /Choose/ })).not.toBeInTheDocument();
  expect(screen.getByText("Check the current label")).toBeInTheDocument();
});

test("explicit qualifiers are preserved and review-only candidates explain why they remain generic", async () => {
  const qualified: ShoppingIngredientRequest = {
    originalName: "low-sodium soy sauce",
    requirements: [{ value: "low sodium", origin: "explicit_ingredient" }],
  };
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [{
      ...review,
      shoppingSelection: { eligible: false, reason: "No reviewed validator supports this qualifier." },
      shoppingCaution: "The requested low sodium requirement hasn't been verified. Check the current label.",
    }],
    shoppingTip: "Compare sodium across lower-sodium varieties using the same serving size.",
  });
  renderPicker({ open: true, ingredient: qualified });
  expect(await screen.findByText("The requested low sodium requirement hasn't been verified. Check the current label.")).toBeInTheDocument();
  expect(screen.queryByText("No reviewed validator supports this qualifier.")).not.toBeInTheDocument();
  expect(screen.getByText("Compare sodium across lower-sodium varieties using the same serving size.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Keep generic" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose this option" })).not.toBeInTheDocument();
  expect(post).toHaveBeenCalledWith("/api/grocery-coach/product-advisor", {
    mode: "find_product",
    ingredients: ["low-sodium soy sauce"],
    shoppingIngredient: qualified,
  });
});

test("ingredients over the local 80-character lookup limit are never truncated or requested", async () => {
  const longName = `${"qualifier ".repeat(9)}soy sauce`;
  renderPicker({ open: true, ingredient: { originalName: longName, requirements: [] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was shortened");
  expect(post).not.toHaveBeenCalled();
});

test("Cancel dismisses without saving", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [supported] });
  const { onCommit, onOpenChange } = renderPicker({ open: true });
  await screen.findByTestId("catalog-choice-milk-a");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCommit).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("choosing an existing supported option saves that exact structured choice", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [supported] });
  const { onCommit } = renderPicker({ open: true });
  await screen.findByTestId("catalog-choice-milk-a");
  fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith(selection));
});

test("Clear choice saves null without Keep generic; save failures remain visible", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [] });
  const { onCommit, rerender } = renderPicker({ open: true, currentSelection: selection });
  await screen.findByText(/No suitable specific product could be identified/);
  expect(screen.queryByRole("button", { name: "Keep generic" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear choice" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith(null));

  (post as jest.Mock).mockResolvedValue({ catalogMatches: [] });
  const failingCommit = jest.fn().mockRejectedValue(new Error("save failed"));
  rerender(
    <ShoppingProductPicker
      open
      onOpenChange={jest.fn()}
      ingredient={ingredient}
      quantityLabel="2 cups"
      sessionKey="member-a:profile-a"
      currentSelection={selection}
      onCommit={failingCommit}
    />,
  );
  await screen.findByRole("button", { name: "Clear choice" });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Clear choice" })); });
  await screen.findAllByRole("alert");
  expect(failingCommit).toHaveBeenCalledWith(null);
});

test("Change starts a fresh explicit picker action and Clear waits for the save", async () => {
  const onChoose = jest.fn();
  const onClear = jest.fn().mockResolvedValue(undefined);
  render(<SmartShoppingProductChoice
    item={{ name: "plain milk", ingredientMetadata: { ingredient: { originalName: "plain milk" }, selectedProduct: selection.product } } as any}
    enabled
    hasAccess
    onChoose={onChoose}
    onUpgrade={jest.fn()}
    onClear={onClear}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(onChoose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
});

test("saved unverified reference is distinct, shows variant/package and every unresolved warning", () => {
  const reference = makeShoppingReference();
  const onChoose = jest.fn();
  const onClear = jest.fn().mockResolvedValue(undefined);
  render(<SmartShoppingProductChoice
    item={{ name: "olive oil", ingredientMetadata: {
      ingredient: { originalName: "olive oil" },
      selectedProduct: reference.product,
    } } as any}
    enabled
    hasAccess
    onChoose={onChoose}
    onUpgrade={jest.fn()}
    onClear={onClear}
  />);
  expect(screen.queryByText("Shopping reference — Unverified")).not.toBeInTheDocument();
  expect(screen.queryByText(/Unresolved:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Historical shopping choice/)).not.toBeInTheDocument();
  expect(reference.product.assessment.unresolvedRequirements).toContain("Current ingredient label not reviewed");
  expect(screen.queryByText("Saved with review required")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(onChoose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test("a profile change invalidates an open response without launching another lookup", async () => {
  let resolveRequest!: (value: any) => void;
  (post as jest.Mock).mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
  const { rerender } = renderPicker({ open: true });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  rerender(
    <ShoppingProductPicker
      open
      onOpenChange={jest.fn()}
      ingredient={ingredient}
      quantityLabel="2 cups"
      sessionKey="member-a:profile-b"
      currentSelection={null}
      onCommit={jest.fn()}
    />,
  );
  await act(async () => { resolveRequest({ catalogMatches: [supported] }); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("catalog-choice-milk-a")).not.toBeInTheDocument();
});

test("a successful empty result shows one supplied shopping tip without changing the current choice", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [], catalogSearchAvailable: true,
    shoppingTip: "Compare sodium and saturated fat using the same serving size.",
    catalogNotice: "Long generic medical disclaimer that must not be rendered.",
  });
  const { onCommit } = renderPicker({ open: true, currentSelection: selection });
  expect(await screen.findByText("No suitable specific product could be identified. You can keep this ingredient generic.")).toBeInTheDocument();
  expect(screen.getAllByText("Compare sodium and saturated fat using the same serving size.")).toHaveLength(1);
  expect(screen.queryByText(/Long generic medical disclaimer/)).not.toBeInTheDocument();
  expect(screen.getByText(/plain milk · Original amount: 2 cups/)).toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
});

test("a catalog outage is not a successful no-match and retains its resolved-profile tip", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [], catalogSearchAvailable: false, shoppingTip: "Compare sodium using the same serving size.",
  });
  const { onCommit } = renderPicker({ open: true });
  expect(await screen.findByRole("alert")).toHaveTextContent("catalog is temporarily unavailable");
  expect(screen.getByText("Compare sodium using the same serving size.")).toBeInTheDocument();
  expect(screen.queryByText(/No suitable specific product could be identified/)).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
});

test.each([
  [409, "couldn't confirm your current requirements"],
  [403, "isn't available for this account"],
  [503, "couldn’t load product options"],
])("lookup error %s preserves the list and does not invent profile-specific guidance", async (status, message) => {
  (post as jest.Mock).mockRejectedValue({ status });
  const { onCommit } = renderPicker({ open: true, currentSelection: selection });
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.queryByRole("button", { name: "Keep generic" })).not.toBeInTheDocument();
  expect(screen.queryByText(/No suitable specific product could be identified/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Compare sodium|Compare saturated fat/)).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
});

test("hidden products and malformed purported selections are never shown or made selectable", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [
      { ...supported, shoppingDisplay: "hidden" },
      { ...review, shoppingDisplay: undefined },
      { ...supported, productKey: "malformed", shoppingDisplay: "selectable",
        shoppingSelection: { eligible: true, selection: { ...selection, product: { ...selection.product, assessment: {} } } } },
    ],
  });
  const { onCommit } = renderPicker({ open: true });
  await screen.findByText(/No suitable specific product could be identified/);
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Choose this option" })).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
});

test("review-only display cannot acquire a button even when the underlying payload claims eligibility", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [{ ...supported, shoppingDisplay: "label_review" }],
  });
  const { onCommit } = renderPicker({ open: true });
  await screen.findByText("Check the current label");
  expect(screen.queryByRole("button", { name: "Choose this option" })).not.toBeInTheDocument();
  expect(screen.getByText(/verification is incomplete/)).toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
});

test("catalog fallback reuses Product Scan cards without exposing raw catalog facts or inventing benefits", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [{
      ...review,
      ingredients: "RAW INGREDIENT RECORD",
      serving: "1/4 second spray",
      nutrition: [{ source: "OFF", statement: "fat: 93.333333333333 g per 100g (OFF record)" }],
      allergenInformation: [{ source: "OFF", statement: "RAW ALLERGEN RECORD" }],
    }, supported],
  });
  const { onCommit } = renderPicker({ open: true });
  const fallbackCard = await screen.findByTestId("catalog-choice-milk-review");
  const scan = render(<BetterAlternativesSection
    alternatives={[{ category: "Scanner comparison product", whyBetter: [], targetCriteria: "" }]}
    branded query="plain milk" educationalFooter="" renderAction={() => null}
  />);
  expect(fallbackCard.className).toBe(scan.container.querySelector("article")!.className);
  expect(within(fallbackCard).getByText("Other Unverified Milk")).toBeInTheDocument();
  expect(within(fallbackCard).getByText(review.shoppingCaution)).toBeInTheDocument();
  expect(within(fallbackCard).queryByRole("button", { name: /Choose/ })).not.toBeInTheDocument();
  expect(within(fallbackCard).queryByText("✓")).not.toBeInTheDocument();
  expect(screen.queryByText(/RAW INGREDIENT|RAW ALLERGEN|OFF record|Catalog serving|second spray/)).not.toBeInTheDocument();
  expect(within(fallbackCard).queryByText(/profile.matched|Selectable/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose this option" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith(selection));
  expect(post).toHaveBeenCalledTimes(1);
});

test("catalog fallback preserves supplied recommendation reasons in Product Scan's green pills", async () => {
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [{
      ...supported,
      recommendationExplanation: {
        whyBetter: ["Existing supported recommendation reason"],
        targetCriteria: "Existing availability guidance",
      },
    }],
  });
  renderPicker({ open: true });
  const card = await screen.findByTestId("catalog-choice-milk-a");
  const reason = within(card).getByText("Existing supported recommendation reason");
  expect(reason.closest("span.inline-flex")).toHaveClass("text-emerald-300", "rounded-full");
  expect(within(card).getByText(/Existing availability guidance/)).toBeInTheDocument();
  expect(within(card).queryByText(/Ingredients:|Catalog serving:/)).not.toBeInTheDocument();
});

test("catalog references choose in one click and retain every stored warning without claiming verification", async () => {
  const reference = makeShoppingReference();
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [{
    ...review, ...reference.product, productKey: reference.product.productKey,
    shoppingDisplay: "label_review", shoppingReference: reference,
    shoppingSelection: { eligible: false, reason: "label review" },
  }] });
  const onCommitReference = jest.fn().mockResolvedValue(undefined);
  const { onCommit } = renderPicker({ open: true, ingredient: reference.ingredient, onCommitReference });
  fireEvent.click(await screen.findByRole("button", { name: "Choose Product" }));
  await waitFor(() => expect(onCommitReference).toHaveBeenCalledWith(reference));
  expect(screen.queryByRole("button", { name: "Confirm shopping reference" })).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save Product" })).toBeInTheDocument();
});

test.each(["wrong-ingredient", "wrong-name", "rejected"])(
  "catalog reference %s cannot acquire a Choose action",
  async invalid => {
    const reference = makeShoppingReference();
    const product: any = { ...review, ...reference.product, shoppingDisplay: "label_review", shoppingReference: reference };
    if (invalid === "wrong-ingredient") product.shoppingReference = { ...reference, ingredient };
    if (invalid === "wrong-name") product.name = "Different product";
    if (invalid === "rejected") {
      const snapshot = JSON.parse(reference.product.sourcePayloadJson!);
      snapshot.decision.status = "rejected";
      product.shoppingReference = { ...reference, product: { ...reference.product, sourcePayloadJson: JSON.stringify(snapshot) } };
    }
    (post as jest.Mock).mockResolvedValue({ catalogMatches: [product] });
    renderPicker({ open: true, ingredient: reference.ingredient, onCommitReference: jest.fn() });
    await screen.findByRole("button", { name: "Save Product" });
    expect(screen.queryByRole("button", { name: "Choose Product" })).not.toBeInTheDocument();
  },
);

test("Production retains existing Shopping actions without the Development-only additions", async () => {
  (actionsGate as any).shoppingProductActionsDevelopmentEnabled = false;
  (post as jest.Mock).mockResolvedValue(sharedResponse());
  renderPicker({ open: true, ingredient: { originalName: "olive oil", requirements: [] } });
  expect(await screen.findAllByRole("button", { name: "Choose for My List" })).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Save Product" })).not.toBeInTheDocument();
});
