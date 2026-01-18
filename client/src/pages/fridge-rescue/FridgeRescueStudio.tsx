import { Refrigerator } from "lucide-react";
import StudioWizard, { StudioConfig } from "@/components/studio-wizard/StudioWizard";

const FRIDGE_RESCUE_STUDIO_CONFIG: StudioConfig = {
  branding: {
    title: "Fridge Rescue Studio",
    emoji: "🧊",
    introTitle: "Create with Chef",
    introDescription: "Tell me what's in your fridge and I'll create a full meal — no shopping required.",
    accentColor: "text-orange-400",
    gradientFrom: "from-black/60",
    gradientVia: "via-orange-600",
    gradientTo: "to-orange-800",
    icon: Refrigerator,
  },
  steps: [
    {
      title: "Your Ingredients",
      question: "What ingredients do you have?",
      placeholder: "e.g., chicken, rice, broccoli, eggs, cheese, onions...",
      voiceScript: "Alright — what do you have in your fridge right now?",
      inputType: "textarea",
      summaryPrefix: "Ingredients",
    },
    {
      title: "Meal Style",
      question: "What kind of meal are you thinking?",
      placeholder: "e.g., quick stir-fry, comfort food, something healthy, one-pot meal...",
      voiceScript: "What style of meal are you in the mood for?",
      inputType: "textarea",
      summaryPrefix: "Style",
    },
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many people are we feeding?",
      inputType: "buttons",
      buttonOptions: ["1", "2", "3", "4", "5", "6"],
      summaryPrefix: "Servings",
      defaultValue: "2",
    },
    {
      title: "Time & Notes",
      question: "Any time limit or special notes?",
      placeholder: "e.g., under 20 minutes, no spicy, extra protein, kid-friendly...",
      voiceScript: "Any time constraints or special requests?",
      inputType: "textarea",
      summaryPrefix: "Notes",
    },
  ],
  scripts: {
    ready: "Got it. I'll build a meal from what you have — then we'll cook it together.",
    generatingStart: "Okay — figuring out what we can make.",
    generatingProgress1: "Matching ingredients to recipes…",
    generatingProgress2: "Optimizing for flavor and nutrition…",
    complete: "Done. Your fridge rescue meal is ready. Let's head to Chef's Kitchen.",
  },
  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/fridge-rescue",
  source: "fridge-rescue-studio",
  defaultMealType: "dinner",
  servingsStepIndex: 2,
  buildPrompt: (values, servings) => {
    const [ingredients, style, , notes] = values;
    const parts: string[] = [];
    parts.push(`Ingredients available: ${ingredients}`);
    if (style?.trim()) parts.push(`Style: ${style.trim()}`);
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
