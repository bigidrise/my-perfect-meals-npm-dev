import { distinctAnalysisText, primaryAnalysisPoints, visibleAnalysisRestrictions } from "../ingredientAnalysisPresentation";
import type { IngredientScanResult } from "../photoIngredientCapture";

test("primary points are useful stored text only, deduplicated against Chef and limited to three", () => {
  const result = { verdict: "Check added sugar.", whatMattersMost: ["Check added sugar", "Protein supports training.",
    "protein supports training!", "", "Compare servings", "Check sodium", "Extra detail"] } as IngredientScanResult;
  const before = JSON.stringify(result);
  expect(primaryAnalysisPoints(result)).toEqual(["Protein supports training.", "Compare servings", "Check sodium"]);
  expect(JSON.stringify(result)).toBe(before);
  expect(primaryAnalysisPoints({ whatMattersMost: [] } as any)).toEqual([]);
});

test("meaningful restrictions remain visible even when other information is collapsed", () => {
  const result = { verdict: "Avoid peanuts.", whatMattersMost: [], highRiskFindings: [{ ingredientName: "Milk", reason: "Allergy conflict" }],
    outcomeCards: [{ verdict: "conflicts", reason: "Conflicts with current medical restriction" }],
    ingredientConsiderations: ["Avoid peanuts", "Confirm the current label before consuming", "A long product description"],
    mayNotAlignWith: ["Avoid grapefruit with this medication"], householdNotes: ["Cross-contact must be checked"] } as any;
  expect(visibleAnalysisRestrictions(result)).toEqual(["Milk: Allergy conflict", "Conflicts with current medical restriction",
    "Confirm the current label before consuming", "Avoid grapefruit with this medication", "Cross-contact must be checked"]);
});

test("display deduplication does not modify original historical text", () => {
  const original = ["Label not verified.", "label not verified!", "Original distinct note"];
  expect(distinctAnalysisText(original)).toEqual([original[0], original[2]]);
  expect(original).toHaveLength(3);
});
