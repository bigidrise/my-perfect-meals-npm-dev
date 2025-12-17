import { CopilotAction, KnowledgeResponse } from "./CopilotContext";
import {
  boostProteinNextMeal,
  generateOnePanFridgeRescue,
} from "@/lib/copilotActions";
import { explainFeature } from "./commands/explainFeature";
import { shouldAllowAutoOpen } from "./CopilotRespectGuard";
import { interpretFoodCommand } from "./NLEngine";
import { FEATURES } from "@/featureFlags";
import { findFeatureFromKeywords } from "./KeywordFeatureMap";
import {
  findFeatureFromRegistry,
  findSubOptionByAlias,
  getHubPromptMessage,
  hubRequiresSubSelection,
  type FeatureDefinition,
  type SubOption,
} from "./CanonicalAliasRegistry";

// Walkthrough system has been quarantined - these are now no-ops
const startWalkthrough = async (
  _featureId: string,
): Promise<KnowledgeResponse> => ({
  title: "Quick Tour Available",
  description:
    "Look for the help (?) icon in the header to start a quick tour of this feature.",
  spokenText: "Look for the help icon in the header to start a quick tour.",
});

const hasScript = (_scriptId: string): boolean => false;

const waitForNavigationReady = async (_route?: string): Promise<void> => {};

const beginScriptWalkthrough = async (
  _scriptId: string,
  _responseCallback?:
    | ((response: KnowledgeResponse | null) => void)
    | undefined,
): Promise<{ success: boolean; response: KnowledgeResponse | null }> => ({
  success: false,
  response: {
    title: "Quick Tour Available",
    description:
      "Look for the help (?) icon in the header to start a quick tour.",
    spokenText: "Look for the help icon in the header to start a quick tour.",
  },
});

const hubWalkthroughEngine = {
  start: async (_config: {
    hubId: string;
    hubName: string;
    subOptions: Array<{
      id: string;
      name: string;
      route: string;
      testId?: string;
      voiceAliases: string[];
    }>;
    selectionPrompt: string;
    voiceTimeoutMessage: string;
    onSelection: (subOption: {
      id: string;
      name: string;
      route: string;
    }) => Promise<void>;
    responseCallback?: (response: KnowledgeResponse | null) => void;
    onError?: (error: string) => void;
  }): Promise<void> => {},
};

type CommandHandler = (payload?: any) => Promise<void>;
type NavigationHandler = (path: string) => void;
type ModalHandler = (modalId: string) => void;
type ResponseHandler = (response: KnowledgeResponse | null) => void;

let navigationCallback: NavigationHandler | null = null;
let modalCallback: ModalHandler | null = null;
let responseCallback: ResponseHandler | null = null;

// Track which feature the user is actively interacting with
type ActiveFeature =
  | "weekly-board"
  | "fridge-rescue"
  | "proaccess-careteam"
  | "diabetic-hub"
  | "glp1-hub"
  | null;
let lastActiveFeature: ActiveFeature = null;

// Track active hub for sub-option navigation
let currentHub: FeatureDefinition | null = null;

export function setNavigationHandler(fn: NavigationHandler) {
  navigationCallback = fn;
}

export function setModalHandler(fn: ModalHandler) {
  modalCallback = fn;
}

export function setResponseHandler(fn: ResponseHandler) {
  responseCallback = fn;
}

// Optional: allow UI pages to explicitly set the active feature context
export function setActiveFeature(feature: ActiveFeature) {
  lastActiveFeature = feature;
}

// Copilot Introduction - plays once when user chooses "My Perfect Copilot"
export function startCopilotIntro(force = false) {
  const INTRO_FLAG = "copilot-intro-seen";

  // ⚠️ PROTECTED INVARIANT: Use central guard to respect user's coaching mode choice
  // This ensures any future updates to guard logic automatically apply here
  if (!shouldAllowAutoOpen()) {
    console.log(
      "🛑 Copilot intro blocked: CopilotRespectGuard denied auto-open",
    );
    return;
  }

  // Check if intro has already been played (unless forced)
  if (!force && localStorage.getItem(INTRO_FLAG) === "true") {
    console.log("ℹ️ Copilot intro already seen, skipping");
    return;
  }

  // Intro script (voice + text)
  const introScript =
    "Welcome to My Perfect Copilot. I’m here to help you understand how the app works and guide you as you use each feature. You’re on the home page. From here, you can build and manage your master shopping list, log meals from a photo, calculate your macros, check your biometrics, or get inspiration — whether that’s a quick motivational message or leave a thought in your daily journal. Anytime you need help, just tap the listen button. I’ll explain what the page is for, how the features work, and how to use everything with confidence. You’re always in control — and I’m right here when you need me.";

  // Send intro response through existing pipeline
  if (responseCallback) {
    responseCallback({
      title: "Welcome to My Perfect Copilot",
      description:
        "Welcome to My Perfect Copilot. Tap the listen button anytime you want guidance.",
      spokenText: introScript,
      howTo: [
        "What the page does",
        "How to use its features",
        "What each option means",
        "How to get the most out of it",
      ],
      tips: [
        "Move anywhere in the app. When you want guidance, tap my button, and I'll walk you through that page.",
      ],
    });
  }

  // Mark intro as seen (save flag after dispatching so TTS can play)
  setTimeout(() => {
    localStorage.setItem(INTRO_FLAG, "true");
    console.log("✅ Copilot intro flag saved");
  }, 500);
}

const Commands: Record<string, CommandHandler> = {
  "macros.boostProteinNextMeal": async () => {
    if (!navigationCallback) {
      console.warn("⚠️ Navigation not available");
      return;
    }
    await boostProteinNextMeal(navigationCallback);
  },

  "macros.lightenDinner": async () => {
    console.log("➡️ Executing: macros.lightenDinner");
  },

  "diabetic.lowerCarb": async () => {
    console.log("➡️ Executing: diabetic.lowerCarb");
  },

  "diabetic.balanceDay": async () => {
    console.log("➡️ Executing: diabetic.balanceDay");
  },

  "diabetic.balanceNextMealCarbs": async () => {
    console.log("➡️ Executing: diabetic.balanceNextMealCarbs");
  },

  "glp1.volumeBoost": async () => {
    console.log("➡️ Executing: glp1.volumeBoost");
  },

  "glp1.comfort": async () => {
    console.log("➡️ Executing: glp1.comfort");
  },

  "glp1.makeComfortSwap": async () => {
    console.log("➡️ Executing: glp1.makeComfortSwap");
  },

  "cravings.sweetSafeOption": async () => {
    console.log("➡️ Executing: cravings.sweetSafeOption");
  },

  "cravings.savoryComfort": async () => {
    console.log("➡️ Executing: cravings.savoryComfort");
  },

  "night.buildGuardrailSnack": async () => {
    console.log("➡️ Executing: night.buildGuardrailSnack");
  },

  "board.fillEmpty": async () => {
    console.log("➡️ Executing: board.fillEmpty");
  },

  "board.batchPlan": async () => {
    console.log("➡️ Executing: board.batchPlan");
  },

  "onePan.rotation": async () => {
    console.log("➡️ Executing: onePan.rotation");
  },

  "fridge.onePanDinner": async () => {
    if (!navigationCallback) {
      console.warn("⚠️ Navigation not available");
      return;
    }

    const userId = localStorage.getItem("userId") || "1";
    const fridgeItems: string[] = [];

    await generateOnePanFridgeRescue(userId, fridgeItems, navigationCallback);
  },

  "fridge.suggestAdds": async () => {
    console.log("➡️ Executing: fridge.suggestAdds");
  },

  "shopping.addFromMeal": async () => {
    console.log("➡️ Executing: shopping.addFromMeal");
  },

  "emotion.simplifyTonight": async () => {
    console.log("➡️ Executing: emotion.simplifyTonight");
  },

  "meals.addHiddenVeggies": async () => {
    console.log("➡️ Executing: meals.addHiddenVeggies");
  },

  "explain.fridge-rescue": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    lastActiveFeature = "fridge-rescue";
    const response = await explainFeature("fridge-rescue");
    responseCallback(response);
  },

  "explain.weekly-board": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    lastActiveFeature = "weekly-board";
    const response = await explainFeature("weekly-board");
    responseCallback(response);
  },

  "explain.subscriptions": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    const response = await explainFeature("subscriptions");
    responseCallback(response);
  },

  "explain.ai-meal-builder": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    const response = await explainFeature("ai-meal-builder");
    responseCallback(response);
  },

  "explain.shopping-list": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    const response = await explainFeature("shopping-list");
    responseCallback(response);
  },

  "walkthrough.start.fridge-rescue": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    lastActiveFeature = "fridge-rescue";
    const response = await startWalkthrough("fridge-rescue");
    responseCallback(response);
  },

  "walkthrough.start.weekly-board": async () => {
    if (!responseCallback) {
      console.warn("⚠️ Response handler not available");
      return;
    }
    lastActiveFeature = "weekly-board";
    const response = await startWalkthrough("weekly-board");
    responseCallback(response);
  },

  // =========================================
  // FOOD COMMAND HANDLERS (NLEngine + voice)
  // =========================================

  "meal.addIngredient": async (payload?: { ingredient: string }) => {
    if (!responseCallback) return;
    const ingredient = payload?.ingredient || "ingredient";
    responseCallback({
      title: "Ingredient Added",
      description: `${ingredient} added to your meal.`,
      spokenText: `${ingredient} added to your meal.`,
    });
  },

  "meal.swapIngredient": async (payload?: { from: string; to: string }) => {
    if (!responseCallback) return;
    const from = payload?.from || "ingredient";
    const to = payload?.to || "alternative";
    responseCallback({
      title: "Ingredient Swapped",
      description: `Replaced ${from} with ${to}.`,
      spokenText: `Replaced ${from} with ${to}.`,
    });
  },

  "meals.generateOnePan": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    responseCallback({
      title: "One-Pan Dinner",
      description: "Generating a one-pan dinner idea based on your request...",
      spokenText: "Generating a one-pan dinner idea...",
    });
  },

  "macros.highProteinSuggestion": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "High Protein Meal",
      description: "Here's a high-protein meal idea tailored to your macros.",
      spokenText: "Here's a high protein meal idea.",
    });
  },

  "macros.lowerCarbSwap": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Lower Carb Swap",
      description: "Creating a lower-carb version of this meal.",
      spokenText: "Creating a lower carb version.",
    });
  },

  "fridge.generate": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    lastActiveFeature = "fridge-rescue";
    responseCallback({
      title: "Fridge Rescue",
      description: "Generating a Fridge Rescue recipe with what you have...",
      spokenText: "Generating a Fridge Rescue recipe.",
    });
  },

  "weekly.autofill": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "weekly-board";
    responseCallback({
      title: "Weekly Board Autofill",
      description: "Planning your week with smart meal choices...",
      spokenText: "Planning your week now.",
    });
  },

  // =========================================
  // Fridge Rescue helpers for voice
  // =========================================

  "fridge.addTypedIngredient": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    const text = payload?.text || "an ingredient";
    lastActiveFeature = "fridge-rescue";
    responseCallback({
      title: "Ingredient Added",
      description: `${text} added to your Fridge Rescue list.`,
      spokenText: `${text} added to your Fridge Rescue ingredients.`,
    });
  },

  "fridge.clear": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "fridge-rescue";
    responseCallback({
      title: "Ingredients Cleared",
      description: "Your Fridge Rescue ingredient list has been cleared.",
      spokenText: "Clearing your Fridge Rescue ingredients.",
    });
  },

  "fridge.saveMeal": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "fridge-rescue";
    responseCallback({
      title: "Meal Saved",
      description: "This Fridge Rescue meal has been saved to your board.",
      spokenText: "Saving this Fridge Rescue meal to your board.",
    });
  },

  "fridge.sendToShopping": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "fridge-rescue";
    responseCallback({
      title: "Sent to Shopping List",
      description: "This meal's ingredients were added to your shopping list.",
      spokenText: "Sending this meal to your shopping list.",
    });
  },

  // =========================================
  // Weekly board helpers for voice
  // =========================================

  "day.sendToMacros": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "weekly-board";
    responseCallback({
      title: "Day Sent to Macros",
      description: "Your current day's meals were sent to the Macro tracker.",
      spokenText: "Sending your day to macros.",
    });
  },

  "day.sendToShopping": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "weekly-board";
    responseCallback({
      title: "Day Sent to Shopping",
      description:
        "Your current day's ingredients were added to the shopping list.",
      spokenText: "Sending your day to the shopping list.",
    });
  },

  "week.sendToShopping": async () => {
    if (!responseCallback) return;
    lastActiveFeature = "weekly-board";
    responseCallback({
      title: "Week Sent to Shopping",
      description:
        "Your full week's ingredients were added to the shopping list.",
      spokenText: "Sending your week to the shopping list.",
    });
  },

  // =========================================
  // MASTER SHOPPING LIST
  // =========================================
  "explain.shopping-master": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("shopping-master");
    responseCallback(response);
  },

  "walkthrough.start.shopping-master": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("shopping-master");
    responseCallback(response);
  },

  "shopping.addItem": async (payload?: { item: string }) => {
    if (!responseCallback) return;
    const item = payload?.item || "item";
    responseCallback({
      title: "Item Added",
      description: `${item} added to your shopping list.`,
      spokenText: `Adding ${item} to your shopping list.`,
    });
  },

  "shopping.bulkAdd": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Bulk Add",
      description: "Opening bulk add to add multiple items at once.",
      spokenText: "Opening bulk add.",
    });
  },

  "shopping.scanBarcode": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Barcode Scanner",
      description: "Opening barcode scanner to add items.",
      spokenText: "Opening barcode scanner.",
    });
  },

  "shopping.markPurchased": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Item Checked",
      description: "Item marked as purchased.",
      spokenText: "Marking item as purchased.",
    });
  },

  "shopping.removeItem": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Item Removed",
      description: "Item removed from shopping list.",
      spokenText: "Removing item.",
    });
  },

  "shopping.orderDelivery": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Delivery",
      description: "Opening delivery options for your shopping list.",
      spokenText: "Opening delivery options.",
    });
  },

  // =========================================
  // BIOMETRICS & DAILY MACROS
  // =========================================
  "explain.biometrics": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("biometrics");
    responseCallback(response);
  },

  "walkthrough.start.biometrics": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("biometrics");
    responseCallback(response);
  },

  "biometrics.scanLabel": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Photo Scan",
      description: "Opening photo upload to scan nutrition labels.",
      spokenText: "Opening photo scanner.",
    });
  },

  "biometrics.addMacros": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Macros Added",
      description: "Meal macros imported to your daily tracker.",
      spokenText: "Adding meal macros.",
    });
  },

  "biometrics.addManual": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    responseCallback({
      title: "Manual Entry",
      description: "Adding your manual macros to today's total.",
      spokenText: "Adding your macros.",
    });
  },

  "biometrics.updateWeight": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    responseCallback({
      title: "Weight Saved",
      description: "Your weight has been recorded.",
      spokenText: "Saving your weight.",
    });
  },

  "biometrics.logWater": async (payload?: { amount: number }) => {
    if (!responseCallback) return;
    const amount = payload?.amount || 8;
    responseCallback({
      title: "Water Logged",
      description: `${amount} ounces of water added.`,
      spokenText: `Adding ${amount} ounces of water.`,
    });
  },

  "biometrics.resetWater": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Water Reset",
      description: "Water tracker has been reset.",
      spokenText: "Resetting water tracker.",
    });
  },

  // =========================================
  // MACRO CALCULATOR
  // =========================================
  "explain.macro-calculator": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("macro-calculator");
    responseCallback(response);
  },

  "walkthrough.start.macro-calculator": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("macro-calculator");
    responseCallback(response);
  },

  "macro.setGoal": async (payload?: { goal: string }) => {
    if (!responseCallback) return;
    const goal = payload?.goal || "maintain";
    responseCallback({
      title: "Goal Set",
      description: `Goal set to ${goal}.`,
      spokenText: `Setting your goal to ${goal}.`,
    });
  },

  "macro.setBodyType": async (payload?: { type: string }) => {
    if (!responseCallback) return;
    const type = payload?.type || "mesomorph";
    responseCallback({
      title: "Body Type Set",
      description: `Body type set to ${type}.`,
      spokenText: `Setting body type to ${type}.`,
    });
  },

  "macro.syncWeight": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Weight Synced",
      description: "Latest weight pulled from Biometrics.",
      spokenText: "Syncing your weight.",
    });
  },

  "macro.calculate": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Calculating",
      description: "Calculating your macro targets now.",
      spokenText: "Calculating your macros.",
    });
  },

  "macro.setTargets": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Targets Saved",
      description: "Macro targets saved to Biometrics page.",
      spokenText: "Saving your macro targets.",
    });
  },

  // =========================================
  // GET INSPIRATION
  // =========================================
  "explain.get-inspiration": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("get-inspiration");
    responseCallback(response);
  },

  "walkthrough.start.get-inspiration": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("get-inspiration");
    responseCallback(response);
  },

  "inspiration.getQuote": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "New Quote",
      description: "Loading a fresh inspiration quote for you.",
      spokenText: "Loading a new quote.",
    });
  },

  // =========================================
  // DAILY HEALTH JOURNAL
  // =========================================
  "explain.daily-journal": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("daily-journal");
    responseCallback(response);
  },

  "walkthrough.start.daily-journal": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("daily-journal");
    responseCallback(response);
  },

  "journal.newEntry": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "New Entry",
      description: "Starting a new journal entry.",
      spokenText: "Starting a new journal entry.",
    });
  },

  "journal.save": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Entry Saved",
      description: "Your journal entry has been saved.",
      spokenText: "Saving your journal entry.",
    });
  },

  // =========================================
  // PROACCESS CARE TEAM
  // =========================================
  "explain.proaccess-careteam": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("proaccess-careteam");
    responseCallback(response);
  },

  "walkthrough.start.proaccess-careteam": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("proaccess-careteam");
    responseCallback(response);
  },

  "pro.inviteClient": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Invite Client",
      description: "Opening invite client form.",
      spokenText: "Opening invite client form.",
    });
  },

  "pro.linkCode": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Link Code",
      description: "Ready to link client with access code.",
      spokenText: "Ready to link with access code.",
    });
  },

  "pro.openPortal": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "ProPortal",
      description: "Opening ProPortal dashboard.",
      spokenText: "Opening ProPortal.",
    });
  },

  "pro.addClient": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Add Client",
      description: "Adding new client to your Care Team.",
      spokenText: "Adding new client.",
    });
  },

  "pro.saveMacros": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Macros Saved",
      description: "Client macro targets saved.",
      spokenText: "Saving macro targets.",
    });
  },

  "pro.sendToBiometrics": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Sent to Biometrics",
      description: "Macro targets synced to client Biometrics.",
      spokenText: "Syncing macros to Biometrics.",
    });
  },

  "pro.saveDirectives": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Directives Saved",
      description: "Carb directives saved.",
      spokenText: "Saving carb directives.",
    });
  },

  "pro.navigateMenuBuilder": async (payload?: { builder: string }) => {
    if (!responseCallback) return;
    const builder = payload?.builder || "menu builder";
    responseCallback({
      title: "Opening Builder",
      description: `Opening ${builder} menu builder.`,
      spokenText: `Opening ${builder} builder.`,
    });
  },

  // =========================================
  // DIABETIC HUB
  // =========================================
  "explain.diabetic-hub": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("diabetic-hub");
    responseCallback(response);
  },

  "walkthrough.start.diabetic-hub": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("diabetic-hub");
    responseCallback(response);
  },

  "diabetes.setPreset": async (payload?: { preset: string }) => {
    if (!responseCallback) return;
    const preset = payload?.preset || "preset";
    responseCallback({
      title: "Preset Set",
      description: `Diabetic preset set to ${preset}.`,
      spokenText: `Setting preset to ${preset}.`,
    });
  },

  "diabetes.saveGuardrails": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Guardrails Saved",
      description: "Clinical guardrails activated.",
      spokenText: "Saving guardrails.",
    });
  },

  "diabetes.logReading": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    responseCallback({
      title: "Blood Sugar Logged",
      description: "Blood sugar reading saved.",
      spokenText: "Logging blood sugar reading.",
    });
  },

  "diabetes.goToMenuBuilder": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Diabetic Menu Builder",
      description: "Opening Diabetic Menu Builder.",
      spokenText: "Opening Diabetic Menu Builder.",
    });
  },

  // =========================================
  // GLP-1 HUB
  // =========================================
  "explain.glp1-hub": async () => {
    if (!responseCallback) return;
    const response = await explainFeature("glp1-hub");
    responseCallback(response);
  },

  "walkthrough.start.glp1-hub": async () => {
    if (!responseCallback) return;
    const response = await startWalkthrough("glp1-hub");
    responseCallback(response);
  },

  "glp1.logDose": async (payload?: { text: string }) => {
    if (!responseCallback) return;
    responseCallback({
      title: "Dose Logged",
      description: "GLP-1 dose saved to history.",
      spokenText: "Logging GLP-1 dose.",
    });
  },

  "glp1.saveGuardrails": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "Guardrails Saved",
      description: "GLP-1 guardrails activated.",
      spokenText: "Saving GLP-1 guardrails.",
    });
  },

  "glp1.goToMenuBuilder": async () => {
    if (!responseCallback) return;
    responseCallback({
      title: "GLP-1 Menu Builder",
      description: "Opening GLP-1 Menu Builder.",
      spokenText: "Opening GLP-1 Menu Builder.",
    });
  },
};

// Legacy fuzzy keyword matching - now delegates to CanonicalAliasRegistry
// Kept for backward compatibility with existing voice intents
function findFeatureByKeyword(
  query: string,
): { featureId: string; route: string } | null {
  const feature = findFeatureFromRegistry(query);

  if (feature) {
    return {
      featureId: feature.legacyId || feature.id, // Use legacyId for Spotlight compatibility
      route: feature.primaryRoute,
    };
  }

  return null;
}

// Voice query handler - processes voice transcripts using NLEngine + explicit intents
async function handleVoiceQuery(transcript: string) {
  console.log(`🎤 Processing voice query: "${transcript}"`);

  const lower = transcript.toLowerCase();

  // ===================================
  // PHASE B: HUB-FIRST ROUTING SYSTEM (PRIORITY)
  // ===================================

  // Check if user is selecting a sub-option within current hub
  if (currentHub && currentHub.isHub && currentHub.subOptions) {
    const subOption = findSubOptionByAlias(currentHub, transcript);

    if (subOption) {
      console.log(
        `🎯 Sub-option selected: ${subOption.label} → ${subOption.route}`,
      );

      if (navigationCallback) {
        navigationCallback(subOption.route);
      }

      // Clear hub context after navigation
      currentHub = null;

      if (responseCallback) {
        responseCallback({
          title: `Opening ${subOption.label}`,
          description: `Navigating to ${subOption.label}`,
          spokenText: `Opening ${subOption.label}`,
        });
      }

      return;
    }
  }

  // Check for feature match in canonical registry
  const registryFeature = findFeatureFromRegistry(transcript);

  if (registryFeature) {
    console.log(
      `🔍 Registry match: ${registryFeature.id} → ${registryFeature.primaryRoute}`,
    );

    // Navigate to primary route (hub or direct page)
    if (navigationCallback) {
      navigationCallback(registryFeature.primaryRoute);
    }

    // If it's a hub, store context and prompt for sub-option
    if (registryFeature.isHub) {
      currentHub = registryFeature;

      const promptMessage = getHubPromptMessage(registryFeature);

      if (responseCallback) {
        responseCallback({
          title: `${registryFeature.id.replace(/_/g, " ")}`,
          description: promptMessage,
          spokenText: promptMessage,
        });
      }

      return;
    }

    // Direct page - clear hub context and provide confirmation
    currentHub = null;

    if (responseCallback) {
      responseCallback({
        title: `Opening ${registryFeature.id.replace(/_/g, " ")}`,
        description: `Navigating to ${registryFeature.primaryRoute}`,
        spokenText: `Opening ${registryFeature.id.replace(/_/g, " ").toLowerCase()}`,
      });
    }

    return;
  }

  // ===================================
  // WEEKLY MEAL BOARD INTENTS
  // ===================================
  if (
    lower.includes("weekly meal board") ||
    lower.includes("plan my week") ||
    lower.includes("teach me the weekly board") ||
    lower.includes("teach me weekly board") ||
    lower.includes("show me weekly board") ||
    lower.includes("how do i use the weekly meal board")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["walkthrough.start.weekly-board"]();
    return;
  }

  if (
    lower.includes("what is weekly board") ||
    lower.includes("explain weekly board") ||
    lower.includes("what is the weekly meal board")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["explain.weekly-board"]();
    return;
  }

  if (
    lower.includes("send day to macros") ||
    lower.includes("add day to macros") ||
    lower.includes("move day to macros")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["day.sendToMacros"]();
    return;
  }

  if (
    lower.includes("send day to shopping") ||
    lower.includes("day shopping list")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["day.sendToShopping"]();
    return;
  }

  if (
    lower.includes("send week to shopping") ||
    lower.includes("week shopping list")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["week.sendToShopping"]();
    return;
  }

  if (
    lower.includes("generate my day") ||
    lower.includes("ai create my day") ||
    lower.includes("make my meals for today")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["weekly.autofill"]();
    return;
  }

  // ===================================
  // FRIDGE RESCUE INTENTS
  // ===================================
  if (
    lower.includes("fridge rescue") ||
    lower.includes("use what's in my fridge") ||
    lower.includes("cook with what i have") ||
    lower.includes("help me cook") ||
    lower.includes("use my ingredients")
  ) {
    lastActiveFeature = "fridge-rescue";
    await Commands["walkthrough.start.fridge-rescue"]();
    return;
  }

  if (
    lower.includes("what is fridge rescue") ||
    lower.includes("explain fridge rescue")
  ) {
    lastActiveFeature = "fridge-rescue";
    await Commands["explain.fridge-rescue"]();
    return;
  }

  if (
    lower.includes("clear ingredients") ||
    lower.includes("clear fridge") ||
    lower.includes("start over")
  ) {
    lastActiveFeature = "fridge-rescue";
    await Commands["fridge.clear"]();
    return;
  }

  if (lower.includes("save this meal") || lower.includes("save meal")) {
    lastActiveFeature = "fridge-rescue";
    await Commands["fridge.saveMeal"]();
    return;
  }

  if (lower.includes("send to shopping") || lower.includes("shopping list")) {
    // If user has been in fridge recently, prefer that context
    if (lastActiveFeature === "fridge-rescue") {
      await Commands["fridge.sendToShopping"]();
    } else {
      await Commands["day.sendToShopping"]();
    }
    return;
  }

  // ===================================
  // CONTEXT-AWARE "ADD ..." INTENT
  // ===================================
  if (lower.startsWith("add ")) {
    const ingredient = transcript.substring(4).trim();

    if (!ingredient) {
      if (responseCallback) {
        const spokenText = "What would you like me to add?";
        responseCallback({
          title: "Add what?",
          description: spokenText,
          spokenText,
        });
      }
      return;
    }

    // Use context to decide where to add it
    if (lastActiveFeature === "fridge-rescue") {
      await Commands["fridge.addTypedIngredient"]({ text: ingredient });
      return;
    }

    if (lastActiveFeature === "weekly-board") {
      await Commands["meal.addIngredient"]({ ingredient });
      return;
    }

    // No clear context – ask the user
    if (responseCallback) {
      const spokenText = `Do you want ${ingredient} added to Fridge Rescue or your Weekly Meal Board?`;
      responseCallback({
        title: "Where should I add this?",
        description: spokenText,
        spokenText,
      });
    }
    return;
  }

  // ===================================
  // EXISTING WALKTHROUGHS (fallback keywords)
  // ===================================
  if (
    lower.includes("how do i use fridge rescue") ||
    lower.includes("teach me fridge rescue") ||
    lower.includes("show me fridge rescue")
  ) {
    lastActiveFeature = "fridge-rescue";
    await Commands["walkthrough.start.fridge-rescue"]();
    return;
  }

  if (
    lower.includes("how do i use weekly") ||
    lower.includes("teach me weekly") ||
    lower.includes("show me weekly board")
  ) {
    lastActiveFeature = "weekly-board";
    await Commands["walkthrough.start.weekly-board"]();
    return;
  }

  // ===================================
  // FEATURE EXPLANATIONS (fallback keywords)
  // ===================================
  if (
    lower.includes("what is the meal builder") ||
    lower.includes("what is meal builder") ||
    lower.includes("explain meal builder")
  ) {
    await Commands["explain.ai-meal-builder"]();
    return;
  }

  if (
    lower.includes("what is shopping list") ||
    lower.includes("explain shopping list")
  ) {
    await Commands["explain.shopping-list"]();
    return;
  }

  if (
    lower.includes("what are subscriptions") ||
    lower.includes("explain subscriptions")
  ) {
    await Commands["explain.subscriptions"]();
    return;
  }

  // ===================================
  // MASTER SHOPPING LIST INTENTS
  // ===================================
  if (
    lower.includes("teach me shopping list") ||
    lower.includes("how do i use shopping list") ||
    lower.includes("show me shopping list") ||
    lower.includes("teach me master shopping") ||
    lower.includes("show me master shopping")
  ) {
    await Commands["walkthrough.start.shopping-master"]();
    return;
  }

  if (
    lower.includes("what is the shopping list") ||
    lower.includes("explain shopping list") ||
    lower.includes("what is master shopping list") ||
    lower.includes("explain master shopping")
  ) {
    await Commands["explain.shopping-master"]();
    return;
  }

  if (
    lower.includes("scan") ||
    lower.includes("barcode") ||
    lower.includes("scan barcode")
  ) {
    await Commands["shopping.scanBarcode"]();
    return;
  }

  if (
    lower.includes("bulk add") ||
    lower.includes("add several items") ||
    lower.includes("add many items")
  ) {
    await Commands["shopping.bulkAdd"]();
    return;
  }

  if (
    lower.includes("check this off") ||
    lower.includes("mark this purchased") ||
    lower.includes("mark purchased")
  ) {
    await Commands["shopping.markPurchased"]();
    return;
  }

  if (
    lower.includes("delete this item") ||
    lower.includes("remove this item") ||
    lower.includes("delete item")
  ) {
    await Commands["shopping.removeItem"]();
    return;
  }

  if (
    lower.includes("order this") ||
    lower.includes("deliver my groceries") ||
    lower.includes("send this for delivery")
  ) {
    await Commands["shopping.orderDelivery"]();
    return;
  }

  // ===================================
  // BIOMETRICS & DAILY MACROS INTENTS
  // ===================================
  if (
    lower.includes("teach me biometrics") ||
    lower.includes("how do i use biometrics") ||
    lower.includes("show me biometrics") ||
    lower.includes("teach me macros") ||
    lower.includes("show me daily macros")
  ) {
    await Commands["walkthrough.start.biometrics"]();
    return;
  }

  if (
    lower.includes("what is biometrics") ||
    lower.includes("explain biometrics") ||
    lower.includes("what is the macro tracker") ||
    lower.includes("what is the macros page") ||
    lower.includes("explain macros")
  ) {
    await Commands["explain.biometrics"]();
    return;
  }

  if (
    lower.includes("scan this") ||
    lower.includes("scan the label") ||
    lower.includes("log from photo") ||
    lower.includes("photo macros")
  ) {
    await Commands["biometrics.scanLabel"]();
    return;
  }

  if (lower.includes("add 8 ounces") || lower.includes("add eight ounces")) {
    await Commands["biometrics.logWater"]({ amount: 8 });
    return;
  }

  if (lower.includes("add 16 ounces") || lower.includes("add sixteen ounces")) {
    await Commands["biometrics.logWater"]({ amount: 16 });
    return;
  }

  if (lower.includes("reset water") || lower.includes("clear water")) {
    await Commands["biometrics.resetWater"]();
    return;
  }

  if (lower.includes("log my weight") || lower.includes("save my weight")) {
    await Commands["biometrics.updateWeight"]({ text: transcript });
    return;
  }

  // ===================================
  // MACRO CALCULATOR INTENTS
  // ===================================
  if (
    lower.includes("teach me macro calculator") ||
    lower.includes("how do i use macros") ||
    lower.includes("show me macro calculator") ||
    lower.includes("teach me the calculator")
  ) {
    await Commands["walkthrough.start.macro-calculator"]();
    return;
  }

  if (
    lower.includes("what is the macro calculator") ||
    lower.includes("explain macro calculator") ||
    lower.includes("what are macro targets")
  ) {
    await Commands["explain.macro-calculator"]();
    return;
  }

  if (
    lower.includes("i want to cut") ||
    lower.includes("set my goal to cut") ||
    lower.includes("goal cut")
  ) {
    await Commands["macro.setGoal"]({ goal: "cut" });
    return;
  }

  if (lower.includes("maintain") || lower.includes("goal maintain")) {
    await Commands["macro.setGoal"]({ goal: "maintain" });
    return;
  }

  if (lower.includes("gain") || lower.includes("goal gain")) {
    await Commands["macro.setGoal"]({ goal: "gain" });
    return;
  }

  if (lower.includes("ectomorph")) {
    await Commands["macro.setBodyType"]({ type: "ectomorph" });
    return;
  }

  if (lower.includes("mesomorph")) {
    await Commands["macro.setBodyType"]({ type: "mesomorph" });
    return;
  }

  if (lower.includes("endomorph")) {
    await Commands["macro.setBodyType"]({ type: "endomorph" });
    return;
  }

  if (lower.includes("sync my weight") || lower.includes("update my weight")) {
    await Commands["macro.syncWeight"]();
    return;
  }

  if (
    lower.includes("calculate my macros") ||
    lower.includes("show my macros")
  ) {
    await Commands["macro.calculate"]();
    return;
  }

  if (
    lower.includes("save my macro targets") ||
    lower.includes("set macro targets")
  ) {
    await Commands["macro.setTargets"]();
    return;
  }

  // ===================================
  // GET INSPIRATION INTENTS
  // ===================================
  if (
    lower.includes("teach me inspiration") ||
    lower.includes("how do i use inspiration") ||
    lower.includes("show me inspiration")
  ) {
    await Commands["walkthrough.start.get-inspiration"]();
    return;
  }

  if (
    lower.includes("what is inspiration") ||
    lower.includes("explain inspiration") ||
    lower.includes("what is get inspiration")
  ) {
    await Commands["explain.get-inspiration"]();
    return;
  }

  if (
    lower.includes("give me inspiration") ||
    lower.includes("inspire me") ||
    lower.includes("show me a quote") ||
    lower.includes("get inspiration")
  ) {
    await Commands["inspiration.getQuote"]();
    return;
  }

  // ===================================
  // DAILY HEALTH JOURNAL INTENTS
  // ===================================
  if (
    lower.includes("teach me journal") ||
    lower.includes("how do i use the journal") ||
    lower.includes("show me the journal")
  ) {
    await Commands["walkthrough.start.daily-journal"]();
    return;
  }

  if (
    lower.includes("what is the journal") ||
    lower.includes("explain the journal") ||
    lower.includes("explain daily journal")
  ) {
    await Commands["explain.daily-journal"]();
    return;
  }

  if (
    lower.includes("add a journal entry") ||
    lower.includes("start a journal entry") ||
    lower.includes("i want to journal")
  ) {
    await Commands["journal.newEntry"]();
    return;
  }

  if (lower.includes("save my journal") || lower.includes("save this entry")) {
    await Commands["journal.save"]();
    return;
  }

  // ===================================
  // PROACCESS CARE TEAM INTENTS
  // ===================================
  if (
    lower.includes("teach me proaccess") ||
    lower.includes("how do i use proaccess") ||
    lower.includes("show me proaccess")
  ) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["walkthrough.start.proaccess-careteam"]();
    return;
  }

  if (
    lower.includes("what is proaccess") ||
    lower.includes("explain proaccess") ||
    lower.includes("what is the care team")
  ) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["explain.proaccess-careteam"]();
    return;
  }

  if (lower.includes("invite a client") || lower.includes("send an invite")) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["pro.inviteClient"]();
    return;
  }

  if (
    lower.includes("link with code") ||
    lower.includes("connect with access code")
  ) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["pro.linkCode"]();
    return;
  }

  if (lower.includes("open pro portal") || lower.includes("open the portal")) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["pro.openPortal"]();
    return;
  }

  if (lower.includes("save macros") || lower.includes("update macros")) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["pro.saveMacros"]();
    return;
  }

  if (lower.includes("send macros to biometrics")) {
    lastActiveFeature = "proaccess-careteam";
    await Commands["pro.sendToBiometrics"]();
    return;
  }

  // ===================================
  // DIABETIC HUB INTENTS
  // ===================================
  if (
    lower.includes("teach me diabetic hub") ||
    lower.includes("how do i use diabetic hub") ||
    lower.includes("show me diabetic hub")
  ) {
    lastActiveFeature = "diabetic-hub";
    await Commands["walkthrough.start.diabetic-hub"]();
    return;
  }

  if (
    lower.includes("what is the diabetic hub") ||
    lower.includes("explain diabetic hub") ||
    lower.includes("what are diabetic guardrails")
  ) {
    lastActiveFeature = "diabetic-hub";
    await Commands["explain.diabetic-hub"]();
    return;
  }

  if (lower.includes("strict control")) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.setPreset"]({ preset: "strict" });
    return;
  }

  if (lower.includes("cardiac diet")) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.setPreset"]({ preset: "cardiac" });
    return;
  }

  if (lower.includes("liberal") || lower.includes("elderly preset")) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.setPreset"]({ preset: "elderly" });
    return;
  }

  if (
    lower.includes("save guardrails") ||
    lower.includes("update guardrails")
  ) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.saveGuardrails"]();
    return;
  }

  if (
    lower.includes("log my blood sugar") ||
    lower.includes("add my glucose")
  ) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.logReading"]({ text: transcript });
    return;
  }

  if (
    lower.includes("diabetic menu builder") ||
    lower.includes("open diabetic builder")
  ) {
    lastActiveFeature = "diabetic-hub";
    await Commands["diabetes.goToMenuBuilder"]();
    return;
  }

  // ===================================
  // GLP-1 HUB INTENTS
  // ===================================
  if (
    lower.includes("teach me glp 1") ||
    lower.includes("how do i use glp 1") ||
    lower.includes("show me the glp 1 hub")
  ) {
    lastActiveFeature = "glp1-hub";
    await Commands["walkthrough.start.glp1-hub"]();
    return;
  }

  if (
    lower.includes("what is glp 1 hub") ||
    lower.includes("explain glp 1 hub") ||
    lower.includes("what is the glp 1 tracker")
  ) {
    lastActiveFeature = "glp1-hub";
    await Commands["explain.glp1-hub"]();
    return;
  }

  if (lower.includes("log my dose") || lower.includes("add my glp 1 dose")) {
    lastActiveFeature = "glp1-hub";
    await Commands["glp1.logDose"]({ text: transcript });
    return;
  }

  if (
    lower.includes("save my glp 1 guardrails") ||
    lower.includes("update glp 1 guardrails")
  ) {
    lastActiveFeature = "glp1-hub";
    await Commands["glp1.saveGuardrails"]();
    return;
  }

  if (
    lower.includes("open glp 1 menu builder") ||
    lower.includes("go to glp 1 menu builder")
  ) {
    lastActiveFeature = "glp1-hub";
    await Commands["glp1.goToMenuBuilder"]();
    return;
  }

  // ===================================
  // PHASE C.4 — HUB-FIRST ROUTING + SPOTLIGHT WALKTHROUGH
  // ===================================
  // Three-tier routing: (1) Built-ins, (2) Hub session, (3) Fresh feature discovery
  // Hub session short-circuits ALL subsequent logic

  // Phase C.4.A: Hub Session Resolution (Tier 2)
  // When currentHub is active, ONLY check sub-options, SKIP all feature/keyword lookups
  if (currentHub) {
    console.log(
      `🔄 Phase C.4: Hub session active for ${currentHub.id}, checking for sub-option match`,
    );

    // Check for cancel/back/exit commands
    if (
      lower.includes("cancel") ||
      lower.includes("go back") ||
      lower.includes("exit") ||
      lower.includes("never mind")
    ) {
      console.log(`🚪 Phase C.4: User cancelled hub session`);
      currentHub = null;
      if (responseCallback) {
        responseCallback({
          title: "Hub Cancelled",
          description: "No problem, exiting the hub.",
          spokenText: "No problem, exiting the hub.",
        });
      }
      return; // Exit - hub session cancelled
    }

    // Try to match sub-option
    const subOption = findSubOptionByAlias(currentHub, transcript);

    if (subOption) {
      console.log(
        `✅ Phase C.4: Sub-option matched: ${subOption.label} → ${subOption.route}`,
      );

      // Navigate to sub-option
      if (navigationCallback) {
        navigationCallback(subOption.route);

        // Clear hub session AFTER navigation starts
        currentHub = null;

        // Wait for navigation, then start walkthrough if available
        try {
          await waitForNavigationReady(subOption.route);

          if (subOption.walkthroughId && hasScript(subOption.walkthroughId)) {
            console.log(
              `🚀 Phase C.4: Launching sub-option walkthrough: ${subOption.walkthroughId}`,
            );

            const { success, response } = await beginScriptWalkthrough(
              subOption.walkthroughId,
              responseCallback || undefined,
            );

            if (responseCallback) {
              responseCallback(response);
            }

            if (!success) {
              console.warn(`Walkthrough failed, falling back to legacy`);
              const legacyResponse = await startWalkthrough(
                subOption.walkthroughId,
              );
              if (responseCallback) {
                responseCallback(legacyResponse);
              }
            }
          } else {
            // No walkthrough available for this sub-option
            if (responseCallback) {
              responseCallback({
                title: subOption.label,
                description: `You're now viewing ${subOption.label}.`,
                spokenText: `You're now viewing ${subOption.label}.`,
              });
            }
          }
        } catch (err) {
          console.warn("Navigation timeout");
          if (responseCallback) {
            responseCallback({
              title: "Navigation Error",
              description: "Could not navigate to that page.",
              spokenText: "I couldn't navigate to that page.",
            });
          }
        }
      }

      return; // Exit - sub-option matched and handled
    }

    // No sub-option match - re-prompt user
    console.log(`❓ Phase C.4: No sub-option match, re-prompting`);
    if (responseCallback) {
      const promptMessage = getHubPromptMessage(currentHub);
      responseCallback({
        title: currentHub.id.replace(/_/g, " "),
        description: promptMessage,
        spokenText: promptMessage,
      });
    }
    return; // Exit - stay in hub session, wait for valid sub-option
  }

  // Phase C.4.B: Fresh Feature Discovery (Tier 3)
  // No hub session active - check for new feature/hub match via CanonicalAliasRegistry
  const featureMatch = findFeatureFromRegistry(transcript);

  if (featureMatch && FEATURES.copilotSpotlight) {
    console.log(`✨ Phase C.4: Feature matched: ${featureMatch.id}`);

    // Check if this is a hub that requires sub-selection
    if (featureMatch.isHub && hubRequiresSubSelection(featureMatch)) {
      console.log(
        `🏢 Phase C.4: Hub detected (${featureMatch.hubSize}): ${featureMatch.id}`,
      );

      // Navigate to hub page FIRST
      if (navigationCallback) {
        navigationCallback(featureMatch.primaryRoute);

        // Set hub session state AFTER navigation starts
        currentHub = featureMatch;

        // Wait for hub page to load, then activate hub walkthrough engine
        try {
          await waitForNavigationReady(featureMatch.primaryRoute);

          // Phase C.7: Activate hub walkthrough engine with voice/tap/timeout handling
          console.log(
            `🎯 Phase C.7: Starting hub walkthrough engine for ${featureMatch.id}`,
          );

          // Create walkthrough ID map for sub-options (HubSubOption doesn't have walkthroughId property)
          const walkthroughIdMap = new Map<string, string>();
          (featureMatch.subOptions || []).forEach((opt) => {
            if (opt.walkthroughId) {
              walkthroughIdMap.set(opt.id, opt.walkthroughId);
            }
          });

          await hubWalkthroughEngine.start({
            hubId: featureMatch.id,
            hubName: featureMatch.id.replace(/_HUB$/, "").replace(/_/g, " "),
            subOptions: (featureMatch.subOptions || []).map((opt) => ({
              id: opt.id,
              name: opt.label,
              route: opt.route,
              testId: opt.testId,
              voiceAliases: opt.aliases || [],
            })),
            selectionPrompt: getHubPromptMessage(featureMatch),
            voiceTimeoutMessage:
              featureMatch.voiceTimeoutMessage ||
              "I didn't catch that. Try typing your selection instead, or tap one of the options on screen.",
            onSelection: async (subOption) => {
              console.log(
                `✅ Phase C.7: Hub sub-option selected: ${subOption.name}`,
              );

              // Clear hub session
              currentHub = null;

              // Navigate to sub-option
              if (navigationCallback) {
                navigationCallback(subOption.route);

                try {
                  await waitForNavigationReady(subOption.route);

                  // Get walkthrough ID from map
                  const walkthroughId = walkthroughIdMap.get(subOption.id);

                  // Start sub-option walkthrough if available
                  if (walkthroughId && hasScript(walkthroughId)) {
                    console.log(
                      `🚀 Phase C.7: Launching sub-option walkthrough: ${walkthroughId}`,
                    );

                    const { success, response } = await beginScriptWalkthrough(
                      walkthroughId,
                      responseCallback || undefined,
                    );

                    if (responseCallback) {
                      responseCallback(response);
                    }

                    if (!success) {
                      console.warn(`Walkthrough failed for ${walkthroughId}`);
                    }
                  } else {
                    // No walkthrough - just show confirmation
                    if (responseCallback) {
                      responseCallback({
                        title: subOption.name,
                        description: `You're now viewing ${subOption.name}.`,
                        spokenText: `Opening ${subOption.name}.`,
                      });
                    }
                  }
                } catch (err) {
                  console.warn("Sub-option navigation timeout");
                }
              }
            },
            onError: (error) => {
              console.warn(`⚠️ Phase C.7: Hub engine error: ${error}`);

              // Show fallback message for voice timeout
              if (responseCallback) {
                responseCallback({
                  title: "Try Typing Instead",
                  description: error,
                  spokenText: error,
                });
              }
            },
          });

          // Send initial prompt response
          const promptMessage = getHubPromptMessage(featureMatch);
          if (responseCallback) {
            responseCallback({
              title:
                featureMatch.id.replace(/_HUB$/, "").replace(/_/g, " ") +
                " Hub",
              description: promptMessage,
              spokenText: promptMessage,
            });
          }
        } catch (err) {
          console.warn("Hub navigation timeout");
          currentHub = null; // Clear session on timeout
        }
      }

      return; // Exit - hub session initiated
    }

    // Not a hub (or hub with single option) - navigate directly and start walkthrough
    currentHub = null; // Clear any stale hub state

    if (navigationCallback) {
      navigationCallback(featureMatch.primaryRoute);

      try {
        await waitForNavigationReady(featureMatch.primaryRoute);

        if (
          featureMatch.walkthroughId &&
          hasScript(featureMatch.walkthroughId)
        ) {
          console.log(
            `🚀 Phase C.4: Launching direct feature walkthrough: ${featureMatch.walkthroughId}`,
          );

          const { success, response } = await beginScriptWalkthrough(
            featureMatch.walkthroughId,
            responseCallback || undefined,
          );

          if (responseCallback) {
            responseCallback(response);
          }

          if (!success) {
            console.warn(`Walkthrough failed, falling back to legacy`);
            const legacyResponse = await startWalkthrough(
              featureMatch.walkthroughId,
            );
            if (responseCallback) {
              responseCallback(legacyResponse);
            }
          }
        } else {
          // No walkthrough available
          if (responseCallback) {
            responseCallback({
              title: featureMatch.id.replace(/_/g, " "),
              description: `You're now viewing ${featureMatch.id.replace(/_/g, " ")}.`,
              spokenText: `You're now viewing ${featureMatch.id.replace(/_/g, " ")}.`,
            });
          }
        }
      } catch (err) {
        console.warn("Navigation timeout, showing knowledge instead");
        if (featureMatch.walkthroughId) {
          const knowledge = await explainFeature(featureMatch.walkthroughId);
          if (responseCallback) {
            responseCallback(knowledge);
          }
        }
      }
    }

    return; // Exit - direct feature navigation completed
  }

  // Fallback to KeywordFeatureMap for legacy features not yet in CanonicalAliasRegistry
  const spotlightFeatureMatch = FEATURES.copilotSpotlight
    ? findFeatureFromKeywords(transcript)
    : null;

  if (spotlightFeatureMatch && FEATURES.copilotSpotlight) {
    console.log(
      `✨ Legacy spotlight walkthrough triggered: ${spotlightFeatureMatch.walkthroughId}`,
    );

    // Navigate to feature page
    if (navigationCallback) {
      navigationCallback(spotlightFeatureMatch.path);

      // Wait for navigation to complete, then start walkthrough
      try {
        await waitForNavigationReady(spotlightFeatureMatch.path);

        // Phase C.1: Check if a Phase C script exists for this feature
        if (hasScript(spotlightFeatureMatch.walkthroughId)) {
          console.log(
            `🚀 Phase C.1: Launching script-based walkthrough for ${spotlightFeatureMatch.walkthroughId}`,
          );

          // Use new script-walkthrough helper with event streaming
          const { success, response } = await beginScriptWalkthrough(
            spotlightFeatureMatch.walkthroughId,
            responseCallback || undefined, // Pass responseCallback for event streaming
          );

          // Send initial response
          if (responseCallback) {
            responseCallback(response);
          }

          if (!success) {
            console.warn(`Phase C.1 failed, falling back to legacy system`);
            const legacyResponse = await startWalkthrough(
              spotlightFeatureMatch.walkthroughId,
            );
            if (responseCallback) {
              responseCallback(legacyResponse);
            }
          }
        } else {
          // Phase B fallback: Use legacy walkthrough system
          console.log(
            `📖 Phase B: Using legacy walkthrough for ${spotlightFeatureMatch.walkthroughId}`,
          );
          const walkthroughResponse = await startWalkthrough(
            spotlightFeatureMatch.walkthroughId,
          );
          if (responseCallback) {
            responseCallback(walkthroughResponse);
          }
        }
      } catch (err) {
        console.warn("Navigation timeout, showing knowledge instead");
        // Fallback to knowledge explanation
        const knowledge = await explainFeature(
          spotlightFeatureMatch.walkthroughId,
        );
        if (responseCallback) {
          responseCallback(knowledge);
        }
      }
    }

    return;
  }

  // ===================================
  // FOOD COMMANDS (NLEngine-based)
  // ===================================
  const nlResult = interpretFoodCommand(transcript);

  if (nlResult.action !== "unknown" && Commands[nlResult.action]) {
    console.log(`🎯 NLEngine mapped to: ${nlResult.action}`);
    await Commands[nlResult.action](nlResult.payload);
  } else {
    // Final fallback: "still learning"
    if (responseCallback) {
      responseCallback({
        title: "I heard you",
        description: nlResult.spokenText,
        spokenText: nlResult.spokenText,
      });
    }
  }
}

export async function executeCommand(action: CopilotAction) {
  try {
    switch (action.type) {
      case "run-command": {
        const fn = Commands[action.id];
        if (!fn) {
          console.error(`❌ Unknown copilot command: ${action.id}`);
          throw new Error(`Unknown command: ${action.id}`);
        }
        console.log(`🔥 Executing command: ${action.id}`);
        await fn();
        console.log(`✅ Command completed: ${action.id}`);
        break;
      }

      case "navigate": {
        if (!action.to) {
          throw new Error("Navigate action missing 'to' property");
        }
        if (navigationCallback) {
          console.log(`🧭 Navigating to: ${action.to}`);
          navigationCallback(action.to);
        } else {
          console.warn(
            "⚠️ Navigation handler not set. Call setNavigationHandler()",
          );
        }
        break;
      }

      case "open-modal": {
        if (!action.id) {
          throw new Error("Modal action missing 'id' property");
        }
        if (modalCallback) {
          console.log(`🪟 Opening modal: ${action.id}`);
          modalCallback(action.id);
        } else {
          console.warn("⚠️ Modal handler not set. Call setModalHandler()");
        }
        break;
      }

      case "custom": {
        const payload = action.payload as any;
        if (payload?.voiceQuery) {
          await handleVoiceQuery(payload.voiceQuery);
        } else {
          console.log("🤖 AI Query:", action.payload);
        }
        break;
      }

      default: {
        const _exhaustive: never = action;
        throw new Error(
          `Unhandled action type: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Command execution failed:", error);
    throw error;
  }
}
