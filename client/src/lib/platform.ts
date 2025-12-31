import { Capacitor } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  
  // Primary check: Capacitor's native platform detection
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    return true;
  }
  
  // Fallback checks for edge cases
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
