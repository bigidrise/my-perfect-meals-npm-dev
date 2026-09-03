export interface DiversityContext {
  usedBases: Record<string, number>;
  usedTypes: Record<string, number>;
}

const ARCHETYPE_PATTERNS: Array<{ archetype: string; keywords: string[] }> = [
  { archetype: "stir-fry", keywords: ["stir fry", "stir-fry", "stir fried", "stir-fried"] },
  { archetype: "soup", keywords: ["soup", "stew", "chili", "bisque", "broth", "chowder", "curry"] },
  { archetype: "pasta", keywords: ["pasta", "noodle", "spaghetti", "linguine", "fettuccine", "penne", "rigatoni", "lasagna", "ramen", "udon", "lo mein"] },
  { archetype: "sandwich", keywords: ["sandwich", "toast", "burger", "sub", "hoagie", "panini", "melt", "flatbread"] },
  { archetype: "wrap", keywords: ["wrap", "burrito", "taco", "quesadilla", "fajita"] },
  { archetype: "salad", keywords: ["salad"] },
  { archetype: "bowl", keywords: ["bowl"] },
  { archetype: "skillet", keywords: ["skillet", "hash", "scramble", "frittata", "omelette", "omelet", "steak", "sauté", "saute"] },
];

const BASE_KEYWORDS: string[] = [
  "quinoa",
  "rice",
  "pasta",
  "lentil",
  "chickpea",
  "tofu",
  "tempeh",
  "chicken",
  "beef",
  "salmon",
  "tuna",
  "shrimp",
  "turkey",
  "black bean",
  "sweet potato",
  "oat",
  "egg",
  "cauliflower",
  "broccoli",
  "zucchini",
  "mushroom",
  "farro",
  "barley",
  "millet",
  "edamame",
];

export function detectArchetype(mealName: string): string | null {
  const lower = mealName.toLowerCase();
  for (const { archetype, keywords } of ARCHETYPE_PATTERNS) {
    if (keywords.some((k) => lower.includes(k))) {
      return archetype;
    }
  }
  return null;
}

export function detectBase(
  mealName: string,
  ingredients?: Array<{ name: string }>,
): string | null {
  const sources: string[] = [];

  if (ingredients && ingredients.length > 0) {
    sources.push(
      ...ingredients
        .slice(0, 5)
        .map((i) => i.name.toLowerCase()),
    );
  }
  sources.push(mealName.toLowerCase());

  const combined = sources.join(" ");
  for (const base of BASE_KEYWORDS) {
    if (combined.includes(base)) {
      return base;
    }
  }
  return null;
}

export function buildDiversityContext(
  meals: Array<{ name?: string; title?: string; ingredients?: Array<{ name: string }> }>,
): DiversityContext {
  const usedBases: Record<string, number> = {};
  const usedTypes: Record<string, number> = {};

  for (const meal of meals) {
    const name = meal?.name || meal?.title || "";
    if (!name) continue;

    const archetype = detectArchetype(name);
    if (archetype) {
      usedTypes[archetype] = (usedTypes[archetype] || 0) + 1;
    }

    const base = detectBase(name, meal.ingredients);
    if (base) {
      usedBases[base] = (usedBases[base] || 0) + 1;
    }
  }

  return { usedBases, usedTypes };
}
