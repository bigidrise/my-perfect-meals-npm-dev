/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import SavedGroceriesSheet, { type SavedGroceryItem } from "@/components/shopping/SavedGroceriesSheet";
import { get, post, apiJSON } from "@/lib/api";
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
let owner: string | null = "synthetic-owner-a";
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
const addSelected = (count = 0) => screen.getByRole("button", {
  name: `Add Selected to Shopping List${count ? ` (${count})` : ""}`,
});
const props = () => ({ open: true, onOpenChange: jest.fn(), onVerifyProduct: jest.fn() });
async function loaded() { await screen.findByRole("textbox", { name: "Search saved groceries" }); }

beforeEach(() => {
  jest.clearAllMocks();
  owner = "synthetic-owner-a";
  rows = [];
  (useAuth as jest.Mock).mockImplementation(() => ({ user: owner ? { id: owner } : null }));
  (useShoppingListStore as unknown as jest.Mock).mockImplementation(selector => selector({ hydrate, items: shoppingItems }));
  (get as jest.Mock).mockImplementation(async () => ({ items: rows }));
  (post as jest.Mock).mockImplementation(async (_url, body) => ({
    items: body.ids.map((id: string) => ({ id, status: "added" })), addedCount: body.ids.length,
  }));
  (apiJSON as jest.Mock).mockImplementation(async (url, options) => {
    if (options?.method !== "DELETE") throw new Error("Unexpected fixture mutation");
    rows = rows.filter(row => url !== `/api/saved-groceries/${row.id}`);
    return { success: true };
  });
});
afterEach(cleanup);

test("one eligible selection enables the primary action and adds only its exact saved ID", async () => {
  rows = [fixture("a"), fixture("b")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(addSelected()).toBeDisabled();
  fireEvent.click(select("a"));
  expect(select("a")).toBeChecked();
  fireEvent.click(addSelected(1));
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
  fireEvent.click(addSelected(2));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["a", "b"] }));
});

test("an explicit deselection does not add the unchecked product", async () => {
  rows = [fixture("a"), fixture("b")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  fireEvent.click(select("a")); fireEvent.click(select("b")); fireEvent.click(select("a"));
  fireEvent.click(addSelected(1));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["b"] }));
});

test("all saved products are selectable shopping intentions without analysis or verification clutter", async () => {
  rows = [
    restricted("evidence_missing", "Complete ingredient evidence unavailable"),
    restricted("incompatible", "Contains milk, which conflicts with your allergy"),
    restricted("profile_unavailable", "Current profile could not be resolved"),
    fixture("legacy", { productMeta: null, brand: null, compliance: { status: "blocked", reason: null } }),
  ];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  screen.getAllByRole("checkbox").forEach(box => {
    expect(box).toBeEnabled();
    fireEvent.click(box);
    expect(box).toBeChecked();
  });
  expect(screen.getAllByRole("button", { name: /^View Analysis:/ })).toHaveLength(4);
  expect(screen.queryByText(/evidence unavailable|Restricted by current profile|Needs Review|Cannot add yet|Contains milk/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Verify Label|Retry Check/ })).not.toBeInTheDocument();
  expect(document.querySelector(".lucide-triangle-alert")).not.toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "View Analysis: Product legacy" }));
  expect(screen.getByRole("dialog", { name: "Saved analysis" })).toHaveTextContent("original analysis may be unavailable");
  expect(rows).toHaveLength(4);
  expect(post).not.toHaveBeenCalled();
});

test("selecting a saved recommendation does not start another verification or analysis request", async () => {
  rows = [restricted("evidence_missing", "Complete ingredient evidence unavailable")];
  const p = props();
  render(<SavedGroceriesSheet {...p} />);
  await loaded();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(get).toHaveBeenCalledTimes(1);
  expect(p.onVerifyProduct).not.toHaveBeenCalled();
  expect(apiJSON).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("missing profile checks do not prevent shopping-intent selection or trigger retry requests", async () => {
  rows = [restricted("profile_unavailable", "Current profile could not be resolved")];
  const p = props();
  render(<SavedGroceriesSheet {...p} />);
  await loaded();
  expect(screen.queryByRole("button", { name: /^Verify Label:/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.queryByRole("button", { name: /^Retry Check:/ })).not.toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
});

test("known conflicts and certification limitations do not offer a misleading photo fix", async () => {
  rows = [restricted("incompatible", "Contains milk"), restricted("evidence_missing", "Verified certification unavailable")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.queryByRole("button", { name: /^Verify Label:|^Retry Check:/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/A label photo alone cannot verify/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
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
  fireEvent.click(addSelected(1));
  owner = "synthetic-owner-b"; rows = [fixture("b")];
  view.rerender(<SavedGroceriesSheet {...p} />);
  await screen.findByRole("checkbox", { name: "Select Fixture Brand Product b" });
  expect(screen.queryByRole("checkbox", { name: "Select Fixture Brand Product a" })).not.toBeInTheDocument();
  expect(addSelected()).toBeDisabled();
  resolve({ items: [{ id: "a", status: "added" }], addedCount: 1 });
  await waitFor(() => expect(select("b")).toBeEnabled());
  expect(mockToast).not.toHaveBeenCalled();
});

test("server rejection is reported honestly without removing the saved product or adding list clutter", async () => {
  rows = [fixture("a")];
  (post as jest.Mock).mockImplementationOnce(async () => {
    rows = [fixture("a", { compliance: { status: "blocked", category: "incompatible", reason: "Current profile changed" } })];
    return {
      items: [{ id: "a", status: "blocked", reason: "Current profile changed" }], blockedCount: 1,
    };
  });
  render(<SavedGroceriesSheet {...props()} />);
  await loaded(); fireEvent.click(select("a"));
  fireEvent.click(addSelected(1));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
  expect(screen.getByText("Product a")).toBeInTheDocument();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
    title: "Some products were not added",
    description: expect.stringContaining("Current profile changed"),
  }));
  expect(screen.queryByText("Current profile changed")).not.toBeInTheDocument();
  expect(select("a")).toBeEnabled();
  expect(get).toHaveBeenCalledTimes(1);
  expect(rows).toHaveLength(1);
});

test("all explicitly selected IDs reach the unchanged server gate, including previously blocked products", async () => {
  rows = [fixture("a"), restricted("incompatible", "Contains milk")];
  (post as jest.Mock).mockResolvedValueOnce({
    items: [{ id: "a", status: "added" }, { id: "incompatible", status: "blocked", reason: "Contains milk" }],
    addedCount: 1, blockedCount: 1,
  });
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  screen.getAllByRole("checkbox").forEach(box => fireEvent.click(box));
  fireEvent.click(addSelected(2));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["a", "incompatible"] }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
    description: expect.stringContaining("1 added · 1 not added"),
  })));
  expect(rows).toHaveLength(2);
});

test("stored brand and explicit package size remain visible and exact saved identity is submitted", async () => {
  rows = [
    fixture("small", { productName: "Rolled Oats", brand: "Exact Brand", barcode: "fixture-small", productMeta: { packageSize: "500 g" } }),
    fixture("large", { productName: "Rolled Oats", brand: "Exact Brand", barcode: "fixture-large", productMeta: { packageSize: "1 kg" } }),
  ];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded();
  expect(screen.getByText("500 g")).toBeInTheDocument();
  expect(screen.getByText("1 kg")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "1 kg" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Exact Brand Rolled Oats (1 kg)" }));
  fireEvent.click(addSelected(1));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/api/saved-groceries/add-to-list", { ids: ["large"] }));
  expect(rows[1]).toMatchObject({ barcode: "fixture-large", productKey: "synthetic::large", productMeta: { packageSize: "1 kg" } });
});

test("delete removes only the chosen saved product and clears its selection", async () => {
  rows = [fixture("a"), fixture("b")];
  render(<SavedGroceriesSheet {...props()} />);
  await loaded(); fireEvent.click(select("a"));
  fireEvent.click(screen.getByRole("button", { name: "Remove Fixture Brand Product a from saved groceries" }));
  await waitFor(() => expect(apiJSON).toHaveBeenCalledWith("/api/saved-groceries/a", { method: "DELETE" }));
  await waitFor(() => expect(screen.queryByText("Product a")).not.toBeInTheDocument());
  expect(select("b")).toBeInTheDocument();
  expect(addSelected()).toBeDisabled();
  expect(rows.map(row => row.id)).toEqual(["b"]);
});

test("logout/login restores only the same account's persisted mock library without carrying selection", async () => {
  const persisted: Record<string, SavedGroceryItem[]> = {
    "synthetic-owner-a": [fixture("a")], "synthetic-owner-b": [fixture("b")],
  };
  (get as jest.Mock).mockImplementation(async () => ({ items: owner ? persisted[owner] : [] }));
  const p = props();
  const view = render(<SavedGroceriesSheet {...p} />);
  await loaded(); fireEvent.click(select("a"));
  owner = null;
  view.rerender(<SavedGroceriesSheet {...p} />);
  await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
  owner = "synthetic-owner-b";
  view.rerender(<SavedGroceriesSheet {...p} />);
  await screen.findByRole("checkbox", { name: "Select Fixture Brand Product b" });
  expect(screen.queryByText("Product a")).not.toBeInTheDocument();
  owner = null; view.rerender(<SavedGroceriesSheet {...p} />);
  owner = "synthetic-owner-a"; view.rerender(<SavedGroceriesSheet {...p} />);
  await screen.findByRole("checkbox", { name: "Select Fixture Brand Product a" });
  expect(select("a")).not.toBeChecked();
  expect(screen.queryByText("Product b")).not.toBeInTheDocument();
  expect(persisted["synthetic-owner-a"]).toHaveLength(1);
  expect(post).not.toHaveBeenCalled();
  expect(apiJSON).not.toHaveBeenCalled();
});

test("mobile rows retain wrapping actions, a 44px selection target, and the existing vertical scroller", async () => {
  rows = [
    fixture("oats", { productName: "Old-fashioned rolled oats" }),
    { ...restricted("evidence_missing", "Complete ingredient evidence is needed to check your current profile."), productName: "Chickpea pasta", productMeta: { packageSize: "400 g" } },
    { ...restricted("profile_unavailable", "Your current profile check is temporarily unavailable."), productName: "Marinara sauce" },
    { ...restricted("incompatible", "Contains milk, which conflicts with your dairy allergy."), productName: "Plain yogurt" },
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
