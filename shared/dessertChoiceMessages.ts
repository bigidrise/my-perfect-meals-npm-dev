// Canonical English evidence for Dessert's four bounded choice failures.
// Keep validation/repair inputs unchanged; only the client display is localized.
export const DESSERT_CHOICE_MESSAGES = {
  identity: "Dessert identity could not be verified.",
  incomplete: "The dessert must include ingredients and complete preparation instructions.",
  finalChecks: "The final dessert did not pass recipe safety and identity checks.",
  budget: "No distinct dessert passed the recipe checks within this request's generation budget.",
} as const;

export type DessertChoiceMessage =
  typeof DESSERT_CHOICE_MESSAGES[keyof typeof DESSERT_CHOICE_MESSAGES];
