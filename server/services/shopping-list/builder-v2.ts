import { canonicalName } from './normalizer';

export interface ShoppingMealIngredient {
  name: string;
  quantity: number;
  unit: string;
  [key: string]: unknown;
}

export interface ShoppingMeal {
  name: string;
  ingredients: ShoppingMealIngredient[];
}

export interface NormalizedShoppingItem extends ShoppingMealIngredient {
  sourceMeal: string;
  sourceMeals: string[];
}

export const normalizeShopping = (meals: readonly ShoppingMeal[]): NormalizedShoppingItem[] => {
  const allIngredients: Array<ShoppingMealIngredient & { sourceMeal: string }> = [];
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      allIngredients.push({ ...ing, sourceMeal: meal.name });
    }
  }

  const map = new Map<string, NormalizedShoppingItem>();
  for (const ing of allIngredients) {
    // Normalize name and unit before merging
    const normalizedName = canonicalName(ing.name);
    const normalizedUnit = ing.unit.toLowerCase();
    const key = `${normalizedName.toLowerCase()}|${normalizedUnit}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.quantity += ing.quantity;
      if (ing.sourceMeal && !existing.sourceMeals?.includes(ing.sourceMeal)) {
        existing.sourceMeals = [...(existing.sourceMeals || []), ing.sourceMeal];
      }
    } else {
      map.set(key, {
        ...ing,
        name: normalizedName,
        unit: normalizedUnit,
        sourceMeals: ing.sourceMeal ? [ing.sourceMeal] : [],
      });
    }
  }

  return [...map.values()];
};