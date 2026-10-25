/** @jest-environment jsdom */
import { scanSavePayload, restoreSavedAnalysis, savedAnalysisKind, savedProductStatus } from "../savedGroceryAnalysis";
import { saveProductScan, getSavedProducts, clearExpiredShoppingScans } from "../shoppingScanStorage";
import type { IngredientScanResult } from "../photoIngredientCapture";

const result = {
  productName: "Simply Orange Pulp Free", barcode: "1234",
  alignmentGrade: "C", gradeUnavailable: false, analysisMethod: "by_label",
  overallSummary: "Original personalized explanation",
  educationalFooter: "Check this label against your current allergy profile.",
  ingredientConsiderations: ["Original warning"], extractedIngredients: ["orange juice"],
  scoreCards: {}, outcomeCards: [], betterAlternatives: [],
} as unknown as IngredientScanResult;

test.each(["scanner", "grocery-coach"] as const)("full %s analysis survives saving and restoring without another lookup", source => {
  const payload = JSON.parse(JSON.stringify(scanSavePayload(result, source)));
  const restored = restoreSavedAnalysis(payload);
  expect(payload.source).toBe(source);
  expect(restored).toMatchObject(result);
  expect(payload.productMeta.ingredients).toEqual(["orange juice"]);
  expect(payload.nutritionJson.fat).toBeUndefined();
});

test("knowledge-based analysis is preserved without claiming its ingredient guesses are label evidence", () => {
  const payload = scanSavePayload({ ...result, analysisMethod: "by_name", gradeUnavailable: true }, "grocery-coach");
  expect(payload.productMeta.ingredients).toBeUndefined();
  expect(restoreSavedAnalysis(payload).gradeUnavailable).toBe(true);
});

test("partial legacy scans retain their actual grade, explanations, and available analysis sections", () => {
  const meta = { alignmentGrade: "C", verdict: "Original Chef explanation", overallSummary: "Original summary",
    whatMattersMost: ["Original priority"], profileFactorsUsed: ["Original profile factor"],
    ingredientConsiderations: ["Original consideration"], betterAlternatives: [{ category: "Original option", whyBetter: ["Reason"], targetCriteria: "Criteria" }],
    educationalFooter: "Original footer" };
  const item = { productName: "Original cereal", productMeta: meta };
  expect(savedAnalysisKind(item)).toBe("legacy");
  expect(restoreSavedAnalysis(item)).toMatchObject({ ...meta, gradeUnavailable: false, fallbackUsed: false });
});

test.each([undefined, "Z", ""])("legacy missing or invalid grade %s is unavailable, never a failed new scan", grade => {
  const item = { productName: "Old cereal", productMeta: { alignmentGrade: grade } };
  expect(restoreSavedAnalysis(item)).toMatchObject({
    alignmentGrade: undefined, gradeUnavailable: true, fallbackUsed: false, overallSummary: "",
  });
});

test("recommendations ignore stray parent grades and retain only their own saved recommendation content", () => {
  const item = { productName: "Protein bar", brand: "RXBAR", productMeta: {
    alignmentGrade: "C", grade: "A", evidenceStatus: "verified", recommendationWhyBetter: ["Its own reason"],
    recommendationTargetCriteria: "Its own criteria", educationalFooter: "Original note",
    verdict: "Parent verdict must not appear", profileFactorsUsed: ["Parent personalization"],
  } };
  expect(savedAnalysisKind(item)).toBe("recommendation");
  expect(restoreSavedAnalysis(item)).toMatchObject({ gradeUnavailable: true, alignmentGrade: undefined,
    fallbackUsed: false, overallSummary: "Its own reason", ingredientConsiderations: ["Its own reason", "Its own criteria"],
    educationalFooter: "Original note" });
  expect(restoreSavedAnalysis(item).verdict).toBeUndefined();
  expect(restoreSavedAnalysis(item).profileFactorsUsed).toBeUndefined();
});

test("a full snapshot takes priority over older recommendation metadata without altering historical content", () => {
  const payload = scanSavePayload(result, "scanner");
  const item = { ...payload, productMeta: { ...payload.productMeta, recommendationWhyBetter: ["Older recommendation"] } };
  expect(savedAnalysisKind(item)).toBe("full");
  expect(restoreSavedAnalysis(item)).toMatchObject(result);
});

test("legacy Coach reasons and verification messages remain readable, with no invented grade", () => {
  const restored = restoreSavedAnalysis({ productName: "Oat Milk", brand: "Oatly",
    productMeta: { reason: "Original Coach advice", verificationMessage: "Unverified suggestion", grade: "A", evidenceStatus: "unverified" } });
  expect(restored.productName).toBeUndefined();
  expect(restored.overallSummary).toBe("Original Coach advice");
  expect(restored.educationalFooter).toBe("Unverified suggestion");
  expect(restored.gradeUnavailable).toBe(true);
});

test("eligibility language separates missing evidence, incompatibility and resolver availability", () => {
  expect(savedProductStatus({ compliance: { status: "blocked", category: "evidence_missing" } })).toMatch(/evidence needed/);
  expect(savedProductStatus({ compliance: { status: "blocked", category: "profile_unavailable" } })).toMatch(/unavailable/);
  expect(savedProductStatus({ compliance: { status: "blocked", category: "incompatible" } })).toMatch(/Restricted/);
});

test("temporary history is account-owned across logout/login and never imports unowned legacy history", () => {
  localStorage.clear();
  localStorage.setItem("mpm.shopping.savedProducts", JSON.stringify([{ productName: "Unowned old scan" }]));
  const scan = { productName: "A's scan", ingredients: [], score: "", householdFlags: [],
    scanDate: new Date().toISOString(), userDecision: "saved", scanSource: "shopping" } as const;
  saveProductScan({ ...scan, ingredients: [], householdFlags: [] }, "a");
  expect(getSavedProducts("a")).toHaveLength(1);
  expect(getSavedProducts("b")).toEqual([]);
  expect(getSavedProducts(null)).toEqual([]);
  expect(getSavedProducts("a")[0].productName).toBe("A's scan");
  clearExpiredShoppingScans("b");
  expect(getSavedProducts("a")).toHaveLength(1);
  expect(() => saveProductScan({ ...scan, ingredients: [], householdFlags: [] }, null)).toThrow(/Sign in/);
});
