/**
 * Bootstrap Entry Point
 * Production-safe: no alerts, no debug popups.
 */

import { SplashScreen } from "@capacitor/splash-screen";

import("./app-entry")
  .then(({ AppEntry }) => {
    // Mount the React app
    const rootEl = document.getElementById("root");

    // Safety: ensure root exists
    if (!rootEl) {
      console.error("Root element not found");
      SplashScreen.hide().catch(() => {});
      return;
    }

    // Lazy-load React only when needed
    import("react")
      .then((React) =>
        import("react-dom/client").then((ReactDOM) => {
          const root = ReactDOM.createRoot(rootEl);
          root.render(
            <React.StrictMode>
              <AppEntry />
            </React.StrictMode>,
          );

          // 🔥 Hide native splash once the UI is ready
          SplashScreen.hide().catch(() => {});
        }),
      )
      .catch((err) => {
        console.error("React bootstrap failed:", err);
        SplashScreen.hide().catch(() => {});
      });
  })
  .catch((error) => {
    console.error("Failed to load app-entry:", error);

    // Even on failure, don't leave the user stuck on the splash
    SplashScreen.hide().catch(() => {});
  });
