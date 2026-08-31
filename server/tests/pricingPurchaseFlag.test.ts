import { syncPurchaseRequiredFlag } from "../../client/src/lib/purchaseRequired";

describe("pricing purchase-required flag", () => {
  const storage = {
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears stale purchase-required state on a normal pricing visit", () => {
    syncPurchaseRequiredFlag(false, storage);

    expect(storage.removeItem).toHaveBeenCalledWith("mpm_purchase_required");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("keeps purchase-required state only for the explicit required flow", () => {
    syncPurchaseRequiredFlag(true, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      "mpm_purchase_required",
      "true",
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});