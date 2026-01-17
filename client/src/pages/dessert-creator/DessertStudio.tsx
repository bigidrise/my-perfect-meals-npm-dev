import { Cake } from "lucide-react";
import StudioWizard, { StudioConfig } from "@/components/studio-wizard/StudioWizard";

const DESSERT_STUDIO_CONFIG: StudioConfig = {
  branding: {
    title: "Dessert Studio",
    emoji: "🍰",
    introTitle: "Create with Chef",
    introDescription: "Walk through a few quick steps and I'll create a custom dessert with full recipe, macros, and cooking instructions.",
    accentColor: "text-pink-500",
    gradientFrom: "from-black/60",
    gradientVia: "via-pink-600",
    gradientTo: "to-purple-800",
    icon: Cake,
  },
  steps: [
    {
      title: "The Craving",
      question: "What dessert are you craving?",
      placeholder: "e.g., chocolate cake, apple pie, brownies, cheesecake...",
      voiceScript: "What sweet treat are you in the mood for today?",
      inputType: "textarea",
      summaryPrefix: "Craving",
    },
    {
      title: "Flavor Direction",
      question: "Any specific flavor you want?",
      placeholder: "e.g., chocolate, vanilla, strawberry, lemon, caramel...",
      voiceScript: "Perfect. Any flavor direction — chocolate, fruit, caramel, something spiced?",
      inputType: "textarea",
      summaryPrefix: "Flavor",
    },
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many people are we serving?",
      inputType: "buttons",
      buttonOptions: ["1", "2", "4", "6", "8", "12"],
      summaryPrefix: "Servings",
      defaultValue: "4",
    },
    {
      title: "Dietary Notes",
      question: "Any dietary restrictions or preferences?",
      placeholder: "e.g., low sugar, gluten-free, dairy-free, high protein...",
      voiceScript: "Any dietary notes? Low sugar, gluten-free, dairy-free — or anything else?",
      inputType: "textarea",
      summaryPrefix: "Dietary",
    },
  ],
  scripts: {
    ready: "Locked in. I'll create your dessert — then we can head to Chef's Kitchen to make it.",
    generatingStart: "Okay — crafting your dessert now.",
    generatingProgress1: "Balancing sweetness and macros…",
    generatingProgress2: "Finalizing ingredients and steps…",
    complete: "Done. Your dessert is ready. Enter Chef's Kitchen when you're ready to bake.",
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
