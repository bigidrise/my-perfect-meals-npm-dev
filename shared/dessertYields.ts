/** Dessert-only cooking yields. The existing servingSize string carries the selection. */
export interface DessertYield {
  value: string;
  count: number;
  label: string;
  portion: string;
  tiers?: number;
}
const choice = (value: string, count: number, label: string, portion: string): DessertYield =>
  ({ value, count, label, portion });
export const LEGACY_DESSERT_YIELDS: Record<string, DessertYield> = {
  single: choice("single", 1, "1 serving", "serving"),
  two: choice("two", 2, "2 servings", "serving"),
  family: choice("family", 6, "6 servings (family-style)", "serving"),
  batch: choice("batch", 12, "12 servings (batch)", "serving"),
  "small-wedding": { ...choice("small-wedding", 40, "Small Wedding (30–50 guests)", "slice"), tiers: 2 },
  "medium-wedding": { ...choice("medium-wedding", 88, "Medium Wedding (75–100 guests)", "slice"), tiers: 3 },
  "large-wedding": { ...choice("large-wedding", 135, "Large Wedding (120–150 guests)", "slice"), tiers: 3 },
  "extra-large-wedding": { ...choice("extra-large-wedding", 200, "Large Event (200+ guests)", "slice"), tiers: 4 },
};
export function dessertYieldOptions(category: string): DessertYield[] {
  if (category === "pie" || category === "cheesecake") {
    const name = category === "pie" ? "pie" : "cheesecake";
    return [choice(`${category}-9-8`, 8, `Whole 9-inch ${name} · 8 slices`, "slice"),
      choice(`${category}-9-12`, 12, `Whole 9-inch ${name} · 12 slices`, "slice"),
      choice(`${category}-6-6`, 6, `Whole 6-inch ${name} · 6 slices`, "slice")];
  }
  if (["brownies", "bars", "nobake"].includes(category)) {
    const pans = [choice(`${category}-9x13-12`, 12, "9×13-inch pan · 12 pieces", "piece"),
      choice(`${category}-9x13-24`, 24, "9×13-inch pan · 24 pieces", "piece"),
      choice(`${category}-8x8-6`, 6, "8×8-inch pan · 6 pieces", "piece")];
    return category === "nobake" ? [...pans, choice("nobake-individual-1", 1, "1 individual dessert", "serving"),
      choice("nobake-individual-6", 6, "6 individual desserts", "serving")] : pans;
  }
  if (["cookies", "muffins", "cupcakes"].includes(category)) {
    const singular = { cookies: "cookie", muffins: "muffin", cupcakes: "cupcake" }[category]!;
    return [choice(`${category}-12`, 12, `Batch of 12 ${category}`, singular),
      choice(`${category}-24`, 24, `Batch of 24 ${category}`, singular),
      choice(`${category}-6`, 6, `Batch of 6 ${category}`, singular)];
  }
  if (category === "cake") return [
    choice("cake-9-2-12", 12, "Whole 9-inch round · 2 layers · 12 slices", "slice"),
    choice("cake-6-2-6", 6, "Whole 6-inch round · 2 layers · 6 slices", "slice"),
    choice("cake-9x13-24", 24, "Whole 9×13-inch sheet cake · 24 pieces", "piece"),
  ];
  const individual = [choice("individual-1", 1, "1 individual dessert", "serving"),
    choice("individual-2", 2, "2 individual desserts", "serving"),
    choice("individual-6", 6, "6 individual desserts", "serving")];
  return ["pudding", "smoothie", "frozen", "mousse"].includes(category) ? individual
    : [choice("dessert-batch-12", 12, "Whole dessert · 12 servings", "serving"),
      choice("dessert-batch-24", 24, "Whole dessert · 24 servings", "serving"), ...individual];
}
export function resolveDessertYield(value: unknown, category: string, wedding = false): DessertYield | undefined {
  // Keep the existing optional servingSize request field; default to a cooking yield.
  if (value == null) return wedding
    ? category === "cake" ? LEGACY_DESSERT_YIELDS["medium-wedding"] : undefined
    : dessertYieldOptions(category)[0];
  if (typeof value !== "string") return undefined;
  const legacy = LEGACY_DESSERT_YIELDS[value];
  if (legacy) {
    if (wedding) return category === "cake" && legacy.tiers ? legacy : undefined;
    return legacy.tiers ? undefined : legacy;
  }
  if (wedding) return undefined;
  return dessertYieldOptions(category).find(option => option.value === value);
}
