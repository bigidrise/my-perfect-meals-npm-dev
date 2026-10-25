import { prepareSavedEvidenceUpdate, savedEvidenceRevision } from "../services/savedGroceryEvidence";
import type { NewUserSavedGroceryItem } from "../../shared/schema";

const item = {
  id: "one", productKey: "name::simply::orangepulpfree", productName: "Orange Pulp Free", brand: "Simply",
  barcode: null, productMeta: { reason: "Original advice", ingredients: ["previous formulation"] },
  nutritionJson: { fat: 4, carbs: 20, calories: 150, sodium: 30 },
};
const analysis = { productName: "Simply Orange Pulp Free", analysisMethod: "by_label", extractedIngredients: ["orange juice"], educationalFooter: "New label" };
const body = () => ({ confirmedCurrentLabel: true, expectedRevision: savedEvidenceRevision(item), analysis });

test("the database update preserves mixed nutrition, analysis metadata and previous evidence", () => {
  const original = structuredClone(item);
  const scoreCards = [{ title: "Label assessment", details: { explanation: "Preserved verbatim" } }];
  const outcomeCards = { considerations: ["Current label"], extra: { source: "scan" } };
  const currentAnalysis = { ...analysis, scoreCards, outcomeCards };
  const updated = prepareSavedEvidenceUpdate(item, {
    ...body(),
    analysis: currentAnalysis,
    nutrition: { fat: 0, carbs: 5, servingBasis: " 250 ml " },
  });
  const storageUpdate: Pick<NewUserSavedGroceryItem, "nutritionJson" | "productMeta"> = updated;

  expect(storageUpdate.nutritionJson).toEqual({
    fat: 0, carbs: 5, servingBasis: "250 ml", scoreCards, outcomeCards,
  });
  expect(updated.productMeta.analysisSnapshot).toEqual(currentAnalysis);
  expect(updated.productMeta.reason).toBe(item.productMeta.reason);
  expect(updated.productMeta.evidenceHistory).toEqual([
    { productMeta: item.productMeta, nutritionJson: item.nutritionJson },
  ]);
  expect(item).toEqual(original);
});

test("metadata-only evidence updates never invent numeric nutrition values", () => {
  const scoreCards = [{ title: "Ingredient evidence" }];
  const updated = prepareSavedEvidenceUpdate(item, {
    ...body(), analysis: { ...analysis, scoreCards },
  });
  expect(updated.nutritionJson).toEqual({ scoreCards });
  expect(updated.productMeta.evidenceHistory[0].nutritionJson).toEqual(item.nutritionJson);
});

test("explicit same-product update retains all previous evidence without changing identity", () => {
  const updated = prepareSavedEvidenceUpdate(item, body());
  expect(updated.productMeta.analysisSnapshot).toEqual(analysis);
  expect(updated.productMeta.evidenceHistory).toEqual([{ productMeta: item.productMeta, nutritionJson: item.nutritionJson }]);
  expect(updated).not.toHaveProperty("productName");
  expect(updated).not.toHaveProperty("productKey");
  expect(updated.nutritionJson.fat).toBeUndefined();
  expect(updated.nutritionJson.carbs).toBeUndefined();
  expect(updated.nutritionJson.calories).toBeUndefined();
  expect(updated.nutritionJson.sodium).toBeUndefined();
});

test.each([
  [{ confirmedCurrentLabel: false }, /Confirm/],
  [{ expectedRevision: "stale" }, /changed/],
  [{ analysis: { ...analysis, analysisMethod: "by_name" } }, /readable ingredient/],
  [{ analysis: { ...analysis, productName: "Other Brand Orange Pulp Free" } }, /brand and product/],
  [{ analysis: { ...analysis, extractedIngredients: [] } }, /readable ingredient/],
  [{ nutrition: { fat: -1, servingBasis: "250 ml" } }, /non-negative/],
  [{ nutrition: { fat: 0 } }, /serving basis/],
])("rejects unsafe, unconfirmed or mismatched updates", (changes, message) => {
  expect(() => prepareSavedEvidenceUpdate(item, { ...body(), ...changes })).toThrow(message);
  expect(item.productMeta.ingredients).toEqual(["previous formulation"]);
});

test("different barcode cannot be accepted merely because its name matches", () => {
  const known = { ...item, barcode: "123" };
  expect(() => prepareSavedEvidenceUpdate(known, { ...body(), expectedRevision: savedEvidenceRevision(known),
    analysis: { ...analysis, barcode: "456" } })).toThrow(/barcode/);
});

test("a legacy product name that already includes its brand retains exact identity", () => {
  const legacy = { ...item, productName: "Simply Orange Pulp Free" };
  expect(prepareSavedEvidenceUpdate(legacy, { ...body(), expectedRevision: savedEvidenceRevision(legacy) }).productMeta.ingredients)
    .toEqual(["orange juice"]);
});

test("label nutrition requires explicit values and a serving basis; zeros remain valid evidence", () => {
  expect(prepareSavedEvidenceUpdate(item, { ...body(), nutrition: { fat: 0, carbs: 5, servingBasis: "250 ml" } }).nutritionJson)
    .toMatchObject({ fat: 0, carbs: 5, servingBasis: "250 ml" });
});

test("history limit rejects instead of silently dropping earlier evidence", () => {
  const full = { ...item, productMeta: { evidenceHistory: Array(10).fill({}) } };
  expect(() => prepareSavedEvidenceUpdate(full, { ...body(), expectedRevision: savedEvidenceRevision(full) })).toThrow(/history is full/);
});
