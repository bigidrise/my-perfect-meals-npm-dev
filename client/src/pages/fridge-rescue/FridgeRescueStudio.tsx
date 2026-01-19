import { Refrigerator } from "lucide-react";
import StudioWizard, {
  StudioConfig,
} from "@/components/studio-wizard/StudioWizard";

const FRIDGE_RESCUE_STUDIO_CONFIG: StudioConfig = {
  branding: {
    title: "Fridge Rescue Studio",
    emoji: "🧊",
    introTitle: "Create with Chef",
    introDescription: "Tell me what you have — I’ll make something from it.",
    accentColor: "text-orange-400",
    gradientFrom: "from-black/60",
    gradientVia: "via-orange-600",
    gradientTo: "to-orange-800",
    icon: Refrigerator,
  },

  /**
   * 🔒 IMPORTANT
   * Disable hands-free / voice input on step 0 (Ingredients)
   * Hands-free becomes available AFTER ingredients are set
   */
  disableVoiceSteps: [0],

  steps: [
    {
      title: "Your Ingredients",
      question: "What do you have?",
      placeholder: "chicken, rice, eggs, cheese…",
      voiceScript: "What do you have in your fridge?",
      inputType: "textarea",
      summaryPrefix: "Ingredients",
    },
    {
      title: "Meal Size",
      question: "What kind of meal do you want right now?",
      voiceScript: "What kind of meal are you in the mood for — something light, regular, or filling?",
      inputType: "buttons",
      buttonOptions: ["Light", "Regular", "Filling"],
      summaryPrefix: "Meal Size",
      defaultValue: "Regular",
    },
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many servings?",
      inputType: "buttons",
      buttonOptions: ["1", "2", "3", "4", "5", "6"],
      summaryPrefix: "Servings",
      defaultValue: "2",
    },
    {
      title: "Notes",
      question: "Anything else I should know?",
      placeholder: "time limit, allergies, preferences…",
      voiceScript: "Anything else I should know?",
      inputType: "yesno",
      summaryPrefix: "Notes",
      yesnoConfig: {
        noLabel: "No, I'm good",
        yesLabel: "Yes, add notes",
        noValue: "None",
        yesPlaceholder: "e.g., time limit, allergies, preferences…",
      },
    },
  ],

  /**
   * 🧠 Transition line AFTER ingredients are submitted
   * Fired before moving to Hunger Level
   */
  afterStepScripts: {
    0: "Okay — now that we know what’s in your refrigerator, you can continue here manually, or switch to hands-free.",
  },

  scripts: {
    ready: "If everything looks good, press generate.",
    generatingStart: "",
    generatingProgress1: "",
    generatingProgress2: "",
    complete: "If you happy with your meal tap, Enter Chef’s Kitchen, and we’ll start cooking, if not, press Create New, and we can create a new meal.",
  },

  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/fridge-rescue",
  source: "fridge-rescue-studio",
  defaultMealType: "dinner",
  servingsStepIndex: 2,

  buildPrompt: (values, servings) => {
    const [ingredients, hunger, , notes] = values;

    const parts: string[] = [];
    parts.push(`Ingredients available: ${ingredients}`);
    parts.push(`Hunger level: ${hunger}`);
    if (notes?.trim()) parts.push(`Notes: ${notes.trim()}`);
    parts.push("Use only the ingredients listed — no shopping needed.");

    return {
      craving: parts.join(". "),
      servings,
    };
  },
};

export default function FridgeRescueStudio() {
  return <StudioWizard config={FRIDGE_RESCUE_STUDIO_CONFIG} />;
}
