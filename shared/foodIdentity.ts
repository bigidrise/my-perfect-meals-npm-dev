import { z } from "zod";

export const DESSERT_CATEGORY_LABELS: Record<string, string> = {
  pie: "Pie",
  cake: "Cake",
  cookies: "Cookies",
  brownies: "Brownies",
  cheesecake: "Cheesecake",
  smoothie: "Smoothie",
  frozen: "Frozen Dessert",
  pudding: "Pudding / Custard",
  nobake: "No-Bake Dessert",
  bars: "Bars",
  muffins: "Muffins",
  cupcakes: "Cupcakes",
};

export const foodRoleSchema = z.enum(["dessert", "general_snack"]);
export const foodPolaritySchema = z.enum(["sweet", "savory", "neutral"]);
export const foodFormatFamilySchema = z.enum([
  "cookie",
  "brownie",
  "cake",
  "cupcake",
  "cheesecake",
  "pudding_custard",
  "frozen_dessert",
  "bar",
  "muffin",
  "pie",
  "no_bake_dessert",
  "pastry",
  "confection",
  "general_sweet",
  "general_snack",
]);
export const foodPreparationStyleSchema = z.enum(["baked", "frozen", "chilled", "no_bake", "prepared", "raw"]);
export const foodTextureSchema = z.enum(["creamy", "crunchy", "chewy", "soft", "crisp", "smooth", "mixed"]);

export const foodIdentitySchema = z.object({
  foodRole: foodRoleSchema,
  polarity: foodPolaritySchema,
  formatFamily: foodFormatFamilySchema,
  preparationStyle: foodPreparationStyleSchema.optional(),
  texture: foodTextureSchema.optional(),
});
export type FoodIdentity = z.infer<typeof foodIdentitySchema>;

const DESSERT_PATTERNS: Array<{
  family: FoodIdentity["formatFamily"];
  label: string;
  pattern: RegExp;
  preparationStyle?: FoodIdentity["preparationStyle"];
}> = [
  { family: "cheesecake", label: "cheesecake", pattern: /\bcheese[\s-]?cake\b/i, preparationStyle: "baked" },
  { family: "frozen_dessert", label: "ice cream", pattern: /\b(ice[\s-]?cream|gelato|sorbet|frozen yogurt|frozen dessert)\b/i, preparationStyle: "frozen" },
  { family: "pudding_custard", label: "pudding", pattern: /\b(pudding|custard|flan|crème brûlée|creme brulee)\b/i, preparationStyle: "chilled" },
  { family: "no_bake_dessert", label: "no-bake dessert", pattern: /\bno[\s-]?bake\b/i, preparationStyle: "no_bake" },
  { family: "brownie", label: "brownie", pattern: /\bbrownie(s)?\b/i, preparationStyle: "baked" },
  { family: "cupcake", label: "cupcake", pattern: /\bcupcake(s)?\b/i, preparationStyle: "baked" },
  { family: "cookie", label: "cookie", pattern: /\b(cookie|biscuit)(s)?\b/i, preparationStyle: "baked" },
  { family: "muffin", label: "muffin", pattern: /\bmuffin(s)?\b/i, preparationStyle: "baked" },
  { family: "pastry", label: "pastry", pattern: /\b(pastry|danish|croissant|turnover|strudel|doughnut|donut)(s)?\b/i, preparationStyle: "baked" },
  { family: "confection", label: "confection", pattern: /\b(candy|fudge|truffle|confection)(s)?\b/i, preparationStyle: "prepared" },
  { family: "pie", label: "pie", pattern: /\bpie(s)?\b/i, preparationStyle: "baked" },
  { family: "cake", label: "cake", pattern: /\bcake(s)?\b/i, preparationStyle: "baked" },
  { family: "bar", label: "dessert bar", pattern: /\b(dessert|lemon|oat|date|cookie)[\s-]?bar(s)?\b/i, preparationStyle: "baked" },
];

export function classifyFoodIdentity(text: string): FoodIdentity {
  const normalized = String(text ?? "");
  const dessert = DESSERT_PATTERNS.find((entry) => entry.pattern.test(normalized));
  if (dessert) {
    return {
      foodRole: "dessert",
      polarity: "sweet",
      formatFamily: dessert.family,
      preparationStyle: dessert.preparationStyle,
    };
  }
  const sweet = /\b(sweet|chocolate|caramel|vanilla|fruit|berry|berries|cinnamon)\b/i.test(normalized);
  return {
    foodRole: "general_snack",
    polarity: sweet ? "sweet" : "savory",
    formatFamily: sweet ? "general_sweet" : "general_snack",
  };
}

export function protectedFoodIdentityLabel(text: string): string | null {
  return DESSERT_PATTERNS.find((entry) => entry.pattern.test(String(text ?? "")))?.label ?? null;
}