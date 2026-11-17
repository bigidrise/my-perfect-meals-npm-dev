/** Restaurant-specific culinary intent. This is not a clinical/safety contract. */
export interface RestaurantCuisineContext {
  saved: string | null;
  explicit: string | null;
  observed: string | null;
  displayLanguage: string;
  note: string | null;
}

export function normalizeRestaurantCuisine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase().replace(/[_/–—-]+/g, " ").replace(/\s+/g, " ");
  if (!text || ["unknown", "unsure", "auto", "none", "not set", "other"].includes(text)) return null;
  const aliases: Record<string, string> = {
    "chinese american": "chinese-american", "american chinese": "chinese-american",
    "american casual": "american", "fast casual american": "american",
    "bbq american smokehouse": "american", "burger": "american",
    "japanese sushi": "japanese",
  };
  return aliases[text] || text;
}

export function restaurantCuisineNote(context: Omit<RestaurantCuisineContext, "note">): string | null {
  const { saved, explicit, observed } = context;
  if (explicit && observed && explicit !== observed) {
    return `You requested ${explicit} cuisine, but this restaurant is classified as ${observed}. We cannot confirm matching dishes here. Choose another restaurant or change the cuisine for this request. Your profile has not been changed.`;
  }
  if (!explicit && saved && observed && saved !== observed) {
    return `Your saved cuisine preference is ${saved}. This restaurant is classified as ${observed}, so recommendations stay within its menu rather than inventing ${saved} dishes. You can choose another restaurant or request a different cuisine.`;
  }
  if (!observed) return "This restaurant's cuisine could not be verified. Any suggestions are unverified ideas, not confirmation of its current menu. Confirm availability and ingredients with the venue.";
  return null;
}

export function restaurantCuisinePrompt(context?: RestaurantCuisineContext): string {
  if (!context) return "";
  return [
    "RESTAURANT CUISINE AUTHORITY (never overrides allergies, dietary or physician-directed restrictions):",
    `Saved cuisine guidance: ${context.saved || "not set"} (soft preference only).`,
    `Explicit cuisine for this action: ${context.explicit || "not set"}.`,
    `Observed restaurant cuisine: ${context.observed || "unknown; do not infer American"}.`,
    "An explicit action takes precedence over saved cuisine, but never invent dishes unsupported by this restaurant.",
    "Chinese and Chinese-American are distinct. Never silently substitute one for the other.",
    context.explicit
      ? `Each returned meal/selection MUST include a cuisine field equal to "${context.explicit}". Return no recommendations if this cannot be satisfied. Do not relabel a foreign dish to claim compliance.`
      : "Use the saved preference where the actual restaurant supports it, without excluding the user's choice of a different restaurant.",
    context.note || "",
  ].filter(Boolean).join("\n");
}

// Bounded contradictions supplement (not replace) the model's structured cuisine
// declaration. They are deliberately not a claim of independent authenticity.
const unmistakableDishFamilies: Array<[RegExp, string[]]> = [
  [/\b(?:cheeseburger|hamburger|hot dog|turkey club|caesar salad|mac(?:aroni)? and cheese)\b/i, ["american"]],
  [/\b(?:burrito|quesadilla|enchilada)\b/i, ["mexican"]],
  [/\b(?:spaghetti carbonara|fettuccine alfredo|lasagna)\b/i, ["italian"]],
  [/\b(?:sashimi|nigiri)\b/i, ["japanese"]],
];

export function restaurantMealHonorsCuisine(meal: any, context?: RestaurantCuisineContext): boolean {
  if (!context?.explicit) return true;
  const candidate = meal?.meal && typeof meal.meal === "object" ? meal.meal : meal;
  const declared = normalizeRestaurantCuisine(meal?.cuisine ?? candidate?.cuisine);
  if (declared !== context.explicit) return false;
  const name = String(candidate?.name ?? "");
  if (context.explicit === "chinese" && (/\b(?:rou jia mo|roujiamo)\b/i.test(name) || /肉夹馍/.test(name))) {
    return true; // "Chinese hamburger" is also a legitimate translation of rou jia mo.
  }
  return !unmistakableDishFamilies.some(([pattern, cuisines]) =>
    pattern.test(name) && !cuisines.includes(context.explicit!));
}

export interface RestaurantResultContext {
  owner: string;
  saved: string | null;
  explicit: string | null;
}

export function restaurantResultContextMatches(
  previous: RestaurantResultContext | undefined,
  current: RestaurantResultContext,
): boolean {
  return Boolean(previous && previous.owner === current.owner &&
    normalizeRestaurantCuisine(previous.saved) === normalizeRestaurantCuisine(current.saved) &&
    normalizeRestaurantCuisine(previous.explicit) === normalizeRestaurantCuisine(current.explicit));
}
