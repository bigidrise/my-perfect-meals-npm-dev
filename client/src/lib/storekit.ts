import { isIosNativeShell } from "@/lib/platform";
import {
  IOS_PRODUCT_IDS,
  getIosProductByInternalSku,
  iosProductIdToInternalSku,
} from "@/lib/iosProducts";
import type { LookupKey } from "@/data/planSkus";
import { apiUrl } from "@/lib/resolveApiBase";
import { registerPlugin } from "@capacitor/core";

let SubscriptionsPlugin: any = null;

async function getPlugin() {
  if (!isIosNativeShell()) {
    return null;
  }
  if (!SubscriptionsPlugin) {
    try {
      SubscriptionsPlugin = registerPlugin('Subscriptions');
    } catch (e) {
      console.warn("[StoreKit] Failed to load plugin:", e);
      return null;
    }
  }
  return SubscriptionsPlugin;
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
    const plugin = await getPlugin();
    return plugin !== null;
  } catch (e) {
    console.warn("[StoreKit] isStoreKitAvailable check failed:", e);
    return false;
  }
}

export async function fetchProducts(): Promise<StoreKitProduct[]> {
  const plugin = await getPlugin();
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
    plugin = await getPlugin();
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

export async function restorePurchases(): Promise<PurchaseResult[]> {
  const plugin = await getPlugin();
  if (!plugin) {
    return [];
  }

  try {
    const result = await plugin.getCurrentEntitlements();
    console.log("[StoreKit] Entitlements result:", JSON.stringify(result));

    if (!result || result.responseCode !== 0 || !result.data || result.data.length === 0) {
      console.log("[StoreKit] No purchases to restore");
      return [];
    }

    const results: PurchaseResult[] = [];

    for (const ent of result.data) {
      const productId = ent.productIdentifier;
      const transactionId = ent.transactionId || ent.originalId || `restore_${Date.now()}`;

      try {
        await verifyAndActivate(transactionId, productId);
        results.push({
          success: true,
          productId,
          transactionId,
        });
      } catch (e: any) {
        results.push({
          success: false,
          productId,
          error: e.message,
        });
      }
    }

    return results;
  } catch (e: any) {
    console.error("[StoreKit] Restore failed:", e);
    return [{ success: false, error: e.message }];
  }
}

export async function getCurrentEntitlements(): Promise<string[]> {
  const plugin = await getPlugin();
  if (!plugin) {
    return [];
  }

  try {
    const result = await plugin.getCurrentEntitlements();
    console.log("[StoreKit] getCurrentEntitlements result:", JSON.stringify(result));

    if (!result || result.responseCode !== 0 || !result.data || result.data.length === 0) {
      return [];
    }

    return result.data.map((e: any) => e.productIdentifier);
  } catch (e) {
    console.error("[StoreKit] Failed to get entitlements:", e);
    return [];
  }
}

export async function manageSubscriptions(): Promise<void> {
  const plugin = await getPlugin();
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
  const user = userStr ? JSON.parse(userStr) : null;

  if (!user?.id) {
    throw new Error("User not logged in");
  }

  const internalSku = iosProductIdToInternalSku(productId);
  if (!internalSku) {
    throw new Error(`Unknown product: ${productId}`);
  }

  const response = await fetch(apiUrl("/api/ios/verify-purchase"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      transactionId,
      productId,
      internalSku,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Verification failed");
  }

  const data = await response.json();
  console.log("[StoreKit] Verification successful:", data);

  if (data.user) {
    localStorage.setItem("mpm_current_user", JSON.stringify(data.user));
    window.dispatchEvent(new Event("mpm:user-updated"));
  }
}
