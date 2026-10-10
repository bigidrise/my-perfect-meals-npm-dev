/** Optional culinary guidance, never dietary identities or meal destinations. */
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

export function buildCravingCategoryPrompt(value: unknown): string {
  const category = CRAVING_CATEGORIES.find(option => option.value === value);
  if (!category) return "";
  return [
    `[OPTIONAL CRAVING CATEGORY: ${category.label}]`,
    "Use this only as soft guidance for the kind of food to suggest. The explicit craving description takes priority if it conflicts; ignore the category rather than replacing the requested food.",
    "Preserve the selected diet, cuisine, cooking method, serving count and meal/snack destination. This category is not a dietary restriction, cuisine requirement, rejection rule or meal-slot assignment.",
    category.value === "surprise" || category.value === "something-else"
      ? "Choose a suitable food style when the user has not named a food; otherwise honor their request."
      : "Prefer this food family only when compatible with the user's explicit request and existing requirements.",
    category.value === "sweet"
      ? "For Sweet Cravings, suggest an individual sweet treat or small craving, not a whole dessert or batch by default."
      : "",
    category.value === "shakes-smoothies"
      ? "Shakes and smoothies can be meals or snacks. Keep the user's existing destination; do not force a snack or beverage slot."
      : "",
  ].filter(Boolean).join("\n");
}
