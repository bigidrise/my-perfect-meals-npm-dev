// client/src/data/kidsDrinksData.ts
// Kids-only drinks: Everyday Smoothie, No Added Sugar, Occasional Treat
// (Removed: Everyday Hydration, Low Glycemic)

export type KidsDrink = {
  id: string;
  name: string;
  description: string;
  image?: string;
  badges?: string[];
  instructions?: string[];
  ingredients?: Array<{ name: string; quantity: number; unit: string }>;
};

export const kidsDrinks: KidsDrink[] = [
  // No Added Sugar (10)
  {
    id: "kd-nosugar-01",
    name: "Watermelon Slush",
    description: "Frozen watermelon blended smooth, no sugar.",
    image: "/images/kids-drinks/kd-nosugar-01-watermelon-slush-no-sugar.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Frozen watermelon chunks", quantity: 2, unit: "cups" },
      { name: "Ice", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-02",
    name: "Pineapple Mint Snow",
    description: "Frozen pineapple + mint blended into a slush.",
    image: "/images/kids-drinks/kd-nosugar-02-pineapple-mint-snow-no-sugar.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Frozen pineapple chunks", quantity: 2, unit: "cups" },
      { name: "Fresh mint leaves", quantity: 5, unit: "leaves" },
      { name: "Ice", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-03",
    name: "Strawberry Nicecream Shake",
    description: "Frozen strawberries blended thick, no dairy needed.",
    image: "/images/kids-drinks/kd-nosugar-03-strawberry-nicecream-shake.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Frozen strawberries", quantity: 2, unit: "cups" },
      { name: "Banana", quantity: 0.5, unit: "whole" }
    ],
  },
  {
    id: "kd-nosugar-04",
    name: "Mango Coconut Chill",
    description: "Mango + coconut water, light tropical cooler.",
    image: "/images/kids-drinks/kd-nosugar-04-mango-coconut-chill.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Fresh mango chunks", quantity: 1, unit: "cup" },
      { name: "Coconut water", quantity: 1, unit: "cup" },
      { name: "Ice", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-05",
    name: "Apple Ginger Spritz",
    description: "Apple blended with fresh ginger + sparkling water.",
    image: "/images/kids-drinks/kd-nosugar-05-apple-ginger-spritz.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Apple", quantity: 1, unit: "whole" },
      { name: "Fresh ginger", quantity: 0.5, unit: "inch" },
      { name: "Sparkling water", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-06",
    name: "Orange Carrot Froth",
    description: "Carrot juice with a squeeze of orange.",
    image: "/images/kids-drinks/kd-nosugar-06-orange-carrot-froth.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Carrot juice", quantity: 1, unit: "cup" },
      { name: "Orange", quantity: 0.5, unit: "whole" }
    ],
  },
  {
    id: "kd-nosugar-07",
    name: "Banana Oat Shake",
    description: "Banana + oats blended, thick & filling.",
    image: "/images/kids-drinks/kd-nosugar-07-banana-oat-shake-no-sugar.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Banana", quantity: 1, unit: "whole" },
      { name: "Rolled oats", quantity: 0.25, unit: "cup" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-08",
    name: "Pear Vanilla Smoothie",
    description: "Peeled pear + vanilla + yogurt.",
    image: "/images/kids-drinks/kd-nosugar-08-pear-vanilla-smoothie.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Pear", quantity: 1, unit: "whole" },
      { name: "Vanilla extract", quantity: 0.25, unit: "tsp" },
      { name: "Plain yogurt", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-09",
    name: "Kiwi Cucumber Cooler",
    description: "Kiwi + cucumber + ice, refreshing.",
    image: "/images/kids-drinks/kd-nosugar-09-kiwi-cucumber-cooler.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Kiwi", quantity: 2, unit: "whole" },
      { name: "Cucumber", quantity: 0.5, unit: "whole" },
      { name: "Ice", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-nosugar-10",
    name: "Grape Ice Pop Blend",
    description: "Frozen grapes blended smooth.",
    image: "/images/kids-drinks/kd-nosugar-10-grape-ice-pop-blend.jpg",
    badges: ["No Added Sugar"],
    ingredients: [
      { name: "Frozen grapes", quantity: 2, unit: "cups" }
    ],
  },

  // Everyday Smoothie (10)
  {
    id: "kd-smoothie-01",
    name: "Oat Breakfast Smoothie",
    description: "Oats + banana + milk for steady energy.",
    image: "/images/kids-drinks/kd-smoothie-01-oat-breakfast-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Rolled oats", quantity: 0.25, unit: "cup" },
      { name: "Banana", quantity: 1, unit: "whole" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-02",
    name: "Berry Yogurt Classic",
    description: "Mixed berries with plain yogurt.",
    image: "/images/kids-drinks/kd-smoothie-02-berry-yogurt-classic.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Mixed berries", quantity: 1, unit: "cup" },
      { name: "Plain yogurt", quantity: 0.75, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-03",
    name: "Peach Yogurt Smoothie",
    description: "Peaches with creamy yogurt.",
    image: "/images/kids-drinks/kd-smoothie-03-peach-yogurt-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Fresh peaches", quantity: 1.5, unit: "whole" },
      { name: "Plain yogurt", quantity: 0.75, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-04",
    name: "Banana Sunbutter Smoothie",
    description: "Banana + sunflower butter + oats.",
    image: "/images/kids-drinks/kd-smoothie-04-banana-peanut-butter-oat.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Banana", quantity: 1, unit: "whole" },
      { name: "Sunflower butter", quantity: 1, unit: "tbsp" },
      { name: "Rolled oats", quantity: 2, unit: "tbsp" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-05",
    name: "Apple Pie Smoothie",
    description: "Apple + oats + cinnamon + yogurt.",
    image: "/images/kids-drinks/kd-smoothie-05-apple-pie-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Apple", quantity: 1, unit: "whole" },
      { name: "Rolled oats", quantity: 2, unit: "tbsp" },
      { name: "Ground cinnamon", quantity: 0.25, unit: "tsp" },
      { name: "Plain yogurt", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-06",
    name: "Pear Spinach Vanilla",
    description: "Pear + spinach + vanilla yogurt.",
    image: "/images/kids-drinks/kd-smoothie-06-pear-spinach-vanilla.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Pear", quantity: 1, unit: "whole" },
      { name: "Fresh spinach", quantity: 1, unit: "cup" },
      { name: "Vanilla yogurt", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-07",
    name: "Cherry Cocoa Smoothie",
    description: "Frozen cherries + cocoa + milk.",
    image: "/images/kids-drinks/kd-smoothie-07-cherry-cocoa-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Frozen cherries", quantity: 1, unit: "cup" },
      { name: "Cocoa powder", quantity: 1, unit: "tbsp" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-08",
    name: "Mango Yogurt Smoothie",
    description: "Ripe mango blended with yogurt.",
    image: "/images/kids-drinks/kd-smoothie-08-mango-yogurt-light.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Fresh mango chunks", quantity: 1, unit: "cup" },
      { name: "Plain yogurt", quantity: 0.75, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-09",
    name: "Blueberry Chia Smoothie",
    description: "Blueberries + chia + yogurt.",
    image: "/images/kids-drinks/kd-smoothie-09-blueberry-chia-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Fresh blueberries", quantity: 1, unit: "cup" },
      { name: "Chia seeds", quantity: 1, unit: "tbsp" },
      { name: "Plain yogurt", quantity: 0.75, unit: "cup" }
    ],
  },
  {
    id: "kd-smoothie-10",
    name: "Strawberry Oat Smoothie",
    description: "Strawberries blended with oats + milk.",
    image: "/images/kids-drinks/kd-smoothie-10-strawberry-oat-smoothie.jpg",
    badges: ["Everyday Smoothie"],
    ingredients: [
      { name: "Fresh strawberries", quantity: 1, unit: "cup" },
      { name: "Rolled oats", quantity: 2, unit: "tbsp" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },

  // Occasional Treat (10)
  {
    id: "kd-treat-01",
    name: "Lemonade Spritz",
    description: "Fresh lemon juice with sparkling water.",
    image: "/images/kids-drinks/kd-treat-01-lemonade-spritz.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Fresh lemon juice", quantity: 0.25, unit: "cup" },
      { name: "Sparkling water", quantity: 1, unit: "cup" },
      { name: "Honey", quantity: 1, unit: "tsp" }
    ],
  },
  {
    id: "kd-treat-02",
    name: "Golden Milk (Kid-Friendly)",
    description: "Warm milk/oat milk with turmeric & cinnamon.",
    image: "/images/kids-drinks/kd-treat-02-golden-milk-kids.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Milk or oat milk", quantity: 1, unit: "cup" },
      { name: "Ground turmeric", quantity: 0.25, unit: "tsp" },
      { name: "Ground cinnamon", quantity: 0.25, unit: "tsp" },
      { name: "Honey", quantity: 1, unit: "tsp" }
    ],
  },
  {
    id: "kd-treat-03",
    name: "Chocolate Banana Shake",
    description: "Frozen banana + cocoa + milk.",
    image: "/images/kids-drinks/kd-treat-03-chocolate-banana-shake.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Frozen banana", quantity: 1, unit: "whole" },
      { name: "Cocoa powder", quantity: 1, unit: "tbsp" },
      { name: "Milk", quantity: 1, unit: "cup" }
    ],
  },
  {
    id: "kd-treat-04",
    name: "Strawberry Ice Cream Smoothie",
    description: "Frozen strawberries + yogurt.",
    image: "/images/kids-drinks/kd-treat-04-strawberry-ice-cream-smoothie.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Frozen strawberries", quantity: 1.5, unit: "cups" },
      { name: "Vanilla yogurt", quantity: 0.5, unit: "cup" },
      { name: "Milk", quantity: 0.25, unit: "cup" }
    ],
  },
  {
    id: "kd-treat-05",
    name: "Vanilla Milkshake (Light)",
    description: "Milkshake with vanilla, lighter version.",
    image: "/images/kids-drinks/kd-treat-05-vanilla-milkshake-light.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Vanilla ice cream", quantity: 0.5, unit: "cup" },
      { name: "Milk", quantity: 0.75, unit: "cup" },
      { name: "Vanilla extract", quantity: 0.5, unit: "tsp" }
    ],
  },
  {
    id: "kd-treat-06",
    name: "Orange Creamsicle Smoothie",
    description: "Orange + vanilla yogurt for creamsicle vibe.",
    image: "/images/kids-drinks/kd-treat-06-orange-creamsicle-smoothie.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Orange juice", quantity: 0.5, unit: "cup" },
      { name: "Vanilla yogurt", quantity: 0.5, unit: "cup" },
      { name: "Ice", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "kd-treat-07",
    name: "Cherry Cola Sparkler (Lite)",
    description: "Sparkling water + cherry + vanilla extract.",
    image: "/images/kids-drinks/kd-treat-07-cherry-cola-sparkler-lite.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Sparkling water", quantity: 1, unit: "cup" },
      { name: "Frozen cherries", quantity: 0.25, unit: "cup" },
      { name: "Vanilla extract", quantity: 0.25, unit: "tsp" }
    ],
  },
  {
    id: "kd-treat-08",
    name: "Caramel Apple Sipper",
    description: "Apple blended with dates for caramel taste.",
    image: "/images/kids-drinks/kd-treat-08-caramel-apple-sipper-lite.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Apple", quantity: 1, unit: "whole" },
      { name: "Medjool dates", quantity: 2, unit: "whole" },
      { name: "Milk", quantity: 0.75, unit: "cup" }
    ],
  },
  {
    id: "kd-treat-09",
    name: "Horchata (Kid-Style)",
    description: "Cinnamon rice drink, lightly sweetened.",
    image: "/images/kids-drinks/kd-treat-09-horchata-kid-style.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "White rice", quantity: 0.5, unit: "cup" },
      { name: "Milk", quantity: 2, unit: "cups" },
      { name: "Ground cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "Vanilla extract", quantity: 0.25, unit: "tsp" }
    ],
  },
  {
    id: "kd-treat-10",
    name: "Root Beer Float (Lite)",
    description: "Vanilla ice cream with sugar-free root beer.",
    image: "/images/kids-drinks/kd-treat-10-root-beer-float-lite.jpg",
    badges: ["Occasional Treat"],
    ingredients: [
      { name: "Vanilla ice cream", quantity: 0.5, unit: "cup" },
      { name: "Sugar-free root beer", quantity: 1, unit: "cup" }
    ],
  },
];
