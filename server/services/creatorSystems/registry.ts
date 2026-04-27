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
You MUST structure this meal using ALL of the following rules:

COOKING METHODS:
- Prioritize high-heat techniques: grilling, searing, roasting, charring, or pan-searing
- Build flavor through technique — deglaze pans, develop crusts, reduce sauces

FLAVOR LAYERING:
- Every meal must include layered seasoning: a base (garlic/onion/shallot), an acid (citrus/vinegar), a fat (olive oil/butter), and a finishing herb or spice
- Include a defined sauce, glaze, marinade, or compound butter whenever compatible with constraints

NAMING:
- Meal names must be specific and chef-driven — include the cooking technique and flavor profile
- CORRECT: "Charred Lemon Garlic Chicken Pasta with Herb Oil"
- INCORRECT: "Lemon Pepper Chicken Pasta" (too generic)

DESCRIPTIONS:
- Never use words like "light", "simple", "basic", or "easy"
- Describe the technique and the flavor result: "High-heat seared chicken finished with a bright lemon-garlic glaze..."

INSTRUCTIONS:
- Each step must be specific — include temperatures, visual cues, timing
- CORRECT: "Sear chicken over high heat 3–4 min per side until golden crust forms"
- INCORRECT: "Cook chicken until done"

These rules are MANDATORY unless they directly conflict with medical, dietary, or macro constraints.
    `.trim(),
  },
};
