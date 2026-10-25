import { createHash } from "node:crypto";
import type { IngredientScanResult } from "./ingredientScanService";
import { savedEvidenceRevision } from "./savedGroceryEvidence";
import { isCompleteIngredientAnalysis } from "../../shared/ingredientAnalysisSnapshot";

export interface SavedAnalysisRow {
  id: string;
  userId: string;
  productName: string;
  brand?: string | null;
  barcode?: string | null;
  productKey: string;
  source: string;
  productMeta?: Record<string, any> | null;
  nutritionJson?: unknown;
  [key: string]: any;
}

export interface SavedAnalysisStore {
  // Short row-locked transactions; never hold a DB connection while calling AI.
  withItem<T>(owner: string, id: string, change: (row: SavedAnalysisRow | null) => {
    value: T; productMeta?: Record<string, any>;
  }): Promise<T>;
}

export class SavedAnalysisError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function completeSavedAnalysis(meta: Record<string, any>): boolean {
  return isCompleteIngredientAnalysis(meta.analysisSnapshot);
}

/** Includes identity AND operation state; evidence-only revisions cannot detect a rename. */
export function savedAnalysisRevision(
  row: Pick<SavedAnalysisRow, "id" | "userId" | "productName" | "brand" | "barcode" | "productKey" | "source" | "nutritionJson"> & { productMeta?: unknown },
): string {
  return createHash("sha256").update(JSON.stringify([
    row.id, row.userId, row.productName, row.brand, row.barcode, row.productKey,
    row.source, row.productMeta ?? null, row.nutritionJson ?? null,
  ])).digest("hex");
}

/** Store an existing result only. This path has no AI dependency or evidence mutation. */
export async function attachSavedGroceryAnalysis(
  store: SavedAnalysisStore, owner: string, id: string,
  input: { expectedAnalysisRevision?: string; analysis?: IngredientScanResult & { barcode?: string }; subjectKind?: string },
) {
  const result = input.analysis;
  if (!/^[a-f0-9]{64}$/.test(input.expectedAnalysisRevision ?? "") || !result ||
      !isCompleteIngredientAnalysis(result) || JSON.stringify(result).length > 80000) {
    throw new SavedAnalysisError(400, "invalid_snapshot", "A complete existing analysis and current saved-product revision are required.");
  }
  return store.withItem(owner, id, row => {
    if (!row) throw new SavedAnalysisError(404, "not_found", "Saved product not found for this account.");
    if (savedAnalysisRevision(row) !== input.expectedAnalysisRevision) {
      throw new SavedAnalysisError(409, "stale_record", "This saved product changed. Reopen it; no analysis was overwritten.");
    }
    const meta = row.productMeta ?? {};
    if (completeSavedAnalysis(meta)) {
      throw new SavedAnalysisError(409, "analysis_already_saved", "A complete analysis is already saved. Reopen it; no analysis was overwritten.");
    }
    if (meta.analysisRequest?.state === "running") {
      throw new SavedAnalysisError(409, "analysis_in_progress", "Analysis is already in progress. No existing result was overwritten.");
    }
    if ((meta.subjectKind ?? "human") !== (input.subjectKind ?? "human")) {
      throw new SavedAnalysisError(409, "subject_mismatch", "The analysis subject must match this saved product.");
    }
    const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const name = row.brand && !normalize(row.productName).startsWith(`${normalize(row.brand)} `) &&
      normalize(row.productName) !== normalize(row.brand) ? `${row.brand} ${row.productName}` : row.productName;
    if (typeof result.productName !== "string" || normalize(result.productName) !== normalize(name) ||
        (row.barcode && result.barcode && row.barcode.trim() !== result.barcode.trim())) {
      throw new SavedAnalysisError(409, "identity_mismatch", "The analyzed brand and product must match this saved item exactly.");
    }
    const history = meta.previousAnalysisSnapshots ?? [];
    if (!Array.isArray(history) || (meta.analysisSnapshot && history.length >= 10)) {
      throw new SavedAnalysisError(409, "history_full", "Previous analysis history cannot be replaced. Existing information is unchanged.");
    }
    const productMeta = {
      ...meta,
      ...(meta.analysisSnapshot ? { previousAnalysisSnapshots: [...history, meta.analysisSnapshot] } : {}),
      analysisSnapshotVersion: 1,
      analysisSnapshot: result,
      analysisSavedAt: new Date().toISOString(),
    };
    // Do not copy ingredients, certification, status, source or nutrition out of the snapshot.
    return { value: { ...row, productMeta }, productMeta };
  });
}

function fingerprint(row: SavedAnalysisRow) {
  const { analysisRequest: _operation, ...meta } = row.productMeta ?? {};
  return createHash("sha256").update(JSON.stringify([
    row.productName, row.brand, row.barcode, row.productKey, row.source, meta, row.nutritionJson,
  ])).digest("hex");
}

export function createSavedGroceryAnalyzer(store: SavedAnalysisStore, analyze: (name: string, owner: string) => Promise<IngredientScanResult>) {
  return async (owner: string, id: string, input: { requestId?: string; expectedRevision?: string }) => {
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId ?? "") || !/^[a-f0-9]{64}$/.test(input.expectedRevision ?? "")) {
      throw new SavedAnalysisError(400, "invalid_request", "Reopen this saved product before requesting analysis.");
    }
    const requestId = input.requestId!;
    const claim = await store.withItem<{ reused: boolean; item: SavedAnalysisRow; fingerprint: string }>(owner, id, row => {
      if (!row) throw new SavedAnalysisError(404, "not_found", "Saved product not found for this account.");
      const meta = row.productMeta ?? {};
      if (meta.subjectKind === "companion") throw new SavedAnalysisError(409, "companion_record", "Use the companion analysis experience for this product.");
      if (completeSavedAnalysis(meta)) return { value: { reused: true as const, item: row, fingerprint: "" } };
      if (meta.analysisRequest?.state === "running") {
        throw new SavedAnalysisError(409, "analysis_in_progress", "Analysis is already in progress. Reopen this product to check its saved result.");
      }
      if (meta.analysisRequest?.requestId === requestId) {
        throw new SavedAnalysisError(409, "previous_request_failed", "This request did not complete. Reopen the product before explicitly trying again.");
      }
      if (input.expectedRevision !== savedEvidenceRevision(row)) throw new SavedAnalysisError(409, "stale_record", "This saved product changed. Reopen it before requesting analysis.");
      const recommendation = Array.isArray(meta.recommendationWhyBetter) || typeof meta.recommendationTargetCriteria === "string" ||
        (typeof meta.reason === "string" && !meta.alignmentGrade && meta.analysisMethod !== "by_label");
      if (!recommendation) throw new SavedAnalysisError(409, "not_recommendation", "This action is for saved recommendations without a complete analysis.");
      const productMeta = { ...meta, analysisRequest: { requestId, state: "running", startedAt: new Date().toISOString() } };
      return { value: { reused: false as const, item: row, fingerprint: fingerprint(row) }, productMeta };
    });
    if (claim.reused) return { item: claim.item, reused: true };
    const name = claim.item.brand && !claim.item.productName.toLowerCase().startsWith(claim.item.brand.toLowerCase())
      ? `${claim.item.brand} ${claim.item.productName}` : claim.item.productName;
    let generated = false;
    try {
      const result = await analyze(name, owner);
      if (result.fallbackUsed || !completeSavedAnalysis({ analysisSnapshot: result }) || JSON.stringify(result).length > 80000) {
        throw new SavedAnalysisError(422, "analysis_unavailable", "A reliable analysis could not be generated. Your saved recommendation is unchanged.");
      }
      generated = true;
      const item = await store.withItem(owner, id, row => {
        if (!row) throw new SavedAnalysisError(404, "not_found", "This product was deleted. It has not been recreated.");
        const meta = row.productMeta ?? {};
        if (meta.analysisRequest?.requestId !== requestId || meta.analysisRequest?.state !== "running" || fingerprint(row) !== claim.fingerprint) {
          throw new SavedAnalysisError(409, "stale_record", "The saved product changed during analysis. Its existing information was not overwritten.");
        }
        const productMeta = {
          ...meta,
          ...(meta.analysisSnapshot ? { previousAnalysisSnapshots: [...(meta.previousAnalysisSnapshots ?? []), meta.analysisSnapshot] } : {}),
          analysisSnapshotVersion: 1,
          analysisSnapshot: { ...result, productName: name },
          analysisSavedAt: new Date().toISOString(),
          analysisRequest: { ...meta.analysisRequest, state: "completed" },
        };
        return { value: { ...row, productMeta }, productMeta };
      });
      return { item, reused: false };
    } catch (error) {
      // Never release an ambiguous post-generation persistence failure: the
      // durable running marker blocks another paid call until explicitly recovered.
      if (!generated || error instanceof SavedAnalysisError) {
        try {
          await store.withItem(owner, id, row => {
            if (!row || row.productMeta?.analysisRequest?.requestId !== requestId ||
                row.productMeta.analysisRequest.state !== "running") return { value: undefined };
            return { value: undefined, productMeta: { ...row.productMeta,
              analysisRequest: { ...row.productMeta.analysisRequest, state: "failed" } } };
          });
        } catch { /* The running marker must remain fail-closed if cleanup cannot persist. */ }
      }
      if (error instanceof SavedAnalysisError) throw error;
      throw new SavedAnalysisError(503, generated ? "persistence_uncertain" : "analysis_unavailable",
        generated ? "Analysis finished, but saving could not be confirmed. Reopen this product; do not start another analysis."
          : "Analysis could not be completed. Your saved recommendation is unchanged.");
    }
  };
}
