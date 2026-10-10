/** Optional selections; choosing one establishes culinary intent, not a diet or destination. */
export const CRAVING_CATEGORIES = [
  { value: "surprise", label: "Surprise Me!" },
  { value: "burgers-sandwiches", label: "Burgers & Sandwiches" },
  { value: "pizza-flatbreads", label: "Pizza & Flatbreads" },
  { value: "fried-crispy", label: "Fried & Crispy Foods" },
  { value: "mexican-tex-mex", label: "Mexican & Tex-Mex" },
  { value: "pasta-noodles", label: "Pasta & Noodles" },
  { value: "comfort-food", label: "Comfort Food" },
  { value: "breakfast", label: "Breakfast Favorites" },
  { value: "asian", label: "Asian Favorites" },
  { value: "seafood", label: "Seafood Favorites" },
  { value: "bbq-grilled", label: "BBQ & Grilled Favorites" },
  { value: "snacks-finger-foods", label: "Snacks & Finger Foods" },
  { value: "sweet", label: "Sweet Cravings" },
  { value: "shakes-smoothies", label: "Shakes & Smoothies" },
  { value: "something-else", label: "Something Else" },
] as const;

// Preserve the lower diet dropdown's unique choices in Craving's top control.
export const CRAVING_EXTRA_DIET_OPTIONS = [
  { value: "dairy-free", label: "Dairy-Free" },
  { value: "mediterranean", label: "Mediterranean" },
];

export type CravingCategoryValue = typeof CRAVING_CATEGORIES[number]["value"];

export const CRAVING_CATEGORY_IDENTITIES: Record<CravingCategoryValue, string> = {
  surprise: "Choose varied appropriate dish forms; do not force one food family.",
  "burgers-sandwiches": "Recognizable burgers and sandwiches, with patties/fillings and an assembled bun, bread or suitable dietary-adapted vessel. Not loose stir-fries or generic bowls.",
  "pizza-flatbreads": "Recognizable pizza or topped flatbread, with an actual base and toppings, including appropriate dietary-adapted bases.",
  "fried-crispy": "Foods whose defining experience is fried or crisp/crunchy preparation; use compatible lighter, baked or air-fried adaptations when needed.",
  "mexican-tex-mex": "Recognizable Mexican/Tex-Mex dish forms and preparations, not an unrelated dish merely renamed Mexican. Combine an explicit other cuisine through an honest compatible fusion.",
  "pasta-noodles": "Pasta or noodle dishes whose central structure is noodles, including suitable low-carb or other dietary-adapted noodles.",
  "comfort-food": "Recognizable comforting home-style dishes with distinct forms/preparations, rather than three generic protein-and-vegetable plates.",
  breakfast: "Recognizable breakfast foods and preparations; vary the actual dish experience, not just the protein.",
  asian: "Recognizable Asian dish forms and preparations. Vary forms, techniques and components rather than returning three interchangeable stir-fries.",
  seafood: "Seafood-centered dishes or recognizable safe seafood-style adaptations when diet/allergies require them. Never introduce a prohibited seafood ingredient.",
  "bbq-grilled": "Recognizable grilled, smoked or barbecue preparations, supported by actual cooking steps/components. Not stir-fries with a BBQ title.",
  "snacks-finger-foods": "Recognizable snack or hand-held/finger-food formats; do not silently substitute full generic meal plates.",
  sweet: "An individual sweet treat or small craving, not a whole dessert or batch by default. Preserve a recognizable sweet food experience with safe substitutions.",
  "shakes-smoothies": "Actual drinkable shakes or smoothies with blending/liquid preparation, not solid bowls with a smoothie title. They can be meals or snacks.",
  "something-else": "Honor the open-ended food request without imposing an unrelated category; choose varied appropriate foods when no dish is named.",
};

export function buildCravingCategoryPrompt(value: unknown): string {
  const category = CRAVING_CATEGORIES.find(option => option.value === value);
  if (!category) return "";
  return [
    `[OPTIONAL CRAVING CATEGORY: ${category.label}]`,
    "The explicit craving description takes priority if clearly incompatible; otherwise every option MUST preserve the selected food family's recognizable identity. A blank craving makes the selected category the dish-identity authority.",
    "Preserve the selected diet, cuisine, cooking method, serving count and meal/snack destination. This category is not a dietary restriction, clinical rule or meal-slot assignment.",
    CRAVING_CATEGORY_IDENTITIES[category.value],
    "Adapt ingredients, vessels, preparation and portions under mandatory safety restrictions; never silently replace the selected food experience with unrelated generic meals.",
    "Create three meaningfully different dishes within this intent. Changing only the protein, name or seasoning does not create a distinct recipe.",
    category.value === "sweet"
      ? "For Sweet Cravings, suggest an individual sweet treat or small craving, not a whole dessert or batch by default."
      : "",
    category.value === "shakes-smoothies"
      ? "Shakes and smoothies can be meals or snacks. Keep the user's existing destination; do not force a snack or beverage slot."
      : "",
  ].filter(Boolean).join("\n");
}
