import { Capacitor, registerPlugin } from "@capacitor/core";

export function isIosNativeShell(): boolean {
  if (typeof window === "undefined") return false;

  if (Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === "ios") {
    return true;
  }

  const ua = window.navigator.userAgent ?? "";
  const isiOSDevice = /iphone|ipad|ipod/i.test(ua);

  const hasStandalone = (window.navigator as any).standalone === true;
  const hasWebkitBridge =
    typeof (window as any).webkit?.messageHandlers?.mpmNativeBridge !==
    "undefined";
  const brandedUA = ua.includes("MyPerfectMealsApp");

  return isiOSDevice && (hasStandalone || hasWebkitBridge || brandedUA);
}

export const IOS_PAYMENT_MESSAGE = {
  title: "Subscription Required",
  description:
    "This feature requires a subscription. Tap 'Subscribe' to view available plans in the App Store.",
};

// Open Apple subscription management in the most reliable way.
// Order:
// 1) Subscriptions plugin (manageSubscriptions) if available
// 2) AppLauncher openUrl with itms-apps scheme
// 3) Web fallback
export async function openAppleSubscriptions(): Promise<void> {
  const httpsUrl = "https://apps.apple.com/account/subscriptions";
  const itmsUrl = "itms-apps://apps.apple.com/account/subscriptions";

  if (!isIosNativeShell()) {
    if (typeof window !== "undefined") window.open(httpsUrl, "_blank");
    return;
  }

  // 1) Preferred: Subscriptions plugin (this avoids the UNIMPLEMENTED you saw)
  try {
    const Subscriptions: any = registerPlugin("Subscriptions");
    if (Subscriptions?.manageSubscriptions) {
      await Subscriptions.manageSubscriptions();
      return;
    }
  } catch (e) {
    console.warn(
      "[Platform] Subscriptions plugin manageSubscriptions not available:",
      e,
    );
  }

  // 2) Fallback: AppLauncher
  try {
    const { AppLauncher } = await import("@capacitor/app-launcher");
    await AppLauncher.openUrl({ url: itmsUrl });
    return;
  } catch (e) {
    console.warn("[Platform] AppLauncher openUrl failed:", e);
  }

  // 3) Last resort: open the web page
  try {
    if (typeof window !== "undefined") {
      window.open(httpsUrl, "_blank");
      return;
    }
  } catch (e) {
    console.error("[Platform] Final fallback failed:", e);
  }

  // If we got here, everything failed
  throw new Error("Unable to open Apple Subscriptions on this device.");
}
