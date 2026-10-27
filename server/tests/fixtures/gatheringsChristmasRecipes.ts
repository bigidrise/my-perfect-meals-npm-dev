/**
 * Actual ingredient lists supplied by the user, with a stated yield of six.
 * No cooking instructions were included. Do not invent preparation details,
 * ingredient brands, shell weights, hydration state, or corrected nutrition.
 * Personal/profile material from the accompanying refusal is not retained.
 */
export const christmasGatheringsRecipes = [
  {
    name: "Japanese Festive Miso Soup with Clams",
    servings: 6,
    reportedPerServing: { calories: 20, protein: 2, carbs: 2, fat: 1 },
    ingredientLines: [
      "12 oz fresh clams",
      "4 cups dashi broth",
      "3 tbsp white miso paste",
      "1 oz wakame seaweed",
      "2 oz firm tofu, cubed",
      "2 green onions, thinly sliced",
      "1 tbsp sake",
      "1 tbsp soy sauce",
      "1 tsp grated ginger",
    ],
  },
  {
    name: "Japanese Sweet Potato Mochi Cake",
    servings: 6,
    reportedPerServing: { calories: 35, protein: 1, carbs: 7, fat: 1 },
    ingredientLines: [
      "12 oz Japanese sweet potatoes, peeled and cubed",
      "1 cup mochiko (sweet rice flour)",
      "1/2 cup coconut milk",
      "1/4 cup maple syrup",
      "2 tbsp honey",
      "1/4 cup unsweetened almond milk",
      "1 tsp vanilla extract",
      "1/2 tsp ground cinnamon",
      "1/4 tsp ground ginger",
      "1/4 tsp salt",
      "1 tbsp toasted sesame seeds for garnish",
    ],
  },
] as const;

/** Actual authenticated Development smoke-test lists. Instructions were not
 * supplied; keep them absent rather than inventing cooking or safety guidance. */
export const christmasSmokeGatheringsRecipes = [
  {
    name: "Japanese Salmon Sashimi with Wakame Salad", servings: 6,
    ingredientLines: [
      "12 oz sashimi-grade salmon",
      "2 cups rehydrated wakame seaweed",
      "1 cup thinly sliced cucumber",
      "1/4 cup thinly sliced red onion",
      "2 tbsp rice vinegar",
      "1 tbsp soy sauce",
      "1 tbsp mirin",
      "1 tsp sesame oil",
      "1 tbsp toasted sesame seeds",
      "1 tbsp finely chopped fresh ginger",
      "1 tbsp finely chopped green onions",
    ],
  },
  {
    name: "Honey Glazed Ham with Miso and Ginger", servings: 6,
    ingredientLines: [
      "3 pounds bone-in ham",
      "1/4 cup honey",
      "2 tbsp miso paste",
      "2 tbsp soy sauce",
      "1 tbsp fresh ginger, grated",
      "1 tbsp rice vinegar",
      "1 tbsp sesame oil",
      "1 tbsp sesame seeds",
      "1/4 cup green onions, finely chopped",
    ],
  },
  {
    name: "Japanese Sweet Potato Pie (Satsumaimo Pie)", servings: 6,
    ingredientLines: [
      "30 oz Japanese sweet potatoes, peeled and cubed",
      "1/2 cup coconut milk",
      "1/4 cup maple syrup",
      "1 tsp vanilla extract",
      "1 tsp ground cinnamon",
      "1/2 tsp ground ginger",
      "1/4 tsp ground nutmeg",
      "2 large eggs",
      "1 tbsp olive oil",
      "1 cup almond flour",
      "1/4 cup toasted walnuts, chopped",
    ],
  },
] as const;
