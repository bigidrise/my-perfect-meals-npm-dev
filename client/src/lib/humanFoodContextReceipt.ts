type ReceiptMeta = {
  receipt?: string;
  generationChainId?: string;
  expiresAt?: string;
};

type StoredReceipt = Required<ReceiptMeta> & { signature: string };

const receiptChains = new Map<string, StoredReceipt>();

export function getHumanFoodContextRetryFields(
  creator: string,
  signature: string,
): Record<string, string> {
  const stored = receiptChains.get(creator);
  if (!stored || stored.signature !== signature || Date.parse(stored.expiresAt) <= Date.now()) {
    receiptChains.delete(creator);
    return {};
  }
  return {
    humanFoodContextReceipt: stored.receipt,
    humanFoodGenerationChainId: stored.generationChainId,
  };
}

export function rememberHumanFoodContextReceipt(
  creator: string,
  signature: string,
  meta: ReceiptMeta | null | undefined,
): void {
  if (!meta?.receipt || !meta.generationChainId || !meta.expiresAt) return;
  receiptChains.set(creator, {
    signature,
    receipt: meta.receipt,
    generationChainId: meta.generationChainId,
    expiresAt: meta.expiresAt,
  });
}
