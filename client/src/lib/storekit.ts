import { isIosNativeShell } from "@/lib/platform";
import {
  IOS_PRODUCT_IDS,
  getIosProductByInternalSku,
  iosProductIdToInternalSku,
} from "@/lib/iosProducts";
import type { LookupKey } from "@/data/planSkus";
import { apiUrl } from "@/lib/resolveApiBase";

let SubscriptionsPlugin: any = null;

async function getPlugin() {
  console.log("[StoreKit] getPlugin called");
  
  if (!isIosNativeShell()) {
    console.log("[StoreKit] Not in iOS native shell, skipping plugin load");
    return null;
  }
  
  if (!SubscriptionsPlugin) {
    try {
      console.log("[StoreKit] Loading capacitor-subscriptions plugin...");
      const mod = await import("@squareetlabs/capacitor-subscriptions");
      console.log("[StoreKit] Plugin module loaded:", Object.keys(mod));
      SubscriptionsPlugin = mod.Subscriptions;
      console.log("[StoreKit] Subscriptions plugin:", SubscriptionsPlugin ? "loaded" : "null");
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
  const plugin = await getPlugin();
  return plugin !== null;
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
        const product = await plugin.getProductDetails({ productId });
        if (product) {
          products.push({
            productId: product.id || productId,
            displayName: product.displayName || product.title || productId,
            displayPrice: product.displayPrice || product.price || "$0.00",
            price: parseFloat(product.price) || 0,
            description: product.description || "",
          });
        }
      } catch (e) {
        console.warn(`[StoreKit] Failed to fetch product ${productId}:`, e);
      }
    }

    return products;
  } catch (e) {
    console.error("[StoreKit] Failed to fetch products:", e);
    return [];
  }
}

export async function purchaseProduct(
  internalSku: LookupKey
): Promise<PurchaseResult> {
  const plugin = await getPlugin();
  if (!plugin) {
    return { success: false, error: "StoreKit not available" };
  }

  const iosProduct = getIosProductByInternalSku(internalSku);
  if (!iosProduct) {
    return { success: false, error: `No iOS product for SKU: ${internalSku}` };
  }

  try {
    console.log("[StoreKit] Initiating purchase for:", iosProduct.productId);

    await plugin.purchaseProduct({
      productId: iosProduct.productId,
    });

    const transaction = await plugin.getMostRecentTransaction();
    const transactionId = transaction?.transactionId || transaction?.id || `tx_${Date.now()}`;

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

    return { success: false, error: e.message || "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult[]> {
  const plugin = await getPlugin();
  if (!plugin) {
    return [];
  }

  try {
    const entitlements = await plugin.getCurrentEntitlements();

    if (!entitlements || entitlements.length === 0) {
      console.log("[StoreKit] No purchases to restore");
      return [];
    }

    const results: PurchaseResult[] = [];

    for (const ent of entitlements) {
      const productId = ent.productId || ent.id;
      const transactionId = ent.transactionId || ent.id || `restore_${Date.now()}`;

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
    const entitlements = await plugin.getCurrentEntitlements();

    if (!entitlements || entitlements.length === 0) {
      return [];
    }

    return entitlements.map((e: any) => e.productId || e.id);
  } catch (e) {
    console.error("[StoreKit] Failed to get entitlements:", e);
    return [];
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
