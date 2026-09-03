import { isIosNativeShell } from "@/lib/platform";
import {
  IOS_PRODUCT_IDS,
  getIosProductByInternalSku,
  iosProductIdToInternalSku,
} from "@/lib/iosProducts";
import type { LookupKey } from "@/data/planSkus";
import { apiUrl } from "@/lib/resolveApiBase";
import { Subscriptions } from "@squareetlabs/capacitor-subscriptions";

function getPlugin(): any | null {
  if (!isIosNativeShell()) {
    return null;
  }
  return Subscriptions;
}

export interface StoreKitProduct {
  productId: string;
  displayName: string;
  displayPrice: string;
  price: number;
  description: string;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

export async function isStoreKitAvailable(): Promise<boolean> {
  if (!isIosNativeShell()) return false;
  try {
    const plugin = getPlugin();
    return plugin !== null;
  } catch (e) {
    console.warn("[StoreKit] isStoreKitAvailable check failed:", e);
    return false;
  }
}

export async function fetchProducts(): Promise<StoreKitProduct[]> {
  const plugin = getPlugin();
  if (!plugin) {
    console.log("[StoreKit] Not available, returning empty products");
    return [];
  }

  try {
    const products: StoreKitProduct[] = [];
    
    for (const productId of IOS_PRODUCT_IDS) {
      try {
        console.log("[StoreKit] Fetching product:", productId);
        const result = await plugin.getProductDetails({ productIdentifier: productId });
        console.log("[StoreKit] getProductDetails result:", JSON.stringify(result));

        if (result && result.responseCode === 0 && result.data) {
          const product = result.data;
          products.push({
            productId: product.productIdentifier || productId,
            displayName: product.displayName || productId,
            displayPrice: product.price || "$0.00",
            price: parseFloat(product.price) || 0,
            description: product.description || "",
          });
        } else {
          console.warn(`[StoreKit] Product ${productId} not found: code=${result?.responseCode}, msg=${result?.responseMessage}`);
        }
      } catch (e) {
        console.warn(`[StoreKit] Failed to fetch product ${productId}:`, e);
      }
    }

    console.log("[StoreKit] Total products loaded:", products.length);
    return products;
  } catch (e) {
    console.error("[StoreKit] Failed to fetch products:", e);
    return [];
  }
}

export async function purchaseProduct(
  internalSku: LookupKey
): Promise<PurchaseResult> {
  let plugin;
  try {
    plugin = getPlugin();
  } catch (e: any) {
    console.error("[StoreKit] Failed to initialize plugin:", e);
    return { success: false, error: "In-app purchases temporarily unavailable. Please try again later." };
  }

  if (!plugin) {
    return { success: false, error: "In-app purchases not available on this device." };
  }

  const iosProduct = getIosProductByInternalSku(internalSku);
  if (!iosProduct) {
    return { success: false, error: `No iOS product for SKU: ${internalSku}` };
  }

  try {
    console.log("[StoreKit] Initiating purchase for:", iosProduct.productId);

    const purchaseResult = await plugin.purchaseProduct({
      productIdentifier: iosProduct.productId,
    });

    console.log("[StoreKit] Purchase result:", JSON.stringify(purchaseResult));

    if (purchaseResult.responseCode !== 0) {
      if (purchaseResult.responseCode === 3) {
        return { success: false, error: "Purchase cancelled" };
      }
      return { success: false, error: purchaseResult.responseMessage || "Purchase failed" };
    }

    let transactionId = `tx_${Date.now()}`;
    try {
      const latestTx = await plugin.getLatestTransaction({
        productIdentifier: iosProduct.productId,
      });
      console.log("[StoreKit] Latest transaction:", JSON.stringify(latestTx));
      if (latestTx.responseCode === 0 && latestTx.data) {
        transactionId = latestTx.data.transactionId || latestTx.data.originalId || transactionId;
      }
    } catch (txError) {
      console.warn("[StoreKit] Failed to get transaction, using fallback:", txError);
    }

    console.log("[StoreKit] Purchase successful:", transactionId);

    await verifyAndActivate(transactionId, iosProduct.productId);

    return {
      success: true,
      productId: iosProduct.productId,
      transactionId,
    };
  } catch (e: any) {
    console.error("[StoreKit] Purchase failed:", e);

    if (e.message?.includes("cancelled") || e.code === "PAYMENT_CANCELLED") {
      return { success: false, error: "Purchase cancelled" };
    }

    return { success: false, error: e.message || "Purchase failed. Please try again." };
  }
}

function isSubscriptionActive(txData: any): boolean {
  const expiryRaw = txData.expiryDate || txData.expirationDate || txData.expiresDate;
  console.log("[StoreKit] Checking expiry:", expiryRaw, "type:", typeof expiryRaw);

  if (expiryRaw) {
    let expiresMs: number;
    if (typeof expiryRaw === "number") {
      expiresMs = expiryRaw;
    } else if (typeof expiryRaw === "string") {
      expiresMs = Date.parse(expiryRaw);
    } else if (expiryRaw instanceof Date) {
      expiresMs = expiryRaw.getTime();
    } else {
      expiresMs = Number(expiryRaw);
    }

    if (!isNaN(expiresMs)) {
      const now = Date.now();
      console.log("[StoreKit] Expiry ms:", expiresMs, "Now:", now, "Active:", expiresMs > now);
      if (expiresMs < now) {
        return false;
      }
    }
  }

  if (txData.revocationDate || txData.isRevoked) {
    console.log("[StoreKit] Subscription revoked");
    return false;
  }

  return true;
}

export async function restorePurchases(): Promise<PurchaseResult[]> {
  const plugin = getPlugin();
  if (!plugin) {
    return [];
  }

  const results: PurchaseResult[] = [];

  for (const productId of IOS_PRODUCT_IDS) {
    try {
      console.log("[StoreKit] Checking restore for:", productId);
      const latestTx = await plugin.getLatestTransaction({
        productIdentifier: productId,
      });
      console.log("[StoreKit] Restore tx result:", productId, "code:", latestTx?.responseCode, "data:", JSON.stringify(latestTx?.data));

      if (latestTx && latestTx.responseCode === 0 && latestTx.data) {
        const txData = latestTx.data;

        if (!isSubscriptionActive(txData)) {
          console.log("[StoreKit] Subscription not active for:", productId);
          continue;
        }

        const transactionId = String(txData.transactionId || txData.originalId || `restore_${Date.now()}`);
        try {
          await verifyAndActivate(transactionId, productId);
          results.push({ success: true, productId, transactionId });
        } catch (e: any) {
          console.warn("[StoreKit] Restore verify failed for:", productId, e.message);
          results.push({ success: false, productId, error: e.message });
        }
      } else {
        console.log("[StoreKit] No transaction found for:", productId, "code:", latestTx?.responseCode);
      }
    } catch (e: any) {
      console.warn("[StoreKit] Restore check failed for:", productId, e.message);
    }
  }

  if (results.length === 0) {
    console.log("[StoreKit] No purchases to restore");
  }

  return results;
}

export async function getCurrentEntitlements(): Promise<string[]> {
  const plugin = getPlugin();
  if (!plugin) {
    return [];
  }

  const entitled: string[] = [];

  for (const productId of IOS_PRODUCT_IDS) {
    try {
      const latestTx = await plugin.getLatestTransaction({
        productIdentifier: productId,
      });
      if (latestTx && latestTx.responseCode === 0 && latestTx.data) {
        if (isSubscriptionActive(latestTx.data)) {
          entitled.push(productId);
        }
      }
    } catch (e) {
      console.warn("[StoreKit] Entitlement check failed for:", productId);
    }
  }

  console.log("[StoreKit] Current entitlements:", entitled);
  return entitled;
}

export async function manageSubscriptions(): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) {
    console.warn("[StoreKit] Plugin not available for manageSubscriptions");
    return;
  }

  try {
    await plugin.manageSubscriptions();
  } catch (e) {
    console.error("[StoreKit] Failed to open manage subscriptions:", e);
    throw e;
  }
}

async function verifyAndActivate(
  transactionId: string,
  productId: string
): Promise<void> {
  const userStr = localStorage.getItem("mpm_current_user");
  let existingUser: Record<string, any> | null = null;
  try {
    existingUser = userStr ? JSON.parse(userStr) : null;
  } catch {
    existingUser = null;
  }

  if (!existingUser?.id) {
    throw new Error("User not logged in");
  }

  const internalSku = iosProductIdToInternalSku(productId);
  if (!internalSku) {
    throw new Error(`Unknown product: ${productId}`);
  }

  console.log("[StoreKit] Verifying with server:", { userId: existingUser.id, transactionId, productId, internalSku });

  // x-auth-token is required — requireAuth is enforced on this endpoint.
  // On native iOS, cookie-based sessions are unreliable, so the header is essential.
  const authToken = localStorage.getItem("mpm_auth_token") || "";
  if (!authToken) {
    throw new Error("No auth token — please sign in again before purchasing.");
  }

  const response = await fetch(apiUrl("/api/ios/verify-purchase"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": authToken,
    },
    credentials: "include",
    body: JSON.stringify({
      userId: existingUser.id,
      transactionId,
      productId,
      internalSku,
    }),
  });

  if (!response.ok) {
    let errorMsg = "Verification failed";
    try {
      const error = await response.json();
      errorMsg = error.error || errorMsg;
    } catch {
      errorMsg = `Verification failed (HTTP ${response.status})`;
    }
    throw new Error(errorMsg);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from server");
  }

  console.log("[StoreKit] Verification successful:", JSON.stringify(data));

  if (data.user) {
    const mergedUser = { ...existingUser, ...data.user };
    localStorage.setItem("mpm_current_user", JSON.stringify(mergedUser));
    window.dispatchEvent(new Event("mpm:user-updated"));
  }
}
