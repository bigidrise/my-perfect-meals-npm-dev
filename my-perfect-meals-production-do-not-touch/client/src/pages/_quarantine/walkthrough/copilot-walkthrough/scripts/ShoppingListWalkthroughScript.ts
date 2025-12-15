// Shopping List Walkthrough Script - Phase C.8
import type { WalkthroughScript } from "../WalkthroughTypes";

const ShoppingListWalkthroughScript: WalkthroughScript = {
  id: "shopping-list-walkthrough",
  featureId: "SHOPPING_LIST",
  title: "Master Shopping List",
  uiReady: true, // ✅ ACTIVATED: Phase C.8 complete - all anchors + events wired (Nov 24 2025)
  steps: [
    {
      id: "intro",
      targetTestId: "shopping-list",
      description: "Welcome to your Master Shopping List! Add items manually, from recipes, or import from your weekly meal plan.",
      waitForEvent: { testId: "shopping-list-opened", event: "opened" },
    },
    {
      id: "add-items",
      targetTestId: "shopping-list",
      description: "Add items using the buttons below - type them, speak them, scan barcodes, or bulk import. Your list updates automatically.",
      waitForEvent: { testId: "shopping-list-interacted", event: "interacted" },
    },
    {
      id: "send-to-store",
      targetTestId: "shopping-send-to-store",
      description: "Excellent! When you're ready to shop, tap 'Shop at Walmart' to send your entire list to Walmart for easy purchasing.",
      waitForEvent: { testId: "shopping-list-completed", event: "completed" },
    },
  ],
};

export default ShoppingListWalkthroughScript;
