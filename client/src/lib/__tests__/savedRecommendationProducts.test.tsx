/** @jest-environment jsdom */
jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"), createPortal: (node: any) => node,
}));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, ...props }: any) => {
    const React = require("react");
    const { initial, animate, exit, transition, ...rest } = props;
    return React.createElement("div", rest, children);
  } },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/queryClient", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  const apiRequest = jest.fn();
  return {
    apiRequest,
    queryClient: new QueryClient({ defaultOptions: {
      queries: { retry: false, gcTime: Infinity, queryFn: () => apiRequest("/api/saved-groceries") },
    } }),
  };
});
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn(), apiJSON: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({
  t: (key: string, values?: any) => {
    const labels: Record<string, string> = {
      "ingredientSheet.saveToGroceries": "Save to Groceries",
      "ingredientSheet.savedToGroceries": "Saved to Groceries",
      "ingredientSheet.add": "Add",
      "ingredientSheet.addNamedToList": `Add ${values?.name} to List`,
    };
    return labels[key] ?? key;
  },
}) }));

import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { get, post } from "@/lib/api";
import { BetterAlternativesSection } from "@/components/biometrics/IngredientIntelligenceSheet";
import SavedGroceriesSheet, { buildResultFromSavedItem } from "@/components/shopping/SavedGroceriesSheet";
import {
  groceryProductLabel, recommendationIdentity, recommendationProductKey,
  recommendationSavePayload,
} from "@/lib/savedGroceryRecommendation";
import { computeProductKey } from "../../../../server/utils/productKey";

const alternatives = [
  { category: "Tropicana Pure Premium Orange Juice", whyBetter: ["Fixture reason one"], targetCriteria: "Read its current label" },
  { category: "Simply Orange Pulp Free", whyBetter: ["Fixture reason two"], targetCriteria: "Check serving size and ingredients" },
  { category: "Lakewood Organic Pure Orange Juice", whyBetter: ["Fixture reason three"], targetCriteria: "Check the current package" },
];
const warning = "Knowledge-based suggestion. Check the current label; formulas can change.";
let owner: string | null;
let rows: Record<string, any[]>;
let writes: any[];
let added: string[];
const list: any[] = [];
const hydrate = jest.fn(async () => {});
const add = jest.fn();
function wrap(node: React.ReactNode) {
  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
}
function recommendations() {
  return wrap(<BetterAlternativesSection alternatives={alternatives} query="Juice"
    educationalFooter={warning} onAddToList={add} />);
}
function saveButton(index = 1) {
  return screen.getByRole("button", { name: `Save to Groceries: ${alternatives[index].category}` });
}

beforeEach(() => {
  queryClient.clear(); owner = "fixture-a"; rows = { "fixture-a": [], "fixture-b": [] }; writes = []; added = [];
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockImplementation(() => ({ user: owner ? { id: owner } : null }));
  (useShoppingListStore as unknown as jest.Mock).mockImplementation(selector => selector({ hydrate, items: list }));
  (apiRequest as jest.Mock).mockImplementation(async (_url, options) => {
    if (!owner) throw new Error("Not authenticated");
    if (!options?.method || options.method === "GET") return { items: rows[owner] };
    const payload = JSON.parse(options.body);
    writes.push(payload);
    const row = { ...payload, id: `saved-${owner}-${rows[owner].length}`, userId: owner,
      productKey: computeProductKey(null, payload.brand, payload.productName),
      compliance: { status: "approved" } };
    rows[owner].push(row);
    return { item: row, created: true };
  });
  (get as jest.Mock).mockImplementation(async () => ({ items: rows[owner!] }));
  (post as jest.Mock).mockImplementation(async (url: string) => {
    const item = rows[owner!].find(row => url === `/api/saved-groceries/${row.id}/add-to-list`);
    if (!item) throw new Error("Not found for this account");
    added.push(groceryProductLabel(item));
    return { name: groceryProductLabel(item), status: "added" };
  });
});
afterEach(() => { cleanup(); queryClient.clear(); });

test("Juice: saving the second card stores only the second exact product and its own explanation", async () => {
  render(recommendations());
  await waitFor(() => expect(apiRequest).toHaveBeenCalled());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    productName: alternatives[1].category, source: "grocery-coach", category: "Juice",
    productMeta: { recommendationWhyBetter: alternatives[1].whyBetter,
      recommendationTargetCriteria: alternatives[1].targetCriteria, educationalFooter: warning,
      evidenceStatus: "unverified" },
  });
  expect(writes[0].brand).toBeUndefined();
  expect(writes[0].barcode).toBeUndefined();
  expect(writes[0].nutritionJson).toBeUndefined();
  expect(writes[0].productMeta.ingredients).toBeUndefined();
  expect(saveButton(0)).toHaveAttribute("aria-pressed", "false");
  expect(saveButton(2)).toHaveAttribute("aria-pressed", "false");
});

test("each existing Add action passes that card's complete product identity", () => {
  render(recommendations());
  fireEvent.click(screen.getAllByRole("button", { name: "Add" })[1]);
  expect(add).toHaveBeenCalledWith(alternatives[1].category);
});

test("reopening after logout/login fetches the persisted second product, not a local saved flag", async () => {
  const view = render(recommendations());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
  view.unmount(); queryClient.clear();
  owner = null;
  const signedOut = render(recommendations());
  expect(saveButton()).toBeDisabled();
  signedOut.unmount(); queryClient.clear();
  owner = "fixture-a";
  render(recommendations());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
  expect(writes).toHaveLength(1);
});

test("a different account never inherits another account's saved badge", async () => {
  const view = render(recommendations());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
  owner = "fixture-b"; view.rerender(recommendations());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "false"));
  expect(saveButton()).toBeEnabled();
  expect(rows["fixture-b"]).toEqual([]);
});

test("a late save response from the previous account cannot populate the current account cache", async () => {
  let finish!: (value: any) => void;
  (apiRequest as jest.Mock).mockImplementation(async (_url, options) => options?.method === "POST"
    ? new Promise(resolve => { finish = resolve; }) : { items: [] });
  const view = render(recommendations());
  fireEvent.click(saveButton());
  owner = "fixture-b"; view.rerender(recommendations());
  await act(async () => finish({ item: { id: "old", productKey: recommendationProductKey(recommendationIdentity(alternatives[1])) } }));
  expect(saveButton()).toHaveAttribute("aria-pressed", "false");
  expect(queryClient.getQueryData(["/api/saved-groceries", "fixture-b"])).toEqual({ items: [] });
});

test("failed saves remain retryable and do not show a saved badge", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (_url, options) => {
    if (options?.method === "POST") throw new Error("Fixture write failed");
    return { items: [] };
  });
  render(recommendations());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toBeEnabled());
  expect(saveButton()).toHaveAttribute("aria-pressed", "false");
});

test("rapid repeated saves create only one write for that card", async () => {
  render(recommendations());
  fireEvent.click(saveButton());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toHaveAttribute("aria-pressed", "true"));
  expect(writes).toHaveLength(1);
});

test("a response for a different product cannot mark the clicked recommendation saved", async () => {
  (apiRequest as jest.Mock).mockImplementation(async (_url, options) => options?.method === "POST"
    ? { item: { id: "wrong", productKey: "name::::juice" } } : { items: [] });
  render(recommendations());
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton()).toBeEnabled());
  expect(saveButton()).toHaveAttribute("aria-pressed", "false");
});

test("legacy saved rows still reopen with their stored brand and without new recommendation metadata", () => {
  const result = buildResultFromSavedItem({
    id: "legacy", productName: "Peanut Butter", brand: "Kraft", barcode: null,
    productKey: "name::kraft::peanutbutter", category: "Pantry", source: "manual",
    productMeta: null, nutritionJson: null, savedAt: "", compliance: { status: "approved", reason: null },
  });
  expect(result.productName).toBe("Kraft Peanut Butter");
  expect(result.gradeUnavailable).toBeUndefined();
});

test("separate supplied brand and product fields are retained without guessing or doubling the label", () => {
  const alternative = { ...alternatives[1], brand: "Simply", productName: "Orange Pulp Free" };
  const payload = recommendationSavePayload(alternative, { query: "Juice", educationalFooter: warning });
  expect(payload).toMatchObject({ brand: "Simply", productName: "Orange Pulp Free" });
  expect(groceryProductLabel(payload)).toBe("Simply Orange Pulp Free");
  expect(recommendationProductKey(payload)).toBe(computeProductKey(null, "Simply", "Orange Pulp Free"));
  expect(groceryProductLabel({ brand: "Simply", productName: "Simply Orange Pulp Free" })).toBe("Simply Orange Pulp Free");
});

test("saved-library reopening retains the product, reasons and warnings, and re-adding uses its saved ID", async () => {
  const view = render(recommendations());
  fireEvent.click(saveButton());
  await waitFor(() => expect(rows["fixture-a"]).toHaveLength(1));
  view.unmount();
  const row = rows["fixture-a"][0];
  const result = buildResultFromSavedItem(row);
  expect(result.productName).toBe(alternatives[1].category);
  expect(result.ingredientConsiderations).toContain(alternatives[1].whyBetter[0]);
  expect(result.educationalFooter).toBe(warning);
  expect(result.gradeUnavailable).toBe(true);
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  const openProduct = await screen.findByText(alternatives[1].category);
  fireEvent.click(openProduct);
  fireEvent.click(screen.getByRole("button", { name: `Add ${alternatives[1].category} to List` }));
  await waitFor(() => expect(added).toEqual([alternatives[1].category]));
  expect(post).toHaveBeenCalledWith(`/api/saved-groceries/${row.id}/add-to-list`);
  expect(added).not.toContain("Juice");
});
