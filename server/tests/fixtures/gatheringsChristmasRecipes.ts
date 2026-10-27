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
