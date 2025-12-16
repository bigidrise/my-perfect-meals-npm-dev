// Wine Pairing Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const WinePairingScript: WalkthroughScript = {
  id: "wine-pairing-walkthrough",
  featureId: "WINE_PAIRING",
  title: "Wine Pairing",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "winepairing-hero",
      description: "Learn how to match wines with your meals for the perfect pairing.",
      speak: "Learn how to match wines with your meals.",
    },
    {
      id: "browse",
      targetTestId: "winepairing-grid",
      description: "Choose from the wine pairing list.",
      speak: "Choose from the wine pairing list.",
    },
    {
      id: "select",
      targetTestId: "winepairing-card",
      description: "Tap a pairing to learn more about why it works.",
      speak: "Tap a pairing to learn more.",
    },
  ],
};

export default WinePairingScript;
