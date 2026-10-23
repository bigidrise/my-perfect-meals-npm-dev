// Synthetic fixtures only. Not meal records, dietary advice, or application configuration.
export const MODELS = Object.freeze([
  "gpt-image-2.5-flare-2026-09-08",
  "gpt-image-2.5-sunburst-2026-09-08",
]);
export const SETTINGS = Object.freeze({
  size: "1024x1024", quality: "low", n: 1, output_format: "png",
  background: "opaque", moderation: "auto", stream: false,
});
export const LIMITS = Object.freeze({
  generationRequests: 16, verificationRequests: 16, concurrency: 1, retries: 0,
  generationMs: 150_000, verificationMs: 20_000, operationMs: 180_000,
  operationUSD: 0.50, reservationUSD: 0.25, runAllowanceUSD: 5,
});
export const VERIFIER = "gpt-4o";
export const RECIPES = Object.freeze([
  {
    id: "chia-parfait", name: "Berry Coconut Chia Parfait", sourceType: "snack", servings: 1,
    ingredients: ["chia seeds 20 g", "coconut milk 120 g", "blueberries 40 g", "strawberries 40 g", "coconut flakes 5 g"],
    method: "Chill the chia and coconut milk mixture for four hours; layer with the fruit and coconut flakes.",
    visibleRequirement: "A layered parfait. No granola, nuts, or yogurt.",
  },
  {
    id: "oat-brownies", name: "Cocoa Oat Brownies", sourceType: "dessert", servings: 6,
    ingredients: ["oat flour 50 g", "cocoa powder 15 g", "banana 100 g", "milk 80 g", "egg 50 g", "baking powder 3 g"],
    method: "Mix; bake in a small lined pan at 175 degrees Celsius until set; cool and cut into six squares.",
    visibleRequirement: "Brownie squares, not cookies. No frosting or chocolate chips.",
  },
  {
    id: "berry-smoothie", name: "Spinach Berry Smoothie", sourceType: "beverage", servings: 1,
    ingredients: ["yogurt 100 g", "blueberries 80 g", "banana 60 g", "spinach 20 g", "water 100 g"],
    method: "Blend until smooth and serve in a glass.",
    visibleRequirement: "A drink in a glass, not a salad or smoothie bowl.",
  },
  {
    id: "chicken-quinoa", name: "Lemon Chicken Quinoa Plate", sourceType: "meal", servings: 2,
    ingredients: ["chicken breast 240 g", "dry quinoa 80 g", "broccoli 200 g", "olive oil 10 g", "lemon juice 20 g", "cooking water as needed"],
    method: "Cook the quinoa in water; roast the chicken and broccoli using the oil and lemon juice; plate.",
    visibleRequirement: "Cooked chicken, quinoa, and broccoli. No rice or potatoes.",
  },
  {
    id: "lentil-soup", name: "Red Lentil Carrot Soup", sourceType: "meal", servings: 2,
    ingredients: ["dry red lentils 100 g", "carrot 150 g", "onion 50 g", "water 600 g", "olive oil 5 g", "cumin 1 g"],
    method: "Saute the vegetables in the oil; add the other ingredients and simmer until soft; partially blend.",
    visibleRequirement: "Thick orange-red soup. No cream or bread.",
  },
  {
    id: "salmon-bowl", name: "Salmon Nori Rice Bowl", sourceType: "meal", servings: 2,
    ingredients: ["salmon 200 g", "cooked rice 240 g", "cucumber 100 g", "avocado 60 g", "nori 2 g", "soy sauce 10 g"],
    method: "Cook and flake the salmon; assemble bowls with the other ingredients.",
    visibleRequirement: "Cooked, not raw, salmon. No sesame garnish.",
  },
  {
    id: "egg-free-cobb", name: "Egg-Free Chicken Cobb-Style Salad", sourceType: "meal", servings: 2,
    ingredients: ["cooked chicken 150 g", "romaine 100 g", "tomato 100 g", "avocado 60 g", "olive oil 10 g", "lemon juice 15 g"],
    method: "Chop and arrange the chicken and vegetables; dress with the oil and lemon juice.",
    visibleRequirement: "No egg, bacon, or cheese, despite the familiar dish name.",
  },
  {
    id: "banana-pancakes", name: "Soft Banana Oat Pancakes", sourceType: "meal", servings: 2,
    ingredients: ["oat flour 60 g", "banana 100 g", "egg 50 g", "water 30 g", "olive oil 3 g"],
    method: "Mix; pan-cook small pancakes with the oil until set.",
    visibleRequirement: "Soft small pancakes. No syrup, berries, or nuts.",
  },
].map(recipe => Object.freeze({ ...recipe, ingredients: Object.freeze(recipe.ingredients) })));
