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

  // ⛔ Step 0 (Ingredients) is MANUAL ONLY
  disableVoiceSteps: [0],

  // 🎤 One-time transition message after ingredients
  afterStepScripts: {
    0: "Okay — now that we know what’s in your refrigerator, you can keep going like this, or switch to hands-free.",
  },

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
      title: "Hunger Level",
      question: "How hungry are you?",
      voiceScript: "How hungry are you — light, medium, or hearty?",
      inputType: "buttons",
      buttonOptions: ["Light", "Medium", "Hearty"],
      summaryPrefix: "Hunger Level",
      defaultValue: "Medium",
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
      question: "Anything else?",
      placeholder: "time limit, allergies, preferences…",
      voiceScript: "Anything else I should know?",
      inputType: "textarea",
      summaryPrefix: "Notes",
    },
  ],

  scripts: {
    ready: "Alright. I’ll make something from what you have.",
    generatingStart: "Working on it.",
    generatingProgress1: "",
    generatingProgress2: "",
    complete: "Done. Let’s cook.",
  },

  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/fridge-rescue",
  source: "fridge-rescue-studio",
  defaultMealType: "dinner",
  servingsStepIndex: 2,

  // 🧠 PROMPT FIXED — no imaginary "style"
  buildPrompt: (values, servings) => {
    const [ingredients, hungerLevel, , notes] = values;
    const parts: string[] = [];

    parts.push(`Ingredients available: ${ingredients}`);
    parts.push(`Hunger level: ${hungerLevel}`);
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
