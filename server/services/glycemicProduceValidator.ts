import type { GlucoseState } from "./glucoseStateResolver";

const FRUITS = [
  "Apple", "Orange", "Pear", "Strawberries", "Blueberries", "Raspberries", "Blackberries",
  "Kiwi", "Grapefruit", "Peach", "Plum", "Cherries", "Tangerine", "Apricot", "Banana",
  "Cantaloupe", "Clementine", "Dates", "Dragon Fruit", "Figs", "Grapes", "Guava",
  "Honeydew Melon", "Jackfruit", "Kumquat", "Lychee", "Mango", "Nectarine", "Papaya",
  "Passion Fruit", "Persimmon", "Pineapple", "Pomegranate", "Prunes", "Raisins",
  "Star Fruit", "Watermelon",
];
const VEGETABLES = [
  "Artichoke", "Arugula", "Asparagus", "Beet Greens", "Bell Peppers", "Bok Choy", "Broccoli",
  "Broccoli Rabe", "Brussels Sprouts", "Cabbage", "Carrots", "Cauliflower", "Celery", "Chard",
  "Collard Greens", "Cucumber", "Dandelion Greens", "Eggplant", "Endive", "Fennel", "Garlic",
  "Green Beans", "Jicama", "Kale", "Kohlrabi", "Leeks", "Lettuce", "Mixed Greens", "Mushrooms",
  "Mustard Greens", "Okra", "Onions", "Radicchio", "Radishes", "Romaine", "Shallots",
  "Snap Peas", "Spinach", "Tomatoes", "Turnip Greens", "Turnips", "Watercress", "Zucchini",
];

export type GlycemicProduceCategory = "fruit" | "vegetable";

const CATEGORY_BY_CANONICAL = new Map<string, GlycemicProduceCategory>([
  ...FRUITS.map((item) => [item, "fruit"] as const),
  ...VEGETABLES.map((item) => [item, "vegetable"] as const),
]);

/**
 * Exact whole-produce subset of the existing medically governed
 * HYPO_TREATMENT_INGREDIENTS policy. Juice, dried fruit, bread, rice and other
 * non-produce treatments remain governed by the diabetic validator instead.
 */
export const HYPOGLYCEMIA_PRODUCE_OVERRIDES = [
  "Banana",
  "Pineapple",
  "Grapes",
  "Watermelon",
  "Mango",
  "Orange",
  "Raisins",
  "Dates",
] as const;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
function singularize(value: string): string {
  return value.endsWith("ies") ? `${value.slice(0, -3)}y` : value.endsWith("s") ? value.slice(0, -1) : value;
}
function pluralize(value: string): string {
  return value.endsWith("y") ? `${value.slice(0, -1)}ies` : value.endsWith("s") ? value : `${value}s`;
}
const CANONICALS = [...FRUITS, ...VEGETABLES];
const aliases = new Map<string, string>();
for (const canonical of CANONICALS) {
  const key = normalized(canonical);
  aliases.set(key, canonical);
  aliases.set(singularize(key), canonical);
  aliases.set(pluralize(key), canonical);
}
const SORTED_ALIASES = [...aliases.entries()].sort(([left], [right]) => right.length - left.length);

function matchesAlias(ingredient: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(ingredient);
}

export function canonicalProduceIn(ingredient: string): string | null {
  const value = normalized(ingredient);
  for (const [alias, canonical] of SORTED_ALIASES) {
    if (matchesAlias(value, alias)) return canonical;
  }
  return null;
}

export function classifyGlycemicProduce(
  ingredient: string,
): { canonical: string; category: GlycemicProduceCategory } | null {
  const canonical = canonicalProduceIn(ingredient);
  const category = canonical ? CATEGORY_BY_CANONICAL.get(canonical) : undefined;
  return canonical && category ? { canonical, category } : null;
}

export interface ProduceValidationInput {
  ingredients: string[];
  activePreferences: string[];
  preferencesConfigured: boolean;
  glucoseState: GlucoseState;
  /** Only passed callers may allow these canonical produce items during LOW. */
  safeLowGlucoseOverrides?: string[];
}

export interface ProduceValidationResult {
  allowed: boolean;
  violations: Array<{ ingredient: string; canonical: string; reason: "NOT_IN_CONFIGURED_ALLOWLIST" }>;
  overrideApplied: string[];
}

/** Enforces an explicit produce allowlist without treating arbitrary foods as produce. */
export function validateGlycemicProduce(input: ProduceValidationInput): ProduceValidationResult {
  if (!input.preferencesConfigured) return { allowed: true, violations: [], overrideApplied: [] };
  const allowed = new Set(
    input.activePreferences.map(canonicalProduceIn).filter((value): value is string => value !== null),
  );
  const overrideApplied: string[] = [];
  if (input.glucoseState === "LOW") {
    for (const override of input.safeLowGlucoseOverrides ?? []) {
      const canonical = canonicalProduceIn(override);
      if (canonical) {
        allowed.add(canonical);
        overrideApplied.push(canonical);
      }
    }
  }
  const violations = input.ingredients.flatMap((ingredient) => {
    const canonical = canonicalProduceIn(ingredient);
    return canonical && !allowed.has(canonical)
      ? [{ ingredient, canonical, reason: "NOT_IN_CONFIGURED_ALLOWLIST" as const }]
      : [];
  });
  return { allowed: violations.length === 0, violations, overrideApplied };
}