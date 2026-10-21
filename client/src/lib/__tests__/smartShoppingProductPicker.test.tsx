/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { post } from "@/lib/api";
import ShoppingProductPicker from "@/components/shopping/ShoppingProductPicker";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import type { ShoppingIngredientRequest, ShoppingProductSelection } from "@shared/shoppingProductSelection";

jest.mock("@/lib/api", () => ({ post: jest.fn() }));
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

test("explicit open sends one bounded existing-catalog request and only shows supported choices", async () => {
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
  expect(screen.getByTestId("catalog-choice-milk-c")).toBeInTheDocument();
  expect(screen.queryByTestId("catalog-choice-milk-d")).not.toBeInTheDocument();
  expect(screen.queryByTestId("catalog-choice-milk-review")).not.toBeInTheDocument();
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
    }],
  });
  renderPicker({ open: true, ingredient: qualified });
  expect(await screen.findByText("No reviewed validator supports this qualifier.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Keep generic" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose for shopping" })).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("button", { name: "Choose for shopping" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith(selection));
});

test("Keep generic and Clear save null; save failures remain visible", async () => {
  (post as jest.Mock).mockResolvedValue({ catalogMatches: [] });
  const { onCommit, rerender } = renderPicker({ open: true, currentSelection: selection });
  await screen.findByText(/No evidence-supported catalog choices/);
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
  expect(post).toHaveBeenCalledTimes(1);
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
