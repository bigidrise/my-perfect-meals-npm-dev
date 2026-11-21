/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render as renderComponent, screen, cleanup } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import GroceryExportModal from "@/components/shopping/GroceryExportModal";
import { GROCERY_RETAILERS } from "@/lib/groceryRetailers";
import * as actionsGate from "@/lib/shoppingProductActionsGate";
import type { ShoppingListItem } from "@/stores/shoppingListStore";

jest.mock("@/components/shopping/GroceryExportModal.css", () => ({}));
jest.unmock("react-i18next");

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: "en", fallbackLng: "en", interpolation: { escapeValue: false },
    resources: { en: { shoppingTransfer: require("../../i18n/locales/en.json").shoppingTransfer } },
  });
});
const render = (element: React.ReactElement) =>
  renderComponent(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);

const items: ShoppingListItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: `synthetic-${i}`,
  normalizedName: `synthetic ingredient ${i}`,
  name: i === 0 ? `Synthetic selected brand ${"long product name ".repeat(12)}`.trim() : `Synthetic ingredient ${i}`,
  quantity: i + 1,
  unit: "g",
  category: "Other",
  isPantryStaple: false,
  isChecked: false,
}));

afterEach(cleanup);

test.each(["eligible_at_evaluation", "review_required"])(
  "explicit %s product identity reaches every retailer without changing recipe amounts",
  status => {
    const chosen: any = {
      ...items[0], id: "chosen-oil", name: "olive oil", quantity: 2, unit: "tbsp",
      ingredientMetadata: { version: 1, ingredient: { originalName: "olive oil", requirements: [] }, sources: [],
        selectedProduct: {
          productKey: "offline-oil", name: "Extra Virgin Olive Oil", brand: "Kirkland Signature",
          variant: "Organic Cold Pressed", selectionKind: status === "review_required" ? "unverified_shopping_reference" : undefined,
          assessment: { status, unresolvedRequirements: status === "review_required" ? ["Label review remains required"] : [] },
        } },
    };
    const before = JSON.stringify(chosen);
    render(<GroceryExportModal items={[chosen, { ...items[1], name: "fresh chopped onion" }]} onClose={jest.fn()} />);
    for (const retailer of GROCERY_RETAILERS) {
      fireEvent.click(screen.getByRole("button", { name: retailer.name }));
      const link = screen.getByRole("link", { name: /Kirkland Signature Extra Virgin Olive Oil/ });
      expect(link).not.toHaveTextContent("Organic Cold Pressed");
      expect(link).toHaveTextContent("Needed: 2 tbsp");
      expect(link).toHaveAttribute("href", retailer.buildItemUrl("Kirkland Signature Extra Virgin Olive Oil Organic Cold Pressed", { preserveProductIdentity: true }));
      const decodedQuery = [...new URL(link.getAttribute("href")!).searchParams.values()].join(" ");
      expect(decodedQuery).toContain("Kirkland Signature Extra Virgin Olive Oil Organic Cold Pressed");
      expect(screen.getByRole("link", { name: /fresh chopped onion/ })).toHaveAttribute("href", retailer.buildItemUrl("fresh chopped onion"));
    }
    expect(screen.queryByText("Label review remains required")).not.toBeInTheDocument();
    expect(screen.queryByText("Shopping reference — Unverified")).not.toBeInTheDocument();
    expect(screen.queryByText(/searching:/)).not.toBeInTheDocument();
    expect(JSON.stringify(chosen)).toBe(before);
  },
);

test("generic cleanup still strips preparation and store-brand prefixes exactly as before", () => {
  expect(GROCERY_RETAILERS[0].buildItemUrl("Kirkland Signature fresh chopped onion"))
    .toBe("https://www.walmart.com/search?q=onion");
});

test("Production preserves the original retailer query behavior", () => {
  (actionsGate as any).shoppingProductActionsDevelopmentEnabled = false;
  try {
    const chosen: any = { ...items[0], name: "fresh chopped onion", ingredientMetadata: {
      selectedProduct: { name: "Do not activate", brand: "Synthetic" },
    } };
    render(<GroceryExportModal items={[chosen]} onClose={jest.fn()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", GROCERY_RETAILERS[0].buildItemUrl(chosen.name));
    expect(screen.queryByText("Synthetic Do not activate")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Needed:/)).not.toBeInTheDocument();
  } finally { (actionsGate as any).shoppingProductActionsDevelopmentEnabled = true; }
});

test("all grocery rows remain present with unchanged names, quantities and retailer links", () => {
  const before = JSON.stringify(items);
  render(<GroceryExportModal items={items} onClose={jest.fn()} />);
  expect(screen.getAllByRole("link")).toHaveLength(items.length);
  for (const retailer of GROCERY_RETAILERS) {
    fireEvent.click(screen.getByRole("button", { name: retailer.name }));
    screen.getAllByRole("link").forEach((row, i) => {
      expect(row).toHaveAttribute("href", retailer.buildItemUrl(items[i].name));
      expect(row).toHaveAttribute("target", "_blank");
      expect(row).toHaveTextContent(items[i].name);
    });
  }
  expect(JSON.stringify(items)).toBe(before);
});

test("opening an item records a search without removing rows; close still works", () => {
  const onClose = jest.fn();
  render(<GroceryExportModal items={items} onClose={onClose} />);
  const row = screen.getAllByRole("link")[0];
  // Verify the local click behavior without navigating to a retailer.
  row.addEventListener("click", event => event.preventDefault());
  fireEvent.click(row);
  expect(screen.getByText("· 1 searched")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(items.length);
  fireEvent.click(screen.getByRole("button", { name: "Close Shop Online" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("empty and checked-only lists retain the existing empty state", () => {
  const { rerender } = render(<GroceryExportModal items={[]} onClose={jest.fn()} />);
  expect(screen.getByText("No items to export. Add items to your list first.")).toBeInTheDocument();
  rerender(<GroceryExportModal items={items.map(item => ({ ...item, isChecked: true }))} onClose={jest.fn()} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

test("mobile overrides stay modal-scoped and explicitly preserve both scroll directions", () => {
  const css = readFileSync(path.resolve("client/src/components/shopping/GroceryExportModal.css"), "utf8");
  const ast = postcss.parse(css);
  ast.walkRules(rule => {
    expect(rule.parent?.type).toBe("atrule");
    expect((rule.parent as any).params).toBe("(max-width: 768px)");
    rule.selectors.forEach(selector => expect(selector.startsWith("[data-shop-online-modal]")).toBe(true));
  });
  const declarations = (selector: string) => {
    const result: Record<string, string> = {};
    ast.walkRules(rule => {
      if (rule.selectors.includes(selector)) rule.walkDecls(decl => { result[decl.prop] = decl.value; });
    });
    return result;
  };
  expect(declarations('[data-shop-online-modal] .flex:not([role="dialog"])')["flex-wrap"]).toBe("nowrap");
  expect(declarations("[data-shop-online-modal] .shop-online-retailers.flex")["overflow-x"]).toBe("auto");
  expect(declarations("[data-shop-online-modal] .shop-online-items.flex")["overflow-y"]).toBe("auto");
  expect(declarations("[data-shop-online-modal] .shop-online-item")["flex-shrink"]).toBe("0");
  expect(declarations("[data-shop-online-modal] .shop-online-panel").height).toContain("100dvh");
});
