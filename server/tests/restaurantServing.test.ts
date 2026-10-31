import { bindRestaurantServing, currentRestaurantServing, displayRestaurantPortion, publishedRestaurantServing } from "../../shared/restaurantServing";
import { getawayRestaurantCards } from "../../shared/getawayRestaurantMeals";

const meal = { id: "salmon", name: "Salmon plate", calories: 490, protein: 40, carbs: 30, fat: 23 };
const assumption = { label: "One suggested salmon plate", guidance: "Ask for sauce separately.",
  items: [{ food: "Salmon", quantity: 170, unit: "g", basis: "cooked" },
    { food: "Rice", quantity: 0.5, unit: "cup", basis: "cooked" },
    { food: "Dressing", quantity: 15, unit: "ml", basis: "as_served" }] };

test("same-call quantities freeze the actual serving nutrition, never independently calculated", () => {
  const serving = bindRestaurantServing(assumption, meal)!;
  expect(serving.items).toHaveLength(3);
  expect(serving.basis).toBe("model_estimated");
  expect(serving.nutrition).toEqual({ calories: 490, protein: 40, carbs: 30, fat: 23 });
  expect(currentRestaurantServing(serving, meal)).toEqual(serving);
});
test.each([undefined, null, {}, { label: "Plate", items: [{ food: "Fish", unit: "oz", basis: "cooked" }] },
  { label: "Plate", items: [{ food: "Fish", quantity: -1, unit: "oz", basis: "cooked" }] },
  { label: "Plate", items: [{ food: "Fish", quantity: 6, unit: "oz", basis: "unknown" }] },
])("missing or unsupported assumptions use general guidance with no default amounts: %p", raw => {
  const serving = bindRestaurantServing(raw, meal)!;
  expect(serving.items).toEqual([]);
  expect(serving.guidance).toMatch(/not supplied/);
  expect(serving.nutrition.calories).toBe(meal.calories);
});
test("unknown nutrition is not filled with zeros or default servings", () => {
  expect(bindRestaurantServing(assumption, { ...meal, protein: undefined as any })).toBeUndefined();
});
test.each(["calories", "protein", "carbs", "fat"] as const)("changed %s cannot retain stale quantities", key => {
  expect(currentRestaurantServing(bindRestaurantServing(assumption, meal), { ...meal, [key]: meal[key] + 1 })).toBeUndefined();
});
test("renamed or replaced meal cannot inherit the previous plate", () => {
  expect(currentRestaurantServing(bindRestaurantServing(assumption, meal), { ...meal, name: "Burger" })).toBeUndefined();
});
test("known grams convert only to weight, with no density guess", () => {
  expect(displayRestaurantPortion({ food: "Fish", quantity: 170, unit: "g", basis: "cooked" })).toBe("about 6 oz cooked");
  expect(displayRestaurantPortion({ food: "Rice", quantity: 170, unit: "g", basis: "raw" })).toBe("about 6 oz raw");
});
test("known volumes convert to canonical household units", () => {
  expect(displayRestaurantPortion({ food: "Vegetables", quantity: 240, unit: "ml", basis: "as_served" })).toBe("about 1 cup");
  expect(displayRestaurantPortion({ food: "Dressing", quantity: 15, unit: "ml", basis: "as_served" })).toBe("about 1 tbsp");
});
test("no inferred food density or unsupported measurement conversion", () => {
  const raw = { label: "Plate", items: [{ food: "Rice", quantity: 170, unit: "grams_to_cups", basis: "cooked" }] };
  expect(bindRestaurantServing(raw, meal)!.items).toEqual([]);
});
test("menu-source nutrition is unchanged and substitutions are not called recalculated", () => {
  const serving = publishedRestaurantServing(meal)!;
  expect(serving.items).toEqual([]);
  expect(serving.nutrition).toEqual(bindRestaurantServing(undefined, meal)!.nutrition);
  expect(serving.guidance).toMatch(/not been nutritionally recalculated/);
});
test("Getaway preserves both image and full serving from flat and menu-backed meals", () => {
  const serving = bindRestaurantServing(assumption, meal)!;
  const payload = { compositionEvidence: "unverified", selectedVenue: { destinationName: "Cruise" },
    recommendations: [{ ...meal, serving, imageUrl: "/public-objects/food.png" }] };
  expect(getawayRestaurantCards(payload)[0].meal).toMatchObject({ serving, imageUrl: "/public-objects/food.png" });
  const menuServing = publishedRestaurantServing(meal);
  const nested = { compositionEvidence: "menu-item-only", selectedVenue: payload.selectedVenue,
    recommendations: [{ id: "menu", nutritionStatus: "mixed", meal: { ...meal,
      proteinGrams: meal.protein, carbohydrateGrams: meal.carbs, fatGrams: meal.fat, serving: menuServing } }] };
  expect(getawayRestaurantCards(nested)[0]).toMatchObject({ nutritionStatus: "mixed", meal: { serving: menuServing } });
});
