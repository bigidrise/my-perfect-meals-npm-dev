/**
 * Verified help entry points, not navigation permission or executable handoffs.
 * These facts are injected only through Development platform knowledge.
 */
export const PLATFORM_HELP_KNOWLEDGE = {
  shopping: {
    entryPoint: "Open Shopping List from the dashboard or navigation.",
    route: "/shopping-list-v2",
    access: "Essential access; Grocery Store Coach separately requires the grocery_coach entitlement (Pro) or existing FULL_ACCESS.",
    controls: [
      "Grocery Store Coach is a labeled control on the Shopping List page. It opens a sheet with meal and product assistance, not another page.",
      "Product Scan is a separate labeled control on Shopping List. It opens the product-label capture dialog to evaluate a product against the authorized profile.",
      "Saved Groceries opens saved products, distinct from saved meal recipes in Favorites.",
      "Shopping List supports meal/date-derived needs and a separate My List for personal additions, checked items, barcode lookup, voice additions and grocery export.",
    ],
    limits: [
      "Do not promise live retailer stock, completed checkout or automatic purchases.",
      "Product Scan label analysis, barcode lookup and Recipe Maker are different tools. Product Scan is not a button on every builder.",
      "The Shopping List route exists, but Chef has no approved navigation button or prefill for it or its nested controls.",
    ],
  },
  recipeMaker: {
    entryPoint: "On the dashboard, tap the Recipe Maker card.",
    route: null,
    access: "Essential or higher; existing paid-access checks and food safeguards apply.",
    controls: [
      "The card opens the existing Recipe Maker capture dialog, not a standalone Recipe Maker route.",
      "Choose Photo uploads an existing recipe image; Camera captures a recipe image. The specialized workflow analyzes/adapts the captured recipe and presents its own customization and creation actions.",
      "Product Scan is for product-label evaluation, not capturing a recipe. MacroScan in Biometrics estimates food nutrition, not the Recipe Maker capture workflow.",
    ],
    limits: ["Do not invent a Recipe Maker URL, a general recipe-paste control or a Chef recipe-transfer contract. Chef does not adapt or generate the recipe in chat."],
  },
  sources: {
    entryPoint: "The dashboard has a Sources & Medical Information card. It opens the existing sources dialog; Info triggers on applicable surfaces may also say View sources and methodology.",
    route: null,
    access: "Existing member-facing information controls; no clinical privileges or entitlement granted.",
    purpose: "Explains sources, methodology and the concepts informing platform features. The App Library also has Medical & Nutrition Sources documentation.",
    limits: [
      "General documentation is not proof that a specific recommendation, diagnosis or nutrient target is medically validated.",
      "Never invent a citation, source URL or claim that a reference supports a particular answer without verified claim-level evidence. Be honest when that evidence is unavailable.",
      "No approved Chef button or direct Sources-dialog route exists.",
    ],
  },
  tutorialsAndGuides: {
    entryPoint: "On applicable builder pages, look in the upper action-control area for Builder Tutorial, beneath its play control.",
    routes: ["/general-nutrition-builder/build", "/tutorials", "/learn"],
    access: "Each builder retains assigned-builder, onboarding and subscription guards. Documentation does not unlock a builder.",
    controls: [
      "The General Nutrition build page has Builder Tutorial among its upper action controls. It opens the existing tutorial video in a new tab.",
      "The weekly meal board and Performance Nutrition meal board also use the Builder Tutorial control. Some creators use tutorial controls with their own labels; do not claim every page has Builder Tutorial.",
      "Tutorial Hub is an existing page; some tutorial entries are Coming Soon. App Library is the member-facing name of the Learn page.",
      "The General Nutrition header receives an internal tour callback but does not render a Guide button. Do not confuse that callback or Guided Journey content with a visible Guide control.",
      "Page-level Guide controls are specific to their page, not universal. For example, Guide in a professional client folder opens that folder tour; it is not a general member builder control. Do not send ordinary members to professional tools.",
    ],
    limits: ["Describe the controls actually verified for that page. Do not invent a Guide button on the current page or claim to know which page the member is viewing. Ask which page if it matters.", "No Chef navigation buttons to Tutorial Hub or App Library are approved in this task."],
  },
  copilot: {
    entryPoint: "Where present, the floating Flame Chef/chef-cap help control sits near the lower-right corner and opens Copilot's page explanation.",
    route: null,
    access: "Available page explanations depend on the current page and existing help system; not new feature access.",
    controls: [
      "Tap the floating control to open or close its help sheet. Its content is contextual to the page.",
      "The help sheet includes an Autoplay On/Off control. This is existing Copilot help, separate from the Ask Chef conversation.",
    ],
    limits: ["Do not promise identical help controls or explanations on every page, automatic navigation, or a new voice conversation. No standalone Copilot destination or Chef handoff is approved."],
  },
} as const;
