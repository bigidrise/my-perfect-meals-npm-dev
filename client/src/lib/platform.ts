import { Capacitor } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  
  // PRIMARY CHECK: Capacitor reports iOS platform
  // This is the most reliable check when running in Capacitor shell
  try {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    
    if (platform === "ios" && isNative) {
      return true;
    }
  } catch (e) {
    // Capacitor not available, fall through to heuristics
  }
  
  // FALLBACK: UA-based heuristics for edge cases
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
