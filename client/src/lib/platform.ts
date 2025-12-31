import { Capacitor } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const windowCapacitor = (window as any).Capacitor;
  
  // Log for debugging on device
  console.log("[Platform] Detection:", {
    platform,
    isNative,
    windowCapacitorPlatform: windowCapacitor?.platform,
    windowCapacitorIsNative: windowCapacitor?.isNativePlatform?.(),
  });
  
  // Primary check: Capacitor reports iOS platform (works even when isNativePlatform is false)
  if (platform === "ios") {
    console.log("[Platform] Detected iOS via Capacitor.getPlatform()");
    return true;
  }
  
  // Secondary check: window.Capacitor bridge (for remote bundle scenarios)
  if (windowCapacitor?.platform === "ios") {
    console.log("[Platform] Detected iOS via window.Capacitor.platform");
    return true;
  }
  
  // Fallback checks for edge cases
  const ua = window.navigator.userAgent ?? "";
  const isiOSDevice = /iphone|ipad|ipod/i.test(ua);
  
  const hasStandalone = (window.navigator as any).standalone === true;
  const hasWebkitBridge = typeof (window as any).webkit?.messageHandlers?.mpmNativeBridge !== "undefined";
  const brandedUA = ua.includes("MyPerfectMealsApp");
  
  const fallbackResult = isiOSDevice && (hasStandalone || hasWebkitBridge || brandedUA);
  if (fallbackResult) {
    console.log("[Platform] Detected iOS via fallback checks");
  }
  
  return fallbackResult;
}

export const IOS_PAYMENT_MESSAGE = {
  title: "In-App Purchases Coming Soon",
  description: "Subscriptions will be available through the App Store in a future update. Please visit myperfectmeals.com on the web to manage your subscription."
};
