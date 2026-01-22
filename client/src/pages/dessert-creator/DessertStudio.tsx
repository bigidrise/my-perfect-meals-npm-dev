import { Cake } from "lucide-react";
import StudioWizard, { StudioConfig } from "@/components/studio-wizard/StudioWizard";
/**
 * DESSERT STUDIO — GUARDED & NON-GENERIC
 * Category → Flavor → Style → Servings → Dietary
 * Category + Flavor lock the lane BEFORE AI gets creative
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
      voiceScript: "What type of dessert are we making?",
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
      otherEnabled: true,
      otherPlaceholder: "e.g., Trifle, Tiramisu, Cr\u00e8me br\u00fbl\u00e9e...",
    },

    // 1 — FLAVOR FAMILY
    {
      title: "Flavor",
      question: "Pick a flavor direction",
      voiceScript: "and what's the flavor going to be?",
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
      otherEnabled: true,
      otherPlaceholder: "e.g., Matcha, Lavender, Maple...",
    },

    // 2 — STYLE / OCCASION
    {
      title: "Style or Occasion",
      question: "Style or occasion?",
      voiceScript:
      "What are we making this for — just a regular treat, a birthday, a wedding… and do you want it light, classic, bakery-style, or indulgent?",

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

    // 3 — SERVINGS (people-based)
    {
      title: "Servings",
      question: "How many servings?",
      voiceScript: "How many servings?",
      inputType: "buttons",
      buttonOptions: [
        "Just me",
        "2 people",
        "4 people",
        "6 people",
        "8+ people",
      ],
      summaryPrefix: "Servings",
      defaultValue: "2 people",
    },

    // 4 — DIETARY (Yes/No pattern matching Chef's Kitchen Step 3)
    {
      title: "Dietary",
      question: "Any dietary needs or preferences?",
      voiceScript: "Any dietary preferences I should follow?",
      inputType: "yesno",
      summaryPrefix: "Dietary",
      placeholder: "e.g., low sugar, gluten-free, dairy-free, high protein, vegan...",
      yesnoConfig: {
        noLabel: "No, I'm good",
        yesLabel: "Yes, add preferences",
        noValue: "None",
        yesPlaceholder: "e.g., low sugar, gluten-free, dairy-free, high protein, vegan...",
      },
    },
  ],

  scripts: {
    ready: "If everything looks good, press generate meal.",
    generatingStart: "",
    generatingProgress1: "",
    generatingProgress2: "",
    complete: "If you happy with your meal tap, Enter Chef’s Kitchen, and we’ll start cooking, if not, press Create New, and we can create a new meal.",
  },

  apiEndpoint: "/api/craving-creator/generate",
  backRoute: "/craving-desserts",
  source: "dessert-studio",
  defaultMealType: "dessert",
  servingsStepIndex: 3,

  /**
   * PROMPT — HARD GUARDED
   * Category + Flavor + Style lock the lane BEFORE creativity
   * Never allow "healthy alternatives" like avocado mousse
   */
  buildPrompt: (values, servings) => {
    const [category, flavor, style, servingsText, dietary] = values;

    const parts: string[] = [];

    // Parse servings from text like "Just me", "2 people", "8+ people"
    let numServings = servings;
    if (servingsText) {
      if (servingsText.includes("Just me")) numServings = 1;
      else if (servingsText.includes("2")) numServings = 2;
      else if (servingsText.includes("4")) numServings = 4;
      else if (servingsText.includes("6")) numServings = 6;
      else if (servingsText.includes("8+")) numServings = 10;
    }

    // Determine the actual dessert type to create
    let dessertType = category;
    
    // If "Surprise Me" is selected, pick a classic dessert type based on style
    if (category === "Surprise Me") {
      if (style === "Celebration / Birthday" || style === "Wedding") {
        dessertType = "Cake";
        parts.push(`Create a classic ${flavor.toLowerCase()} celebration cake.`);
      } else if (style === "Bakery-Style") {
        dessertType = "Cookies or Brownies";
        parts.push(`Create a classic bakery-style ${flavor.toLowerCase()} dessert like cookies, brownies, or bars.`);
      } else if (style === "Simple & Light") {
        dessertType = "Light Dessert";
        parts.push(`Create a simple, light ${flavor.toLowerCase()} dessert like a mousse, pudding, or fruit-based treat.`);
      } else if (style === "Rich & Indulgent") {
        dessertType = "Rich Dessert";
        parts.push(`Create a rich, indulgent ${flavor.toLowerCase()} dessert like a layered cake, cheesecake, or brownie sundae.`);
      } else {
        parts.push(`Create a classic ${flavor.toLowerCase()} dessert. Choose from: cake, pie, cookies, brownies, or bars.`);
      }
    } else {
      // Specific category selected
      parts.push(`Dessert type: ${category}`);
      parts.push(`Flavor: ${flavor}`);
      parts.push(`Style: ${style}`);
    }

    parts.push(`Servings: ${numServings}`);

    if (dietary && dietary !== "None") {
      parts.push(`Dietary requirement: ${dietary}`);
    }

    // HARD CONSTRAINTS to prevent weird AI creativity
    parts.push("IMPORTANT: Create a traditional, recognizable dessert.");
    parts.push("Do NOT use avocado, vegetables, or unconventional 'healthy' substitutes.");
    parts.push("Do NOT invent fusion or experimental desserts.");
    parts.push("Use real butter, sugar, flour, eggs, and chocolate as appropriate.");
    parts.push("The dessert should look and taste like what someone would expect from a bakery.");

    return {
      craving: parts.join(" "),
      servings: numServings,
    };
  },
};

export default function DessertStudio() {
  return <StudioWizard config={DESSERT_STUDIO_CONFIG} />;
}
