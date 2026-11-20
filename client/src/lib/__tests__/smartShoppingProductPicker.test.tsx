/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { post } from "@/lib/api";
import ShoppingProductPicker from "@/components/shopping/ShoppingProductPicker";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import type { ShoppingIngredientRequest, ShoppingProductSelection } from "@shared/shoppingProductSelection";

jest.mock("@/lib/api", () => ({ post: jest.fn() }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key === "common.cancel" ? "Cancel" : key }),
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

beforeEach(() => {
  jest.clearAllMocks();
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
  expect(screen.getByRole("dialog", { name: "Here are your product options." })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.queryAllByRole("article")).toHaveLength(count);
  expect(screen.queryAllByRole("button", { name: "Choose this option" })).toHaveLength(count);
  expect(post).toHaveBeenCalledTimes(1);
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
  expect(within(screen.getByTestId("catalog-choice-milk-review")).queryByRole("button")).not.toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: "Keep generic" })).toBeInTheDocument();
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

test("Keep generic and Clear save null; save failures remain visible", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [] });
  const { onCommit, rerender } = renderPicker({ open: true, currentSelection: selection });
  await screen.findByText(/No suitable specific product could be identified/);
  fireEvent.click(screen.getByRole("button", { name: "Keep generic" }));
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
  expect(screen.getByText(/plain milk · Recipe amount: 2 cups/)).toBeInTheDocument();
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
  [503, "couldn’t check product choices"],
])("lookup error %s preserves the list and does not invent profile-specific guidance", async (status, message) => {
  (post as jest.Mock).mockRejectedValue({ status });
  const { onCommit } = renderPicker({ open: true, currentSelection: selection });
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("button", { name: "Keep generic" })).toBeInTheDocument();
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
  expect(screen.getByText(/No suitable specific product could be identified/)).toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
});
