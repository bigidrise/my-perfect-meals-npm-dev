import { createHash } from "node:crypto";
import { computeProductKey } from "../utils/productKey";

export function savedEvidenceRevision(item: { productMeta?: unknown; nutritionJson?: unknown }) {
  return createHash("sha256").update(JSON.stringify([item.productMeta ?? null, item.nutritionJson ?? null])).digest("hex");
}

export function prepareSavedEvidenceUpdate(item: any, body: any) {
  if (body?.confirmedCurrentLabel !== true) throw new Error("Confirm that this is the current label for this exact product.");
  if (body.expectedRevision !== savedEvidenceRevision(item)) throw new Error("This saved product changed. Reopen it before updating evidence.");
  const result = body.analysis;
  if (!result || result.analysisMethod !== "by_label" || result.isFrontLabel ||
      !Array.isArray(result.extractedIngredients) || !result.extractedIngredients.length ||
      !result.extractedIngredients.every((v: unknown) => typeof v === "string" && v.trim())) {
    throw new Error("Scan a readable ingredient label. Name-only advice cannot update ingredient evidence.");
  }
  const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const observedBarcode = typeof result.barcode === "string" ? result.barcode.trim() : "";
  const sameBarcode = !!item.barcode && observedBarcode === item.barcode;
  if (item.barcode && observedBarcode && !sameBarcode) throw new Error("The scanned barcode belongs to a different product.");
  const nameIncludesBrand = !!item.brand && (item.productName.toLowerCase() === item.brand.toLowerCase() ||
    item.productName.toLowerCase().startsWith(item.brand.toLowerCase() + " "));
  const expectedName = nameIncludesBrand ? item.productName : `${item.brand || ""} ${item.productName}`.trim();
  const observedName = typeof result.productName === "string" ? result.productName : "";
  const sameName = normalize(observedName) === normalize(expectedName) ||
    (!item.brand && computeProductKey(null, null, observedName) === item.productKey);
  if (!sameBarcode && !sameName) throw new Error("The scanned brand and product must match this saved item exactly.");
  if (JSON.stringify(result).length > 80000) throw new Error("The analysis is too large to store safely.");
  const oldMeta = item.productMeta ?? {};
  const { evidenceHistory = [], ...previousMeta } = oldMeta;
  if (!Array.isArray(evidenceHistory) || evidenceHistory.length >= 10) throw new Error("Evidence history is full; no previous evidence was overwritten.");
  // Previous label values remain in history, not as claims about the new label.
  const nutrition: Record<string, unknown> = {};
  if (result.scoreCards) nutrition.scoreCards = result.scoreCards;
  if (result.outcomeCards) nutrition.outcomeCards = result.outcomeCards;
  if (body.nutrition) {
    if (typeof body.nutrition.servingBasis !== "string" || !body.nutrition.servingBasis.trim()) throw new Error("Provide the serving basis shown on the label.");
    for (const key of ["fat", "carbs"]) {
      const value = body.nutrition[key];
      if (value !== undefined) {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Label nutrition must be a non-negative number.");
        nutrition[key] = value;
      }
    }
    nutrition.servingBasis = body.nutrition.servingBasis.trim();
  }
  return {
    nutritionJson: nutrition,
    productMeta: {
      ...oldMeta,
      analysisSnapshotVersion: 1,
      analysisSnapshot: result,
      ingredients: result.extractedIngredients,
      // Certification and old DB evidence cannot be inherited by a new photo.
      certifications: [], labels: [], resolvedFromDb: false,
      evidenceStatus: "user_confirmed_label",
      verificationMessage: "User-confirmed label scan; not independent safety certification. Current profile checks still apply.",
      analysisSavedAt: new Date().toISOString(),
      evidenceHistory: [...evidenceHistory, { productMeta: previousMeta, nutritionJson: item.nutritionJson ?? null }],
    },
  };
}
