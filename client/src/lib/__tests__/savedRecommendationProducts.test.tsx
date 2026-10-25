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
      "ingredientSheet.grade.c": "Some Considerations",
      "ingredientSheet.incomplete.title": "Analysis incomplete",
    };
    return labels[key] ?? values?.defaultValue ?? key;
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
import { BetterAlternativesSection, IngredientIntelligenceSheet } from "@/components/biometrics/IngredientIntelligenceSheet";
import RecommendedProductActions from "@/components/shopping/RecommendedProductActions";
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
  (get as jest.Mock).mockImplementation(async () => ({ items: rows[owner!], supportsSavedProductAnalysis: true }));
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
  expect(result.gradeUnavailable).toBe(true);
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
  const openProduct = await screen.findByRole("button", { name: `View Analysis: ${alternatives[1].category}` });
  fireEvent.click(openProduct);
  fireEvent.click(screen.getByRole("button", { name: `Add ${alternatives[1].category} to List` }));
  await waitFor(() => expect(added).toEqual([alternatives[1].category]));
  expect(post).toHaveBeenCalledWith(`/api/saved-groceries/${row.id}/add-to-list`);
  expect(added).not.toContain("Juice");
});

test.each(["scanner", "grocery-coach"] as const)("the shared %s bookmark retains the original analysis and correct source", async source => {
  const scan = { ...buildResultFromSavedItem({
    productName: "Simply Orange Pulp Free", productMeta: null, nutritionJson: null,
  } as any), alignmentGrade: "C" as const, gradeUnavailable: false, analysisMethod: "by_label" as const,
    overallSummary: "Original personalized explanation", educationalFooter: warning,
    extractedIngredients: ["orange juice"], barcode: undefined };
  render(wrap(<IngredientIntelligenceSheet open result={scan} saveSource={source} onClose={jest.fn()} />));
  fireEvent.click(screen.getByRole("button", { name: "Save to Groceries" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].source).toBe(source);
  expect(writes[0].productMeta.analysisSnapshot).toEqual(scan);
  expect(buildResultFromSavedItem(rows["fixture-a"][0]).overallSummary).toBe("Original personalized explanation");
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url.startsWith("/api/saved-groceries"))).toBe(true);
});

test("a newly saved full graded scan reopens with the original analysis content and grade presentation", async () => {
  const scan = {
    ...buildResultFromSavedItem({ productName: "Cheerios Toasted Whole Grain Oat Cereal", productMeta: null, nutritionJson: null } as any),
    alignmentGrade: "C" as const, gradeUnavailable: false, fallbackUsed: false, analysisMethod: "by_label" as const,
    verdict: "The original Chef explanation", overallSummary: "The original personalized summary",
    profileFactorsUsed: ["Original profile factor"], whatMattersMost: ["Original priority"],
    ingredientConsiderations: ["Original consideration"], betterAlternatives: [alternatives[1]],
    extractedIngredients: ["whole grain oats"], educationalFooter: "Original educational footer",
    scoreCards: {
      kids: { verdict: "neutral" as const, reason: "Original kids assessment" },
      adults: { verdict: "thumbsUp" as const, reason: "Original adult assessment" },
      diet: { verdict: "neutral" as const, reason: "Original diet assessment" },
      fitnessGoal: { verdict: "neutral" as const, reason: "Original fitness assessment" },
    },
  };
  const original = render(wrap(<IngredientIntelligenceSheet open result={scan} onClose={jest.fn()} />));
  const gradeMarkup = screen.getByText("C").parentElement!.outerHTML;
  fireEvent.click(screen.getByRole("button", { name: "Save to Groceries" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  original.unmount(); queryClient.clear();
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: `View Analysis: ${scan.productName}` }));
  expect(screen.getByText("C").parentElement!.outerHTML).toBe(gradeMarkup);
  expect(screen.queryByTestId("analysis-details")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  for (const text of [scan.verdict, scan.overallSummary, scan.profileFactorsUsed[0], scan.whatMattersMost[0],
    scan.ingredientConsiderations[0], scan.extractedIngredients[0], scan.educationalFooter,
    alternatives[1].category, alternatives[1].whyBetter[0], alternatives[1].targetCriteria,
    "Original kids assessment", "Original adult assessment"]) {
    expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
  }
  expect(screen.getByText("Some Considerations")).toBeInTheDocument();
  expect(screen.queryByText("Analysis incomplete")).not.toBeInTheDocument();
  expect(buildResultFromSavedItem(rows["fixture-a"][0])).toEqual(scan);
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url === "/api/saved-groceries")).toBe(true);
  expect(post).not.toHaveBeenCalled();
  expect(writes).toHaveLength(1);
});

test.each(["C", undefined])("legacy analysis with grade %s shows genuine historical content without scan-failure messaging", async grade => {
  rows["fixture-a"] = [{ id: "legacy", productName: "Old cereal", productMeta: {
    alignmentGrade: grade, analysisMethod: "by_label", verdict: "Stored Chef verdict",
    overallSummary: "Stored personalized summary", whatMattersMost: ["Stored priority"],
    ingredientConsiderations: ["Stored consideration"],
  }, nutritionJson: null, compliance: { status: "approved" } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Old cereal" }));
  expect(screen.getByText("Saved historical analysis")).toBeInTheDocument();
  expect(screen.getByText(/Historical details not saved at the time are unavailable/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  for (const text of ["Stored Chef verdict", "Stored personalized summary", "Stored priority", "Stored consideration"]) {
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  }
  if (grade) expect(screen.getByText("Some Considerations")).toBeInTheDocument();
  else expect(screen.queryByText("Some Considerations")).not.toBeInTheDocument();
  expect(document.querySelector(".text-6xl")?.textContent).toBe(grade);
  expect(screen.queryByText("Analysis incomplete")).not.toBeInTheDocument();
  expect(writes).toEqual([]);
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url === "/api/saved-groceries")).toBe(true);
});

test("saved recommendations retain identity, brand, package and criteria without a parent grade or failed-scan presentation", async () => {
  rows["fixture-a"] = [{ id: "recommendation", productName: "Protein Bar", brand: "RXBAR", source: "grocery-coach",
    productMeta: { recommendationWhyBetter: ["The bar's original reason"], recommendationTargetCriteria: "The bar's original criteria",
      packageSize: "12 bars", alignmentGrade: "C", educationalFooter: "Saved recommendation note" },
    nutritionJson: null, compliance: { status: "approved" } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: RXBAR Protein Bar" }));
  expect(screen.getByText("Saved from Grocery Coach")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  expect(screen.getAllByText("RXBAR Protein Bar").length).toBeGreaterThan(0);
  expect(screen.getByText("Package: 12 bars")).toBeInTheDocument();
  expect(screen.getAllByText("The bar's original reason").length).toBeGreaterThan(0);
  expect(screen.getAllByText("The bar's original criteria").length).toBeGreaterThan(0);
  expect(screen.getByText("Saved recommendation note")).toBeInTheDocument();
  expect(screen.queryByText("Analysis incomplete")).not.toBeInTheDocument();
  expect(screen.queryByText("Some Considerations")).not.toBeInTheDocument();
  expect(document.querySelector(".text-6xl")).toBeNull();
  expect(writes).toEqual([]);
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url === "/api/saved-groceries")).toBe(true);
});

test("an unanalyzed recommendation shows each benefit once, a prominent action and one short source notice without a failed-label warning", async () => {
  const reasons = ["May have less sodium than some Parmesan products.", "Provides protein and calcium."];
  const verification = "Based on product knowledge, not a verified label scan. Check the current label before buying.";
  const row = { id: "grana", productName: "Grana Padano", source: "grocery-coach",
    evidenceRevision: "a".repeat(64),
    productMeta: { subjectKind: "human", recommendationWhyBetter: [...reasons, reasons[0]],
      recommendationTargetCriteria: "Compare sodium on the current package.", verificationMessage: verification },
    compliance: { status: "blocked", category: "evidence_missing",
      reason: "Ingredient evidence unavailable — cannot verify safety against your allergy profile" } };
  rows["fixture-a"] = [row];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Grana Padano" }));
  expect(screen.getByText("Saved from Grocery Coach")).toBeInTheDocument();
  expect(screen.getByText("Why It Was Recommended")).toBeInTheDocument();
  for (const reason of reasons) expect(screen.getAllByText(reason)).toHaveLength(1);
  const action = screen.getByRole("button", { name: "Analyze This Product" });
  expect(action).toHaveClass("w-full", "min-h-12", "text-base");
  const source = screen.getByTestId("analysis-source");
  expect(action.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(source).toHaveTextContent("Recommendation based on product knowledge. Check the current label for exact ingredients and nutrition.");
  expect(screen.queryByText(/separate Product Scan grade was not saved/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Ingredient evidence unavailable/)).not.toBeInTheDocument();
  expect(screen.queryByText(verification)).not.toBeInTheDocument();
  expect(screen.queryByText("Full Analysis")).not.toBeInTheDocument();
  expect(document.querySelector(".text-6xl")).toBeNull();
  expect(post).not.toHaveBeenCalled();
  expect(row.compliance.status).toBe("blocked"); // Presentation does not upgrade compatibility.
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  expect(screen.getAllByText(verification).length).toBeGreaterThan(0);
});

test.each(["incompatible", "profile_unavailable"])("recommendation cleanup preserves %s restrictions", async category => {
  rows["fixture-a"] = [{ id: "restricted", productName: "Restricted recommendation",
    productMeta: { subjectKind: "human", recommendationWhyBetter: ["Original benefit"] },
    compliance: { status: "blocked", category, reason: "Avoid this product because it contains your known milk allergen." } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Restricted recommendation" }));
  expect(screen.getByText("Avoid this product because it contains your known milk allergen.")).toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test("a partial historical scorecard displays only the genuinely saved assessment", async () => {
  rows["fixture-a"] = [{ id: "partial-scores", productName: "Older product",
    productMeta: { analysisMethod: "by_label" },
    nutritionJson: { scoreCards: { adults: { verdict: "neutral", reason: "The retained adult assessment" } } },
    compliance: { status: "approved" } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Older product" }));
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  expect(screen.getByText("The retained adult assessment")).toBeInTheDocument();
  expect(screen.queryByText(/ingredientSheet.scoreCards.kids/)).not.toBeInTheDocument();
  expect(screen.queryByText(/ingredientSheet.scoreCards.diet/)).not.toBeInTheDocument();
  expect(screen.queryByText("Analysis incomplete")).not.toBeInTheDocument();
  expect(writes).toEqual([]);
});

test("a saved recommendation is analyzed only after an explicit click, then reopens its own persisted result without another request", async () => {
  const row = { id: "rec-own", productName: "Protein Bar", brand: "RXBAR", source: "grocery-coach",
    evidenceRevision: "a".repeat(64), productMeta: { subjectKind: "human", recommendationWhyBetter: ["Original reason"],
      recommendationTargetCriteria: "Original criteria", packageSize: "12 bars" }, nutritionJson: null,
    compliance: { status: "approved" } };
  rows["fixture-a"] = [row];
  let finish!: (result: any) => void;
  (post as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: RXBAR Protein Bar" }));
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Analyze This Product" }));
  expect(screen.getByRole("button", { name: "Analyzing This Product…" })).toBeDisabled();
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith("/api/saved-groceries/rec-own/analyze", {
    expectedRevision: row.evidenceRevision, requestId: expect.any(String),
  });
  const snapshot = { ...buildResultFromSavedItem(row as any), productName: "RXBAR Protein Bar",
    alignmentGrade: "C", gradeUnavailable: false, fallbackUsed: false, verdict: "This bar's own Chef explanation",
    overallSummary: "This bar's own summary", whatMattersMost: ["This bar's own point"], analysisMethod: "by_name" };
  const updated = { ...row, evidenceRevision: "b".repeat(64), productMeta: { ...row.productMeta, analysisSnapshot: snapshot } };
  rows["fixture-a"] = [updated];
  await act(async () => finish({ item: updated }));
  expect(await screen.findByText("This bar's own Chef explanation")).toBeInTheDocument();
  expect(screen.getByText("Some Considerations")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Analyze This Product" })).not.toBeInTheDocument();
  view.unmount(); queryClient.clear();
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: RXBAR Protein Bar" }));
  expect(screen.getByText("This bar's own Chef explanation")).toBeInTheDocument();
  expect(post).toHaveBeenCalledTimes(1);
  expect(rows["fixture-a"][0].productMeta.recommendationWhyBetter).toEqual(["Original reason"]);
});

test("a late analysis result cannot follow the customer into another account", async () => {
  rows["fixture-a"] = [{ id: "rec-a", productName: "Private A product", evidenceRevision: "a".repeat(64),
    productMeta: { recommendationWhyBetter: ["Private A reason"] }, compliance: { status: "approved" } }];
  let finish!: (value: any) => void;
  (post as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Private A product" }));
  fireEvent.click(screen.getByRole("button", { name: "Analyze This Product" }));
  owner = "fixture-b"; view.rerender(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  await act(async () => finish({ item: { ...rows["fixture-a"][0], productMeta: { analysisSnapshot: { verdict: "Private A generated explanation" } } } }));
  expect(screen.queryByText("Private A generated explanation")).not.toBeInTheDocument();
  expect(screen.queryByText("Private A reason")).not.toBeInTheDocument();
  expect(rows["fixture-b"]).toEqual([]);
});

test("uncertain generation failures do not auto-retry and explicit retries retain the same operation ID", async () => {
  rows["fixture-a"] = [{ id: "uncertain", productName: "Saved bar", evidenceRevision: "a".repeat(64),
    productMeta: { recommendationWhyBetter: ["Original reason"] }, compliance: { status: "approved" } }];
  (post as jest.Mock).mockRejectedValue({ body: JSON.stringify({ code: "persistence_uncertain" }) });
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Saved bar" }));
  fireEvent.click(screen.getByRole("button", { name: "Analyze This Product" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("saving could not be confirmed");
  expect(post).toHaveBeenCalledTimes(1);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 310)); });
  fireEvent.click(screen.getByRole("button", { name: "Analyze This Product" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect((post as jest.Mock).mock.calls[0][1]).toEqual((post as jest.Mock).mock.calls[1][1]);
});

test("companion saved recommendations never offer human analysis", async () => {
  rows["fixture-a"] = [{ id: "companion-rec", productName: "Companion food", evidenceRevision: "a".repeat(64),
    productMeta: { subjectKind: "companion", recommendationWhyBetter: ["Original companion reason"] }, compliance: { status: "approved" } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Companion food" }));
  expect(screen.queryByRole("button", { name: "Analyze This Product" })).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test("an older backend without analysis capability keeps recommendation viewing working without exposing a broken paid action", async () => {
  rows["fixture-a"] = [{ id: "old-backend", productName: "Saved bar", evidenceRevision: "a".repeat(64),
    productMeta: { recommendationWhyBetter: ["Original recommendation"] }, compliance: { status: "approved" } }];
  (get as jest.Mock).mockResolvedValue({ items: rows["fixture-a"] });
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Saved bar" }));
  expect(screen.getAllByText("Original recommendation").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Analyze This Product" })).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
});

test.each([
  ["Product Scan", {}], ["Grocery Coach", { embedded: true, saveSource: "grocery-coach" }],
  ["Saved Groceries", { savedAnalysisKind: "full", hideSaveAction: true }],
  ["Meal ingredient brands", { embedded: true, saveSource: "grocery-coach" }],
  ["Biometrics", {}], ["Companion", { companionName: "Fixture companion" }],
] as const)("%s uses the same four-section layout with optional details and visible restrictions", (_entry, props) => {
  const result = { ...buildResultFromSavedItem({ productName: "Fixture food", productMeta: null } as any),
    alignmentGrade: "C" as const, gradeUnavailable: false, fallbackUsed: false, verdict: "Concise Chef explanation",
    overallSummary: "Expanded description", analysisMethod: "by_name" as const,
    whatMattersMost: ["Concise Chef explanation", "Own useful point", "Own useful point!", "Second point", "Third point", "Detail-only point"],
    betterAlternatives: [alternatives[1]], analysisProfile: ["Cardiac"], profileFactorsUsed: ["A saved profile factor"],
    ingredientConsiderations: ["Avoid peanuts because of your allergy."], educationalFooter: "Original source notice" };
  const view = render(wrap(<IngredientIntelligenceSheet open result={result} onClose={jest.fn()} {...props as any} />));
  expect(screen.getByText("Some Considerations")).toBeInTheDocument();
  expect(screen.getByText("Chef's Heads Up")).toBeInTheDocument();
  expect(screen.getByText("What Matters for You")).toBeInTheDocument();
  expect(screen.getByText("Own useful point")).toBeInTheDocument();
  expect(screen.queryByText("Own useful point!")).not.toBeInTheDocument();
  expect(screen.queryByText("Detail-only point")).not.toBeInTheDocument();
  expect(screen.getByText("Avoid peanuts because of your allergy.")).toBeInTheDocument();
  expect(screen.getAllByTestId("analysis-source")).toHaveLength(1);
  expect(screen.queryByText("Expanded description")).not.toBeInTheDocument();
  const details = screen.getByRole("button", { name: "More Analysis Details" });
  expect(details).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(details);
  expect(screen.getByText("Expanded description")).toBeInTheDocument();
  expect(screen.getByText("Detail-only point")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /updateProfile|lab/i })).not.toBeInTheDocument();
  expect(screen.queryByText("ingredientSheet.analysisProfile.deeperTitle")).not.toBeInTheDocument();
  view.unmount();
});

test("reopening a saved front-label snapshot never offers or runs a new by-name analysis", async () => {
  const snapshot = { ...buildResultFromSavedItem({ productName: "Saved front label", productMeta: null } as any),
    isFrontLabel: true, gradeUnavailable: true, overallSummary: "Original front-label result" };
  rows["fixture-a"] = [{ id: "front-label", productName: snapshot.productName,
    productMeta: { analysisSnapshot: snapshot }, compliance: { status: "approved" } }];
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Saved front label" }));
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  expect(screen.getByText(snapshot.overallSummary)).toBeInTheDocument();
  expect(document.querySelector(".text-6xl")).toBeNull();
  expect(writes).toEqual([]);
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url === "/api/saved-groceries")).toBe(true);
});

test("a blocked legacy Coach product has a working View Analysis and label-verification action", async () => {
  rows["fixture-a"] = [{
    id: "legacy", productName: "Orange", brand: "Simply", source: "grocery-coach",
    productMeta: { reason: "Original Coach explanation", verificationMessage: "Check the complete ingredient label." },
    compliance: { status: "blocked", category: "evidence_missing", reason: "Ingredient evidence unavailable" },
  }];
  const verify = jest.fn();
  render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} onVerifyProduct={verify} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Simply Orange" }));
  expect(await screen.findByText("Original Coach explanation")).toBeInTheDocument();
  expect(screen.queryByText("ingredientSheet.howItScoresForYou")).not.toBeInTheDocument();
  expect(screen.getByTestId("analysis-source")).toHaveTextContent("Check the current label for exact ingredients and nutrition.");
  expect(screen.queryByText("Ingredient evidence unavailable")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Simply Orange to List" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More Analysis Details" }));
  expect(screen.getAllByText(/Check the complete ingredient label/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Scan current ingredient label" }));
  expect(verify).toHaveBeenCalledWith(rows["fixture-a"][0]);
  expect(post).not.toHaveBeenCalled();
});

test("an open saved analysis never follows the customer into another account", async () => {
  rows["fixture-a"] = [{ id: "legacy", productName: "Private A product", source: "manual",
    productMeta: { reason: "A-only explanation" }, compliance: { status: "approved" } }];
  const view = render(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  fireEvent.click(await screen.findByRole("button", { name: "View Analysis: Private A product" }));
  expect(await screen.findByText("A-only explanation")).toBeInTheDocument();
  owner = "fixture-b";
  view.rerender(wrap(<SavedGroceriesSheet open onOpenChange={jest.fn()} />));
  await waitFor(() => expect(screen.queryByText("A-only explanation")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "View Analysis: Private A product" })).not.toBeInTheDocument();
});

test("a split-brand recommendation recognizes the same legacy full-name scan without a duplicate save", async () => {
  rows["fixture-a"] = [{ id: "old-scan", productKey: "name::::simplyorangepulpfree", productName: "Simply Orange Pulp Free", brand: null }];
  render(wrap(<RecommendedProductActions alternative={{
    category: "Orange juice", brand: "Simply", productName: "Orange Pulp Free", whyBetter: [], targetCriteria: "",
  }} query="Juice" educationalFooter={warning} />));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save to Groceries: Simply Orange Pulp Free" })).toBeDisabled());
  expect(writes).toHaveLength(0);
});

test.each([
  [null, "new-upc", true],
  ["old-upc", "new-upc", false],
] as const)("scan bookmarks preserve name fallback without conflating conflicting UPCs", async (savedBarcode, currentBarcode, expectedSaved) => {
  const item = { id: "old-scan", productKey: "name::simply::orangepulpfree", productName: "Orange Pulp Free",
    brand: "Simply", barcode: savedBarcode, productMeta: null, nutritionJson: null };
  rows["fixture-a"] = [item];
  const scan = { ...buildResultFromSavedItem(item as any), barcode: currentBarcode };
  render(wrap(<IngredientIntelligenceSheet open result={scan} onClose={jest.fn()} />));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/saved-groceries"));
  if (expectedSaved) expect(await screen.findByRole("button", { name: "Saved to Groceries" })).toBeInTheDocument();
  else expect(screen.getByRole("button", { name: "Save to Groceries" })).toBeInTheDocument();
});
