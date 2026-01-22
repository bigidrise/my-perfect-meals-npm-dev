/**
 * Bootstrap Entry Point
 * Production-safe: web + iOS
 */

import { Capacitor } from "@capacitor/core";
import { patchFetchForCredentials } from "@/lib/fetch-credentials-patch";

/**
 * Safely hides the native splash screen.
 * - No-op on web
 * - Dynamically imported on iOS
 */
async function hideSplashSafely() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // Never block boot
  }
}

/**
 * ✅ Apply global fetch credentials patch
 * - Runs once
 * - Browser-only guarded internally
 * - Safe for Vite production build
 */
patchFetchForCredentials();

import("./app-entry")
  .then(({ AppEntry }) => {
    const rootEl = document.getElementById("root");

    if (!rootEl) {
      console.error("Root element not found");
      hideSplashSafely();
      return;
    }

    import("react")
      .then((React) =>
        import("react-dom/client")
          .then((ReactDOM) => {
            const root = ReactDOM.createRoot(rootEl);
            root.render(
              <React.StrictMode>
                <AppEntry />
              </React.StrictMode>,
            );

            // ✅ Correct splash hide
            hideSplashSafely();
          })
          .catch((err) => {
            console.error("React bootstrap failed:", err);
            hideSplashSafely();
          }),
      )
      .catch((err) => {
        console.error("React import failed:", err);
        hideSplashSafely();
      });
  })
  .catch((error) => {
    console.error("Failed to load app-entry:", error);
    hideSplashSafely();
  });
