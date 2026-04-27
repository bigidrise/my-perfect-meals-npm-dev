// server/services/creatorSystems/registry.ts
// Creator System Registry — plug-and-play slot for chef/coach/professional kitchens.
// Phase 1: pipe only. Add new systems here when a creator is onboarded.

export type CreatorSystemType = "system" | "chef" | "coach" | "physician" | "performance";

export interface CreatorSystem {
  id: string;
  name: string;
  type: CreatorSystemType;
  // Which engine types this system applies to.
  // The transformer checks this before applying — a baker system won't touch meals.
  supports: {
    meals: boolean;
    desserts: boolean;
    beverages: boolean;
  };
  // Injected into the 2-pass transformation prompt AFTER base generation.
  // Never overrides dietary/medical/macro guardrails — style only.
  stylePrompt?: string;
}

export const creatorSystems: Record<string, CreatorSystem> = {
  default: {
    id: "default",
    name: "My Perfect Meals",
    type: "system",
    supports: { meals: false, desserts: false, beverages: false },
    // No stylePrompt — standard MPM generation, no transformation pass runs
  },

  test_system: {
    id: "test_system",
    name: "Test Chef System",
    type: "chef",
    supports: { meals: true, desserts: true, beverages: false },
    stylePrompt: `
You MUST restyle this meal using the following chef-level rules:

COOKING METHOD:
- Use high-heat techniques such as searing, charring, blackening, or roasting when appropriate
- Protein must be described with its technique (e.g., "blackened", "charred", "seared", "pan-roasted") — never use generic terms like "grilled" or "cooked"
- Include a sauce-building or deglazing step in the instructions whenever compatible with constraints

FLAVOR BUILDING:
- Build layered flavor using at least 3 elements (e.g., spice blend + aromatics + acid or finishing fat)
- Include a defined sauce, glaze, pan reduction, or compound butter whenever compatible with constraints
- Never produce a flat or one-note seasoning profile

INGREDIENT EXPRESSION:
- Use descriptive ingredient language (e.g., "garlic-infused oil", "smoky Cajun spice blend", "toasted cumin")
- Avoid plain ingredient naming when a richer description is possible and accurate

NAMING:
- Meal names MUST include the cooking technique and/or the dominant flavor identity
- Format: "[Technique] [Protein] [Base] with [Sauce/Flavor]"
- CORRECT: "Blackened Cajun Chicken Pasta with Garlic Herb Pan Sauce"
- INCORRECT: "Spicy Chicken Pasta" or "Cajun Chicken Pasta" (too generic)

DESCRIPTIONS:
- Do NOT use generic filler phrases: "zesty", "delicious", "delightful", "simple", "easy", "light", "tasty", "refreshing", "vibrant", "satisfying", "hearty", "flavorful"
- Describe the cooking process and the flavor result instead
- CORRECT: "High-heat blackened chicken tossed with pasta and finished in a garlic herb pan sauce built from Cajun spices and aromatics for a layered, smoky flavor"

INSTRUCTIONS:
- Each step must be specific — include heat level, visual cues, timing, and technique
- CORRECT: "Sear chicken over high heat 3–4 min per side until a dark golden crust forms"
- INCORRECT: "Cook chicken until done"
- Include a dedicated protein preparation step (sear/roast/char) with time and visual cue
- Include a sauce-building step that shows the sequence: sauté aromatics → deglaze → reduce → finish

TITLE ENFORCEMENT:
- The meal name MUST start with or include the protein's cooking technique
- CORRECT: "Pan-Seared Chicken Pasta with Sun-Dried Tomato Cream Reduction"
- INCORRECT: "Creamy Sun-Dried Tomato Chicken Pasta" (no technique, starts with descriptor)
    `.trim(),
  },
};
