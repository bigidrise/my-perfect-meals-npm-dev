const PURCHASE_REQUIRED_KEY = "mpm_purchase_required";

type PurchaseRequiredStorage = Pick<Storage, "setItem" | "removeItem">;

export function syncPurchaseRequiredFlag(
  required: boolean,
  storage: PurchaseRequiredStorage = window.localStorage,
): void {
  if (required) {
    storage.setItem(PURCHASE_REQUIRED_KEY, "true");
    return;
  }

  storage.removeItem(PURCHASE_REQUIRED_KEY);
}