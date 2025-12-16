// Master Shopping List Walkthrough Script
import type { WalkthroughScript } from "../WalkthroughTypes";

const MasterShoppingListScript: WalkthroughScript = {
  id: "shopping-list-walkthrough",
  featureId: "SHOPPING_LIST",
  title: "Master Shopping List",
  uiReady: true,
  steps: [
    {
      id: "intro",
      targetTestId: "shopping-summary-card",
      description: "Welcome to your Master Shopping List! This powerful tool helps you organize and manage all your grocery shopping. See your item counts and status here.",
    },
    {
      id: "add-items",
      targetTestId: "shopping-add-buttons",
      description: "Add items using Voice, Bulk text entry, or Barcode scanning. These tools make it easy to build your list quickly.",
    },
    {
      id: "items-list",
      targetTestId: "shopping-items-list",
      description: "Your shopping list displays here. Items are organized and easy to manage. Tap items to edit quantity, unit, or name.",
    },
    {
      id: "check-items",
      targetTestId: "shopping-first-item",
      description: "Check off items as you shop by tapping the checkbox. Checked items move to 'Purchased Today' section below.",
      waitForEvent: { testId: "shopping-item-checked", event: "done" },
    },
    {
      id: "walmart-export",
      targetTestId: "shopping-walmart-button",
      description: "Export your list to Walmart for online ordering. This opens your shopping list as a search on Walmart.com for easy pickup or delivery.",
    },
    {
      id: "clear-actions",
      targetTestId: "shopping-clear-buttons",
      description: "Clear purchased items or reset your entire list when done shopping. This keeps your list fresh and organized.",
      waitForEvent: { testId: "shopping-list-cleared", event: "done" },
    },
    {
      id: "success",
      targetTestId: "shopping-summary-card",
      description: "You're all set! Your Master Shopping List helps you shop smarter with voice add, barcode scanning, and direct Walmart integration.",
    },
  ],
};

export default MasterShoppingListScript;
