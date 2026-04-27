// server/services/creatorSystems/registry.ts
// Creator System Registry — plug-and-play slot for chef/coach/professional kitchens.
// Phase 1: pipe only. Add new systems here when a creator is onboarded.

export type CreatorSystemType = "system" | "chef" | "coach" | "physician" | "performance";

export interface CreatorSystem {
  id: string;
  name: string;
  type: CreatorSystemType;
  // Phase 2: injected into the generation prompt AFTER constraints are set.
  // Never overrides dietary/medical/macro guardrails — style only.
  stylePrompt?: string;
}

export const creatorSystems: Record<string, CreatorSystem> = {
  default: {
    id: "default",
    name: "My Perfect Meals",
    type: "system",
    // No stylePrompt — standard MPM generation
  },

  test_system: {
    id: "test_system",
    name: "Test System",
    type: "chef",
    stylePrompt: `
You MUST construct the meal using the following chef-level rules:

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
- CORRECT: "Blackened Cajun Chicken Pasta with Garlic Herb Pan Sauce"
- INCORRECT: "Spicy Chicken Pasta" or "Cajun Chicken Pasta" (too generic)

DESCRIPTIONS:
- Do NOT use generic filler phrases: "zesty", "delicious", "delightful", "simple", "easy", "light", "tasty"
- Describe the cooking process and the flavor result instead
- CORRECT: "High-heat blackened chicken tossed with pasta and finished in a garlic herb pan sauce built from Cajun spices and aromatics for a layered, smoky flavor"

INSTRUCTIONS:
- Each step must be specific — include heat level, visual cues, timing, and technique
- CORRECT: "Sear chicken over high heat 3–4 min per side until a dark golden crust forms"
- INCORRECT: "Cook chicken until done"

PROTEIN PREPARATION (MANDATORY):
- The primary protein MUST be prepared using a defined high-heat or technique-based method (e.g., seared, blackened, pan-crusted, roasted)
- The cooking process MUST include at least one transformation step (e.g., searing followed by deglazing to build a sauce)
- The protein preparation technique MUST appear in the meal name

SAUCE DEVELOPMENT (MANDATORY):
- If a sauce is present, it must be built through a process: sauté aromatics → deglaze → reduce → finish
- Never list sauce ingredients as simply combined — show the build in the instructions

TITLE ENFORCEMENT:
- The meal name MUST start with or include the protein's cooking technique
- CORRECT: "Pan-Seared Chicken Pasta with Sun-Dried Tomato Cream Reduction"
- INCORRECT: "Creamy Sun-Dried Tomato Chicken Pasta" (no technique, starts with descriptor)
- Never start a meal name with "Creamy", "Spicy", or "Delicious" without a technique word preceding it

RESPONSE FORMAT REQUIREMENTS (MANDATORY — INVALID IF NOT FOLLOWED):

1. The meal name MUST include:
   - A cooking technique (Pan-Seared, Blackened, Charred, Roasted, Pan-Crusted)
   - A flavor or sauce component (Garlic Herb Sauce, Lemon Butter Glaze, Cajun Reduction)
   - Format: "[Technique] [Protein] [Base] with [Sauce/Flavor]"
   - A response that omits the technique from the name is INVALID

2. The instructions MUST include:
   - A dedicated high-heat step for the protein (sear, char, roast) with time and visual cue
   - A sauce-building step that shows the sequence: sauté → deglaze → reduce → finish
   - These steps MUST appear explicitly — not implied or merged with other steps
   - A response that skips these steps is INVALID

3. The description MUST:
   - Explain HOW the dish is built (technique + flavor result)
   - Never use these words: "delicious", "flavorful", "fragrant", "hearty", "tasty", "satisfying"
   - A description that uses generic adjectives instead of process language is INVALID

SELF-CHECK (before finalizing your response, verify):
- Does the meal name include a cooking technique word?
- Does the protein have an explicit searing or roasting step with timing?
- Does the sauce have a build process (sauté → deglaze → reduce)?
- Is the description free of generic filler words?

If any answer is NO — rewrite that section before responding.

The final dish must feel like a deliberate, chef-driven creation — not a basic or neutral recipe.

These rules are mandatory unless they directly conflict with medical, dietary, or macro constraints.
    `.trim(),
  },
};
