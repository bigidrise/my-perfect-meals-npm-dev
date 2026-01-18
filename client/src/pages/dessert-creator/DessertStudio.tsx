import { Cake } from "lucide-react";
import StudioWizard, { StudioConfig } from "@/components/studio-wizard/StudioWizard";

const DESSERT_STUDIO_CONFIG: StudioConfig = {
  branding: {
    title: "Dessert Studio",
    emoji: "🍰",
    introTitle: "Create with Chef",
    introDescription:
    "Tell me what you’re craving — I’ll handle the rest.",
    accentColor: "text-orange-400",
      gradientFrom: "from-black/60",
      gradientVia: "via-orange-600",
      gradientTo: "to-orange-800",
    icon: Cake,
  },
  steps: [
    {
      title: "The Craving",
      question: "What are you craving?",
      placeholder: "chocolate cake, brownies, cheesecake…",
      voiceScript: "What dessert are you craving?",
      inputType: "textarea",
      summaryPrefix: "Craving",
    },
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many servings?",
      inputType: "buttons",
      buttonOptions: ["1", "2", "4", "6", "8", "12"],
      summaryPrefix: "Servings",
      defaultValue: "4",
    },
    {
      title: "Notes",
      question: "Anything else?",
      placeholder: "low sugar, gluten-free, high protein…",
      voiceScript: "Anything else I should know?",
      inputType: "textarea",
      summaryPrefix: "Notes",
    },
  ],
  scripts: {
    ready: "Alright. I’ll make it.",
    generatingStart: "Working on it.",
    generatingProgress1: "",
    generatingProgress2: "",
    complete: "Done. Let’s bake.",
  },
  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/craving-desserts",
  source: "dessert-studio",
  defaultMealType: "dessert",
  servingsStepIndex: 2,
  buildPrompt: (values, servings) => {
    const [craving, flavor, , dietary] = values;
    const parts: string[] = [];
    parts.push(`Dessert: ${craving}`);
    if (flavor?.trim()) parts.push(`Flavor: ${flavor.trim()}`);
    if (dietary?.trim()) parts.push(`Dietary: ${dietary.trim()}`);
    return {
      craving: parts.join(". "),
      servings,
    };
  },
};

export default function DessertStudio() {
  return <StudioWizard config={DESSERT_STUDIO_CONFIG} />;
}
