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
You MUST apply the following style characteristics to this meal:

- Use bold, layered flavors with confident, intentional seasoning profiles
- Favor grilling, searing, or high-heat cooking methods when appropriate
- Include rich sauces, marinades, or seasoning blends where compatible with constraints
- Avoid bland, minimal, or under-seasoned output unless required by medical or dietary rules
- Meals should feel like they came from a skilled chef's kitchen — assertive, flavorful, purposeful

These style rules are mandatory unless they directly conflict with medical, dietary, or macro constraints already set.
    `.trim(),
  },
};
