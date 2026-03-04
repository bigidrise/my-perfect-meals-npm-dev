import type { LookupKey } from "@/data/planSkus";
import { isIosNativeShell } from "@/lib/platform";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  purchaseProduct as iosPurchase,
  isStoreKitAvailable,
} from "@/lib/storekit";

export const IOS_BLOCK_ERROR = "IOS_APP_EXTERNAL_PAYMENTS_BLOCKED";

export interface CheckoutOptions {
  customerEmail?: string;
  context?: string;
}

function getCurrentUser() {
  try {
    const raw =
      localStorage.getItem("mpm_current_user") || localStorage.getItem("user");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (err) {
    console.error("[Checkout] Failed to parse user from localStorage", err);
    return null;
  }
}

export async function startCheckout(
  priceLookupKey: LookupKey,
  opts?: CheckoutOptions,
) {
  // iOS native shell handling
  if (isIosNativeShell()) {
    try {
      const storeKitAvailable = await isStoreKitAvailable();

      if (storeKitAvailable) {
        const result = await iosPurchase(priceLookupKey);

        if (!result.success) {
          throw new Error(result.error || "Purchase failed");
        }

        return { success: true, method: "storekit" };
      }
    } catch (storeKitError: any) {
      console.error("[Checkout] StoreKit error:", storeKitError);

      throw new Error(
        storeKitError?.message ||
          "In-app purchase temporarily unavailable. Please try again.",
      );
    }

    const error = new Error(
      "Stripe checkout is unavailable inside the iOS app.",
    );
    (error as any).code = IOS_BLOCK_ERROR;
    throw error;
  }

  try {
    const user = getCurrentUser();

    if (!user?.id) {
      throw new Error("Please log in to checkout");
    }

    const response = await fetch(apiUrl("/api/stripe/checkout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        priceLookupKey,
        context: opts?.context || "unknown",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Checkout failed");
    }

    if (!data?.url) {
      throw new Error("Checkout session did not return a URL");
    }

    const checkoutUrl = data.url;

    // handle iframe vs top window safely
    if (window.self !== window.top) {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(checkoutUrl);
    }
  } catch (error) {
    console.error("[Checkout Error]", error);
    throw error;
  }
}

export async function openCustomerPortal(
  customerId: string,
  returnUrl?: string,
) {
  if (isIosNativeShell()) {
    const error = new Error(
      "Customer portal is unavailable inside the iOS app.",
    );
    (error as any).code = IOS_BLOCK_ERROR;
    throw error;
  }

  try {
    const response = await fetch(apiUrl("/api/stripe/create-portal-session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId,
        returnUrl: returnUrl || window.location.href,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Portal failed");
    }

    if (!data?.url) {
      throw new Error("Portal session did not return a URL");
    }

    const portalUrl = data.url;

    if (window.self !== window.top) {
      window.open(portalUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(portalUrl);
    }
  } catch (error) {
    console.error("[Portal Error]", error);
    throw error;
  }
}
