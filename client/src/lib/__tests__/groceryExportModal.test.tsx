/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import GroceryExportModal from "@/components/shopping/GroceryExportModal";
import { GROCERY_RETAILERS } from "@/lib/groceryRetailers";
import type { ShoppingListItem } from "@/stores/shoppingListStore";

jest.mock("@/components/shopping/GroceryExportModal.css", () => ({}));

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
