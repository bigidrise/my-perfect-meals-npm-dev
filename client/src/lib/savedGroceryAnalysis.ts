import type { IngredientScanResult } from "./photoIngredientCapture";
import { groceryProductLabel } from "./savedGroceryRecommendation";

export interface SavedAnalysisProduct {
  productName: string;
  brand?: string | null;
  barcode?: string | null;
  productMeta?: Record<string, any> | null;
  nutritionJson?: Record<string, any> | null;
}

export type SavedAnalysisKind = "full" | "legacy" | "recommendation";

export function savedAnalysisKind(item: SavedAnalysisProduct): SavedAnalysisKind {
  const meta = item.productMeta ?? {};
  if (meta.analysisSnapshot && typeof meta.analysisSnapshot === "object" && !Array.isArray(meta.analysisSnapshot)) return "full";
  if (Array.isArray(meta.recommendationWhyBetter) || typeof meta.recommendationTargetCriteria === "string" ||
      (typeof meta.reason === "string" && !meta.alignmentGrade && meta.analysisMethod !== "by_label")) return "recommendation";
  return "legacy";
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
  const kind = savedAnalysisKind(item);
  if (kind === "full") {
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
  const grade = kind === "recommendation" ? undefined
    : meta.alignmentGrade ?? (meta.evidenceStatus === "verified" ? meta.grade : undefined);
  // Some historical writers stored analysis fields directly, without a snapshot.
  // Copy only genuine stored content; presentation defaults are not evidence.
  const stored: Partial<IngredientScanResult> = {};
  for (const key of ["overallSummary", "verdict", "educationalFooter"] as const) {
    if (typeof meta[key] === "string") stored[key] = meta[key];
  }
  for (const key of ["analysisProfile", "betterAlternatives", "ingredientDecoder", "ingredientConsiderations",
    "mayNotAlignWith", "betterFor", "householdNotes", "extractedIngredients", "highRiskFindings",
    "profileFactorsUsed", "whatMattersMost", "outcomeCards"] as const) {
    if (Array.isArray(meta[key])) Object.assign(stored, { [key]: meta[key] });
  }
  if (meta.scoreCards && typeof meta.scoreCards === "object") stored.scoreCards = meta.scoreCards;
  if (kind === "recommendation") {
    return {
      overallSummary: summary,
      ingredientConsiderations: [...reasons, ...warnings],
      educationalFooter: typeof meta.educationalFooter === "string" ? meta.educationalFooter
        : typeof meta.verificationMessage === "string" ? meta.verificationMessage : "",
      alignmentGrade: undefined,
      gradeUnavailable: true,
      fallbackUsed: false,
    };
  }
  return {
    overallSummary: summary,
    ingredientConsiderations: [...reasons, ...warnings],
    educationalFooter: typeof meta.verificationMessage === "string" ? meta.verificationMessage : "",
    ...stored,
    alignmentGrade: ["A", "B", "C", "D"].includes(grade) ? grade : undefined,
    gradeUnavailable: meta.gradeUnavailable === true || !["A", "B", "C", "D"].includes(grade),
    fallbackUsed: false,
  };
}

export function savedProductStatus(item: { compliance: { status: string; category?: string; reason?: string | null } }) {
  const c = item.compliance;
  if (c.status !== "blocked") return "Current profile checks passed";
  if (c.category === "profile_unavailable") return "Current profile check unavailable";
  if (c.category === "evidence_missing") return "Label or nutrition evidence needed";
  return "Restricted by current profile";
}
