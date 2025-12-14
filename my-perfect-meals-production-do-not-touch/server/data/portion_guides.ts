// Default per‑serving amounts used to backfill missing quantities
export const PORTION_DEFAULTS = {
  protein: {
    chicken: { amount: 150, unit: 'g' },
    turkey: { amount: 160, unit: 'g' },
    beef: { amount: 170, unit: 'g' },
    salmon: { amount: 150, unit: 'g' },
    tuna: { amount: 140, unit: 'g' },
    shrimp: { amount: 140, unit: 'g' },
    eggs: { amount: 3, unit: 'large' },
    tofu: { amount: 180, unit: 'g' },
  },
  veg: { generic: { amount: 2, unit: 'cups' } },
  carb: {
    rice: { amount: 0.75, unit: 'cup cooked' },
    quinoa: { amount: 0.75, unit: 'cup cooked' },
    pasta: { amount: 1, unit: 'cup cooked' },
    potato: { amount: 1, unit: 'cup' },
    tortilla: { amount: 1, unit: 'piece' },
    bread: { amount: 1, unit: 'slice' },
  },
  fat: { oil: { amount: 1, unit: 'tbsp' }, butter: { amount: 1, unit: 'tbsp' } },
  aroma: { minced: { amount: 1, unit: 'tbsp' } },
  condiment: { generic: { amount: 2, unit: 'tbsp' } },
} as const;

export type PortionKey = keyof typeof PORTION_DEFAULTS;