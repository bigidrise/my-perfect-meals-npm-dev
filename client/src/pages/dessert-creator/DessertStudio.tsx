import { Cake } from "lucide-react";
import StudioWizard, { StudioConfig } from "@/components/studio-wizard/StudioWizard";

/**
 * DESSERT STUDIO — GUARDED & NON-GENERIC
 * Category → Flavor → Style → Servings → Dietary
 * No more random avocado nonsense.
 */
const DESSERT_STUDIO_CONFIG: StudioConfig = {
  branding: {
    title: "Dessert Studio",
    emoji: "🍰",
    introTitle: "Create with Chef",
    introDescription: "Pick what you're in the mood for — I'll build the dessert.",
    accentColor: "text-orange-400",
    gradientFrom: "from-black/60",
    gradientVia: "via-orange-600",
    gradientTo: "to-orange-800",
    icon: Cake,
  },

  steps: [
    // 0 — CATEGORY
    {
      title: "Dessert Type",
      question: "What kind of dessert?",
      voiceScript: "What kind of dessert are we making?",
      inputType: "buttons",
      buttonOptions: [
        "Surprise Me",
        "Cake",
        "Pie",
        "Cookies",
        "Brownies",
        "Cheesecake",
        "Frozen / No-Bake",
        "Bars",
        "Muffins / Cupcakes",
      ],
      summaryPrefix: "Category",
    },

    // 1 — FLAVOR FAMILY
    {
      title: "Flavor",
      question: "Pick a flavor direction",
      voiceScript: "What flavor are you thinking?",
      inputType: "buttons",
      buttonOptions: [
        "Chocolate",
        "Vanilla",
        "Fruit",
        "Citrus",
        "Caramel",
        "Coffee",
        "Spice",
        "Peanut Butter",
      ],
      summaryPrefix: "Flavor",
    },

    // 2 — STYLE / OCCASION
    {
      title: "Style or Occasion",
      question: "Any style or occasion?",
      voiceScript: "Is this a classic dessert, a celebration, or something special?",
      inputType: "buttons",
      buttonOptions: [
        "Classic",
        "Celebration / Birthday",
        "Wedding",
        "Bakery-Style",
        "Simple & Light",
        "Rich & Indulgent",
      ],
      summaryPrefix: "Style",
      defaultValue: "Classic",
    },

    // 3 — SERVINGS
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many people are we serving?",
      inputType: "buttons",
      buttonOptions: [
        "Single",
        "2–4",
        "Family",
        "Batch",
        "Event / Wedding",
      ],
      summaryPrefix: "Servings",
      defaultValue: "2–4",
    },

    // 4 — DIETARY
    {
      title: "Dietary",
      question: "Any dietary needs?",
      voiceScript: "Any dietary preferences I should follow?",
      inputType: "buttons",
      buttonOptions: [
        "None",
        "Low Sugar",
        "Gluten-Free",
        "Dairy-Free",
        "High Protein",
        "Vegan",
      ],
      summaryPrefix: "Dietary",
      defaultValue: "None",
    },
  ],

  scripts: {
    ready: "Alright. I'll create your dessert.",
    generatingStart: "Putting it together.",
    generatingProgress1: "Balancing flavor and texture.",
    generatingProgress2: "Finalizing ingredients and steps.",
    complete: "Done. Let's head to Chef's Kitchen.",
  },

  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/craving-desserts",
  source: "dessert-studio",
  defaultMealType: "dessert",
  servingsStepIndex: 3,

  /**
   * PROMPT — HARD GUARDED
   * Category + Flavor lock the lane BEFORE creativity
   */
  buildPrompt: (values, servings) => {
    const [category, flavor, style, , dietary] = values;

    const parts: string[] = [];

    if (category === "Surprise Me") {
      parts.push("Create a dessert that fits the selected flavor and serving size.");
    } else {
      parts.push(`Dessert category: ${category}`);
    }

    parts.push(`Flavor family: ${flavor}`);
    parts.push(`Style or occasion: ${style}`);
    parts.push(`Servings: ${servings}`);

    if (dietary && dietary !== "None") {
      parts.push(`Dietary requirement: ${dietary}`);
    }

    parts.push("Do not invent unrelated flavors or ingredients.");

    return {
      craving: parts.join(". "),
      servings,
    };
  },
};

export default function DessertStudio() {
  return <StudioWizard config={DESSERT_STUDIO_CONFIG} />;
}
