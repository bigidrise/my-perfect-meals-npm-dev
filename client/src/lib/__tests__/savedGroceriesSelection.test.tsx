/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import SavedGroceriesSheet, { type SavedGroceryItem } from "@/components/shopping/SavedGroceriesSheet";
import { get, post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useShoppingListStore } from "@/stores/shoppingListStore";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn(), apiJSON: jest.fn() }));
jest.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: jest.fn() }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/components/biometrics/IngredientIntelligenceSheet", () => ({
  IngredientIntelligenceSheet: ({ result, savedContext, onClose }: any) => (
    <section role="dialog" aria-label="Saved analysis">
      <h2>{result.productName}</h2>{savedContext}
      <button onClick={onClose}>Close analysis</button>
    </section>
  ),
}));
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> },
}));

const mockToast = jest.fn();
const hydrate = jest.fn(async () => {});
const shoppingItems: any[] = [];
let owner = "synthetic-owner-a";
let rows: SavedGroceryItem[] = [];
function fixture(id: string, overrides: Partial<SavedGroceryItem> = {}): SavedGroceryItem {
  return {
    id, productName: `Product ${id}`, brand: "Fixture Brand", barcode: null,
    productKey: `synthetic::${id}`, category: `Original category ${id}`, source: "grocery-coach",
    nutritionJson: null, productMeta: null, savedAt: "2026-10-25T12:00:00Z",
    compliance: { status: "approved", reason: null }, ...overrides,
  };
}
function restricted(category: NonNullable<SavedGroceryItem["compliance"]["category"]>, reason: string) {
  return fixture(category, { compliance: { status: "blocked", category, reason } });
}
const select = (id: string) => screen.getByRole("checkbox", { name: `Select Fixture Brand Product ${id}` });
const props = () => ({ open: true, onOpenChange: jest.fn(), onVerifyProduct: jest.fn() });
async function loaded() { await screen.findByRole("textbox", { name: "Search saved groceries" }); }

beforeEach(() => {
  jest.clearAllMocks();
  owner = "synthetic-owner-a";
  rows = [];
  (useAuth as jest.Mock).mockImplementation(() => ({ user: { id: owner } }));
  (useShoppingListStore as unknown as jest.Mock).mockImplementation(selector => selector({ hydrate, items: shoppingItems }));
  (get as jest.Mock).mockImplementation(async () => ({ items: rows }));
  (post as jest.Mock).mockImplementation(async (_url, body) => ({
    items: body.ids.map((id: string) => ({ id, status: "added" })), addedCount: body.ids.length,
  }));
});
afterEach(cleanup);

test("one eligible selection enables the primary action and adds only its exact saved ID", async () => {
  rows = [fixture("a"), fixture("b")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.getByRole("button", { name: "Add Selected" })).toBeDisabled();
  fireEvent.click(select("a"));
  expect(select("a")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Add Selected (1)" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["a"] }));
  await waitFor(() => expect(screen.getByText("2 shown · 0 selected")).toBeInTheDocument());
  expect(hydrate).toHaveBeenCalled();
});

test("multiple choices survive brand search and clearing search; only selected products are added", async () => {
  rows = [fixture("a"), fixture("b", { brand: "Other Brand" }), fixture("c")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  fireEvent.click(select("a"));
  const search = screen.getByRole("textbox");
  fireEvent.change(search, { target: { value: "other brand" } });
  expect(screen.getByText("1 shown · 1 selected")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Other Brand Product b" }));
  fireEvent.change(search, { target: { value: "" } });
  expect(select("a")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Add Selected (2)" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["a", "b"] }));
});

test("an explicit deselection does not add the unchecked product", async () => {
  rows = [fixture("a"), fixture("b")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  fireEvent.click(select("a")); fireEvent.click(select("b")); fireEvent.click(select("a"));
  fireEvent.click(screen.getByRole("button", { name: "Add Selected (1)" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["b"] }));
});

test("restricted and legacy records stay visible with analysis, reasons, and no misleading checkbox", async () => {
  rows = [
    restricted("evidence_missing", "Complete ingredient evidence unavailable"),
    restricted("incompatible", "Contains milk, which conflicts with your allergy"),
    restricted("profile_unavailable", "Current profile could not be resolved"),
    fixture("legacy", { productMeta: null, brand: null, compliance: { status: "blocked", reason: null } }),
  ];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^View Analysis:/ })).toHaveLength(4);
  expect(screen.getByText("Label or nutrition evidence needed")).toBeInTheDocument();
  expect(screen.getByText("Current profile check unavailable")).toBeInTheDocument();
  expect(screen.getAllByText("Restricted by current profile")).toHaveLength(2);
  expect(screen.getByText(/Contains milk/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View Analysis: Product legacy" }));
  expect(screen.getByRole("dialog", { name: "Saved analysis" })).toHaveTextContent("original analysis may be unavailable");
  expect(rows).toHaveLength(4);
  expect(post).not.toHaveBeenCalled();
});

test("Verify Label hands the exact saved product to the existing verification workflow", async () => {
  rows = [restricted("evidence_missing", "Complete ingredient evidence unavailable")];
  const p = props();
  render(<SavedGroceriesSheet {...p} />);
  await loaded();
  fireEvent.click(screen.getByRole("button", { name: /^Verify Label:/ }));
  expect(p.onOpenChange).toHaveBeenCalledWith(false);
  expect(p.onVerifyProduct).toHaveBeenCalledWith(rows[0]);
  expect(post).not.toHaveBeenCalled();
});

test("Retry Check fetches current eligibility and enables selection only after approval", async () => {
  rows = [restricted("profile_unavailable", "Current profile could not be resolved")];
  const p = props();
  render(<SavedGroceriesSheet {...p} />);
  await loaded();
  expect(screen.queryByRole("button", { name: /^Verify Label:/ })).not.toBeInTheDocument();
  rows = [fixture("profile_unavailable")];
  fireEvent.click(screen.getByRole("button", { name: /^Retry Check:/ }));
  await screen.findByRole("checkbox", { name: "Select Fixture Brand Product profile_unavailable" });
  expect(get).toHaveBeenCalledTimes(2);
  expect(post).not.toHaveBeenCalled();
});

test("known conflicts and certification limitations do not offer a misleading photo fix", async () => {
  rows = [restricted("incompatible", "Contains milk"), restricted("evidence_missing", "Verified certification unavailable")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.queryByRole("button", { name: /^Verify Label:|^Retry Check:/ })).not.toBeInTheDocument();
  expect(screen.getByText(/A label photo alone cannot verify/)).toBeInTheDocument();
});

test.each([10, 30, 100])("%i saved categories produce a flat searchable list without category or Add All controls", async count => {
  rows = Array.from({ length: count }, (_, i) => fixture(String(i)));
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.getAllByRole("checkbox")).toHaveLength(count);
  expect(screen.queryByRole("button", { name: /Add all shown|^All$|Original category/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/Original category/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "no matching fixture" } });
  expect(screen.getByText("No saved groceries match your search.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  expect(screen.getAllByRole("checkbox")).toHaveLength(count);
});

test("account switching clears old selections and ignores a late bulk result", async () => {
  rows = [fixture("a")];
  let resolve!: (value: any) => void;
  (post as jest.Mock).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const p = props();
  const view = render(<SavedGroceriesSheet {...p} />);
  await loaded(); fireEvent.click(select("a"));
  fireEvent.click(screen.getByRole("button", { name: "Add Selected (1)" }));
  owner = "synthetic-owner-b"; rows = [fixture("b")];
  view.rerender(<SavedGroceriesSheet {...p} />);
  await screen.findByRole("checkbox", { name: "Select Fixture Brand Product b" });
  expect(screen.queryByRole("checkbox", { name: "Select Fixture Brand Product a" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Selected" })).toBeDisabled();
  resolve({ items: [{ id: "a", status: "added" }], addedCount: 1 });
  await waitFor(() => expect(select("b")).toBeEnabled());
  expect(mockToast).not.toHaveBeenCalled();
});

test("a newly blocked server decision never removes the saved record or marks it added", async () => {
  rows = [fixture("a")];
  (post as jest.Mock).mockImplementationOnce(async () => {
    rows = [fixture("a", { compliance: { status: "blocked", category: "incompatible", reason: "Current profile changed" } })];
    return {
      items: [{ id: "a", status: "blocked", reason: "Current profile changed" }], blockedCount: 1,
    };
  });
  render(<SavedGroceriesSheet {...props()} />);
  await loaded(); fireEvent.click(select("a"));
  fireEvent.click(screen.getByRole("button", { name: "Add Selected (1)" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
  expect(screen.getByText("Product a")).toBeInTheDocument();
  expect(screen.getByText("Current profile changed")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(rows).toHaveLength(1);
});

test("mobile rows retain wrapping actions, a 44px selection target, and the existing vertical scroller", async () => {
  rows = [
    fixture("oats", { productName: "Old-fashioned rolled oats" }),
    restricted("evidence_missing", "Complete ingredient evidence is needed to check your current profile."),
    restricted("profile_unavailable", "Your current profile check is temporarily unavailable."),
    restricted("incompatible", "Contains milk, which conflicts with your dairy allergy."),
    fixture("long-name", { productName: "A very long saved product name with several descriptive words", brand: "Longer Fixture Brand" }),
  ];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  const checkbox = screen.getByRole("checkbox", { name: "Select Fixture Brand Old-fashioned rolled oats" });
  expect(checkbox.parentElement).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
  expect(document.querySelector('[style*="max-height: 88vh"]')).toHaveStyle({ overflowY: "auto" });
  // A static capture of the actual rendered component, not a hand-built mockup.
  // Served only from /tmp for narrow-screen visual inspection; no live APIs.
  fs.writeFileSync(path.join(os.tmpdir(), "saved-groceries-selection-mobile.html"), [
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="stylesheet" href="/styles.css">',
    '<style>body{margin:0;background:#0f172a;color:white;font-family:Arial,sans-serif}*{box-sizing:border-box}</style>',
    `</head><body>${document.body.innerHTML}</body></html>`,
  ].join(""));
});
