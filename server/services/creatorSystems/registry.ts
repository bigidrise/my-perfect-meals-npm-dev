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
Bold flavors, high seasoning, and layered taste profiles.
Emphasize grilling, searing, and rich sauces.
Prefer hearty portions with distinct, confident seasoning.
Meals should feel like they came from a skilled chef's kitchen — intentional, flavorful, not bland.
Apply this style without violating any dietary, medical, or macro constraints already set.
    `.trim(),
  },
};
