import { Capacitor } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  
  // Primary detection: Use Capacitor's reliable native platform detection
  // This is the most reliable method and works correctly during Apple App Review
  if (Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === "ios") {
    return true;
  }
  
  // Fallback detection for edge cases (e.g., Capacitor not fully initialized)
  const ua = window.navigator.userAgent ?? "";
  const isiOSDevice = /iphone|ipad|ipod/i.test(ua);
  
  const hasStandalone = (window.navigator as any).standalone === true;
  const hasWebkitBridge = typeof (window as any).webkit?.messageHandlers?.mpmNativeBridge !== "undefined";
  const brandedUA = ua.includes("MyPerfectMealsApp");
  
  return isiOSDevice && (hasStandalone || hasWebkitBridge || brandedUA);
}

export const IOS_PAYMENT_MESSAGE = {
  title: "Subscription Required",
  description: "This feature requires a subscription. Tap 'Subscribe' to view available plans in the App Store."
};

// Deep-link to Apple's subscription management
export async function openAppleSubscriptions(): Promise<void> {
  const subscriptionUrl = "itms-apps://apps.apple.com/account/subscriptions";
  
  if (isIosNativeShell()) {
    try {
      // Dynamically import AppLauncher to avoid bundling issues on web
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url: subscriptionUrl });
    } catch (e) {
      console.error("[Platform] Failed to open Apple subscriptions:", e);
      // Fallback: try window.location for older Capacitor versions
      if (typeof window !== "undefined") {
        window.location.href = subscriptionUrl;
      }
    }
  } else if (typeof window !== "undefined") {
    // Web fallback - open App Store subscriptions page
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
  }
}
