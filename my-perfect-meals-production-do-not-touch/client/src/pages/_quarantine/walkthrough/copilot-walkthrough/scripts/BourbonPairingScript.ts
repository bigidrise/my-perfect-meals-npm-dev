// Bourbon Pairing Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const BourbonPairingScript: WalkthroughScript = {
  id: "bourbon-pairing-walkthrough",
  featureId: "BOURBON_PAIRING",
  title: "Bourbon Pairing",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "bourbonpairing-hero",
      description: "Explore bourbon pairing ideas. Learn which bourbons complement your favorite dishes.",
      speak: "Explore bourbon pairing ideas.",
    },
    {
      id: "browse",
      targetTestId: "bourbonpairing-grid",
      description: "Select a bourbon pairing card.",
      speak: "Select a bourbon pairing card.",
    },
    {
      id: "details",
      targetTestId: "bourbonpairing-card",
      description: "View the pairing details and tasting notes.",
      speak: "View the pairing details and tasting notes.",
    },
  ],
};

export default BourbonPairingScript;
