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
  title: "In-App Purchases Coming Soon",
  description: "Subscriptions will be available through the App Store in a future update. Please visit myperfectmeals.com on the web to manage your subscription."
};
