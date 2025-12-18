// Beer Pairing Walkthrough Script
// Phase C.5: Placeholder script (uiReady:false until UI test-IDs are wired in C.6)
import type { WalkthroughScript } from "../WalkthroughTypes";

const BeerPairingScript: WalkthroughScript = {
  id: "beer-pairing-walkthrough",
  featureId: "BEER_PAIRING",
  title: "Beer Pairing",
  uiReady: false,
  steps: [
    {
      id: "intro",
      targetTestId: "beerpairing-hero",
      description: "Discover the art of beer pairing. Match your meals with the perfect brew.",
      speak: "Discover the art of beer pairing.",
    },
    {
      id: "browse",
      targetTestId: "beerpairing-grid",
      description: "Scroll and choose a beer pairing.",
      speak: "Scroll and choose a beer pairing.",
    },
    {
      id: "select",
      targetTestId: "beerpairing-card",
      description: "Tap to see why this beer complements your meal.",
      speak: "Tap to see why this beer complements your meal.",
    },
  ],
};

export default BeerPairingScript;
