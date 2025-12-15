export type MenToggleId =
  | "testosterone_basics"
  | "metabolic_reset"
  | "recovery_sleep"
  | "lean_mass_focus";

export const MEN_TOGGLES = [
  {
    id: "testosterone_basics" as const,
    label: "Testosterone Basics",
    blurb: "Protein-forward, zinc/selenium, omega-3 emphasis.",
    hintTags: ["protein-forward","zinc-rich","selenium-source","omega-3"],
    presetBias: ["oily-fish","shellfish","eggs-lean-red-meat-1to2xwk"],
  },
  {
    id: "metabolic_reset" as const,
    label: "Metabolic Reset",
    blurb: "High-fiber carbs, lower added sugar, protein + veg first.",
    hintTags: ["high-fiber-carb","lower-added-sugar","protein-veg-first"],
    presetBias: ["beans-lentils","whole-grains","lean-protein"],
  },
  {
    id: "recovery_sleep" as const,
    label: "Recovery & Sleep",
    blurb: "Evening-lighter, magnesium-friendly, caffeine earlier.",
    hintTags: ["evening-lighter","magnesium-friendly","caffeine-earlier"],
    presetBias: ["yogurt-banana-kiwi","lighter-dinners"],
  },
  {
    id: "lean_mass_focus" as const,
    label: "Lean Mass Focus",
    blurb: "30–45g protein/meal, post-lift carb ideas.",
    hintTags: ["protein-30to45","post-lift-carb"],
    presetBias: ["high-protein-breakfasts","post-lift-snacks"],
  },
] as const;
