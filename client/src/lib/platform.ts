import { Capacitor } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  
  // PRIMARY CHECK: Capacitor reports iOS platform
  // This is the most reliable check when running in Capacitor shell
  try {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    
    console.log("[Platform] Capacitor check:", { platform, isNative });
    
    if (platform === "ios" && isNative) {
      console.log("[Platform] Detected iOS via Capacitor - returning TRUE");
      return true;
    }
  } catch (e) {
    console.warn("[Platform] Capacitor check failed:", e);
  }
  
  // FALLBACK: UA-based heuristics for edge cases
  const ua = window.navigator.userAgent ?? "";
  const isiOSDevice = /iphone|ipad|ipod/i.test(ua);
  
  const hasStandalone = (window.navigator as any).standalone === true;
  const hasWebkitBridge = typeof (window as any).webkit?.messageHandlers?.mpmNativeBridge !== "undefined";
  const brandedUA = ua.includes("MyPerfectMealsApp");
  
  const fallbackResult = isiOSDevice && (hasStandalone || hasWebkitBridge || brandedUA);
  
  console.log("[Platform] Fallback check:", { isiOSDevice, hasStandalone, hasWebkitBridge, brandedUA, fallbackResult });
  
  return fallbackResult;
}

export const IOS_PAYMENT_MESSAGE = {
  title: "In-App Purchases Coming Soon",
  description: "Subscriptions will be available through the App Store in a future update. Please visit myperfectmeals.com on the web to manage your subscription."
};
