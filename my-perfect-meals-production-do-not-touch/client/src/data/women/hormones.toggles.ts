export type WomenToggleId =
  | "cycle_comfort"
  | "stable_mood_energy"
  | "menopause_support"
  | "metabolic_balance";

export const WOMEN_TOGGLES = [
  {
    id: "cycle_comfort" as const,
    label: "Cycle Comfort",
    blurb: "Gentle, bloat-friendly, iron-supportive suggestions.",
    hintTags: ["cycle-aware", "easy-on-bloat", "higher-iron"],
    presetBias: ["warm-breakfasts", "iron-support", "lower-sodium"],
  },
  {
    id: "stable_mood_energy" as const,
    label: "Stable Mood & Energy",
    blurb: "Protein-forward, fiber-rich, slow-release carbs.",
    hintTags: ["protein-forward", "high-fiber-carb", "slow-release"],
    presetBias: ["protein-25to45", "oats-beans-berries-quinoa"],
  },
  {
    id: "menopause_support" as const,
    label: "Menopause Support",
    blurb: "Protein + calcium, phyto-friendly, omega-3 emphasis.",
    hintTags: ["protein-calcium", "phyto-friendly", "omega-3"],
    presetBias: ["soy-legumes", "fatty-fish", "sprouted-grain"],
  },
  {
    id: "metabolic_balance" as const,
    label: "Metabolic Balance",
    blurb: "High-fiber swaps, lower added sugar, protein+veg first.",
    hintTags: ["high-fiber-carb", "lower-added-sugar", "protein-veg-first"],
    presetBias: ["beans-lentils", "whole-grains", "lean-protein"],
  },
] as const;
