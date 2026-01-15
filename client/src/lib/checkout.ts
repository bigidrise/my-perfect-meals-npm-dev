import type { LookupKey } from "@/data/planSkus";
import { isIosNativeShell } from "@/lib/platform";
import { apiUrl } from '@/lib/resolveApiBase';

export const IOS_BLOCK_ERROR = "IOS_APP_EXTERNAL_PAYMENTS_BLOCKED";

export interface CheckoutOptions {
  customerEmail?: string;
  context?: string;
}

export async function startCheckout(
  priceLookupKey: LookupKey,
  opts?: CheckoutOptions
) {
  if (isIosNativeShell()) {
    const error = new Error("Stripe checkout is unavailable inside the iOS app.");
    (error as any).code = IOS_BLOCK_ERROR;
    throw error;
  }

  try {
    // Get current user for security validation
    const userStr = localStorage.getItem("mpm_current_user");
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user?.id) {
      throw new Error("Please log in to checkout");
    }

    const res = await fetch(apiUrl("/api/stripe/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceLookupKey,
        customerEmail: opts?.customerEmail || user.email,
        metadata: { 
          context: opts?.context || "unknown",
          user_id: user.id,
        },
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Checkout failed");
    }

    const { url } = await res.json();
    
    // Check if we're in an iframe (Replit dev environment)
    if (window.self !== window.top) {
      // In iframe - open in new tab to bypass iframe restrictions
      window.open(url, '_blank');
    } else {
      // Not in iframe - redirect normally
      window.location.href = url;
    }
  } catch (error) {
    console.error("[Checkout Error]", error);
    throw error;
  }
}

export async function openCustomerPortal(customerId: string, returnUrl?: string) {
  if (isIosNativeShell()) {
    const error = new Error("Customer portal is unavailable inside the iOS app.");
    (error as any).code = IOS_BLOCK_ERROR;
    throw error;
  }

  try {
    const res = await fetch(apiUrl("/api/stripe/create-portal-session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        returnUrl: returnUrl || window.location.href,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Portal failed");
    }

    const { url } = await res.json();
    
    // Check if we're in an iframe (Replit dev environment)
    if (window.self !== window.top) {
      // In iframe - open in new tab to bypass iframe restrictions
      window.open(url, '_blank');
    } else {
      // Not in iframe - redirect normally
      window.location.href = url;
    }
  } catch (error) {
    console.error("[Portal Error]", error);
    throw error;
  }
}