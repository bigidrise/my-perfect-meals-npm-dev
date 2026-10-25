import type { IngredientScanResult } from "./photoIngredientCapture";
import { groceryProductLabel } from "./savedGroceryRecommendation";

export interface SavedAnalysisProduct {
  productName: string;
  brand?: string | null;
  barcode?: string | null;
  productMeta?: Record<string, any> | null;
  nutritionJson?: Record<string, any> | null;
}

export function scanSavePayload(result: IngredientScanResult, source: "scanner" | "grocery-coach", companionName?: string) {
  return {
    productName: result.productName,
    source,
    barcode: result.barcode?.trim() || undefined,
    nutritionJson: { scoreCards: result.scoreCards, outcomeCards: result.outcomeCards },
    productMeta: {
      analysisSnapshotVersion: 1,
      analysisSnapshot: result,
      analysisSavedAt: new Date().toISOString(),
      subjectKind: companionName ? "companion" : "human",
      alignmentGrade: result.gradeUnavailable ? undefined : result.alignmentGrade,
      gradeUnavailable: !!result.gradeUnavailable,
      verdictLevel: result.verdictLevel,
      analysisMethod: result.analysisMethod,
      ingredients: result.analysisMethod === "by_label" || result.resolvedFromDb === true
        ? result.extractedIngredients : undefined,
      resolvedFromDb: result.resolvedFromDb,
      resolvedName: result.resolvedName,
      verificationMessage: result.educationalFooter,
      evidenceStatus: "unverified",
    },
  };
}

/** Legacy fields are information, never permission to invent grades or evidence. */
export function restoreSavedAnalysis(item: SavedAnalysisProduct): Partial<IngredientScanResult> {
  const meta = item.productMeta ?? {};
  const snapshot = meta.analysisSnapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const supportedGrade = ["A", "B", "C", "D"].includes(snapshot.alignmentGrade);
    return {
      ...snapshot,
      productName: groceryProductLabel(item),
      barcode: item.barcode ?? snapshot.barcode,
      gradeUnavailable: snapshot.gradeUnavailable === true || !supportedGrade,
    };
  }
  const reasons = Array.isArray(meta.recommendationWhyBetter)
    ? meta.recommendationWhyBetter.filter((v: unknown): v is string => typeof v === "string") : [];
  const summary = reasons.join(" ") || (typeof meta.reason === "string" ? meta.reason : "");
  const warnings = [meta.recommendationTargetCriteria, meta.verificationMessage, meta.wholeFoodNote]
    .filter((v): v is string => typeof v === "string" && !!v);
  const grade = meta.alignmentGrade ?? (meta.evidenceStatus === "verified" ? meta.grade : undefined);
  return {
    overallSummary: summary || "The original analysis text was not stored with this older product.",
    ingredientConsiderations: [...reasons, ...warnings],
    educationalFooter: meta.educationalFooter || meta.verificationMessage || "Current label evidence is not verified by saving this product.",
    alignmentGrade: grade,
    gradeUnavailable: meta.gradeUnavailable === true || !["A", "B", "C", "D"].includes(grade),
    fallbackUsed: !grade,
  };
}

export function savedProductStatus(item: { compliance: { status: string; category?: string; reason?: string | null } }) {
  const c = item.compliance;
  if (c.status !== "blocked") return "Current profile checks passed";
  if (c.category === "profile_unavailable") return "Current profile check unavailable";
  if (c.category === "evidence_missing") return "Label or nutrition evidence needed";
  return "Restricted by current profile";
}
