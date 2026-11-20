import type { ProductEvidenceAdapter } from "./productEvidenceAdapters";

export type ShoppingLookupStage = "profile" | "catalogSearch" | "exactRecordWork" | "enrichment";
export type ShoppingStageTimer = (stage: ShoppingLookupStage, milliseconds: number) => void;

/**
 * Request-local transport optimization only. Never changes source records,
 * eligibility, or identity checks. At most two exact reads run concurrently.
 */
export function shoppingEvidenceAdapter(adapter: ProductEvidenceAdapter, timer?: ShoppingStageTimer) {
  type ReadResult = { record: Awaited<ReturnType<ProductEvidenceAdapter["read"]>> } | { error: unknown };
  const reads = new Map<string, Promise<ReadResult>>();
  let references: Awaited<ReturnType<ProductEvidenceAdapter["search"]>>["references"] = [];
  let next = 0;
  const timed = async <T>(stage: ShoppingLookupStage, operation: () => Promise<T>) => {
    const started = performance.now();
    try { return await operation(); }
    finally { timer?.(stage, performance.now() - started); }
  };
  const startRead = (reference: typeof references[number]) => {
    if (!reads.has(reference.sourceRecordId)) {
      reads.set(reference.sourceRecordId, timed("exactRecordWork", () => adapter.read(reference))
        .then(record => ({ record }), error => ({ error })));
    }
  };
  const wrapped: ProductEvidenceAdapter = {
    source: adapter.source,
    async search(intent, cursor, limit) {
      const page = await timed("catalogSearch", () => adapter.search(intent, cursor, Math.min(limit, 3)));
      references = page.references.slice(0, Math.min(limit, 3));
      next = 0;
      return { ...page, references };
    },
    async read(reference) {
      if (!reads.has(reference.sourceRecordId)) {
        // Prefetch one small batch, not the entire provider result set.
        for (const ref of references.slice(next, next + 2)) startRead(ref);
        next += 2;
        startRead(reference);
      }
      const result = await reads.get(reference.sourceRecordId)!;
      if ("error" in result) throw result.error;
      return result.record;
    },
    ...(adapter.enrich ? {
      enrich: (reference, record) => timed("enrichment", () => adapter.enrich!(reference, record)),
    } : {}),
  };
  return { adapter: wrapped, drain: () => Promise.all(reads.values()) };
}
