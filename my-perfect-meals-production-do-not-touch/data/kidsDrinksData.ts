// client/src/data/kidsDrinksData.ts
// Kids-friendly drinks: hydration, smoothies, and fun treats.
// Structured like meals so you can display them with the same card grid UI.

export type KidsDrink = {
  id: string;
  name: string;
  description: string;
  image?: string;
  badges?: string[];
  ingredients?: { item: string; quantity: number; unit: string }[];
  instructions?: string[];
};

export const kidsDrinks: KidsDrink[] = [
  {
    id: "kd1-fruit-infused-water",
    name: "Fruit-Infused Water",
    description: "Water flavored with fresh berries, oranges, or cucumber.",
    image: "/images/kids-drinks/kd1-fruit-infused-water.jpg",
    badges: ["Everyday Hydration", "No Added Sugar"],
  },
  {
    id: "kd2-herbal-iced-tea",
    name: "Herbal Iced Tea (Caffeine-Free)",
    description: "Light rooibos or hibiscus tea, naturally sweet-tart.",
    image: "/images/kids-drinks/kd2-herbal-iced-tea.jpg",
    badges: ["Everyday Hydration", "Low Sugar"],
  },
  {
    id: "kd3-coconut-water",
    name: "Coconut Water (Unsweetened)",
    description: "Natural electrolytes, no added sugar.",
    image: "/images/kids-drinks/kd3-coconut-water.jpg",
    badges: ["Everyday Hydration", "No Added Sugar"],
  },
  {
    id: "kd4-lemonade-spritz",
    name: "Lemonade Spritz",
    description: "Fresh lemon + sparkling water, lightly sweetened with honey.",
    image: "/images/kids-drinks/kd4-lemonade-spritz.jpg",
    badges: ["Occasional Treat"],
  },
  {
    id: "kd5-golden-milk",
    name: "Golden Milk (Kid-Friendly)",
    description: "Warm milk with turmeric & cinnamon, lightly sweetened (1yr+).",
    image: "/images/kids-drinks/kd5-golden-milk.jpg",
    badges: ["Soothing", "Occasional Treat"],
  },
  {
    id: "kd6-berry-spinach-smoothie",
    name: "Berry-Spinach Smoothie",
    description: "Blueberries, banana, spinach, and yogurt for a low-glycemic blend.",
    image: "/images/kids-drinks/kd6-berry-spinach-smoothie.jpg",
    badges: ["Low Glycemic", "Everyday Smoothie"],
  },
  {
    id: "kd7-mango-pineapple-smoothie",
    name: "Mango-Pineapple Smoothie",
    description: "Tropical fruit with yogurt; add water to lighten sugar load.",
    image: "/images/kids-drinks/kd7-mango-pineapple-smoothie.jpg",
    badges: ["Occasional Treat"],
  },
  {
    id: "kd8-oat-breakfast-smoothie",
    name: "Oat Breakfast Smoothie",
    description: "Oats, banana, and milk blended for sustained energy.",
    image: "/images/kids-drinks/kd8-oat-breakfast-smoothie.jpg",
    badges: ["Everyday Smoothie", "Fiber"],
  },
  {
    id: "kd9-chocolate-banana-shake",
    name: "Chocolate Banana Shake",
    description: "Frozen banana base with a little cocoa powder and milk.",
    image: "/images/kids-drinks/kd9-chocolate-banana-shake.jpg",
    badges: ["Occasional Treat"],
  },
  {
    id: "kd10-strawberry-ice-cream-smoothie",
    name: "Strawberry ‘Ice Cream’ Smoothie",
    description: "Frozen strawberries blended with yogurt for a creamy treat.",
    image: "/images/kids-drinks/kd10-strawberry-ice-cream-smoothie.jpg",
    badges: ["Occasional Treat"],
  },
  {
    id: "kd11-homemade-fruit-punch",
    name: "Homemade Fruit Punch",
    description: "Diluted juice blend (80% water, 20% fruit).",
    image: "/images/kids-drinks/kd11-homemade-fruit-punch.jpg",
    badges: ["Lower Sugar"],
  },
  {
    id: "kd12-diluted-green-smoothie",
    name: "Diluted Green Smoothie",
    description: "Strawberry + banana + spinach with extra water.",
    image: "/images/kids-drinks/kd12-diluted-green-smoothie.jpg",
    badges: ["Low Glycemic", "Everyday Smoothie"],
  },
  {
    id: "kd13-stevia-fruit-punch",
    name: "Stevia Fruit Punch",
    description: "Sugar-free option using natural sweetener.",
    image: "/images/kids-drinks/kd13-stevia-fruit-punch.jpg",
    badges: ["Sugar-Free", "Occasional Treat"],
  },
  {
    id: "kd14-watermelon-slush",
    name: "Watermelon Slush",
    description: "Blended frozen watermelon cubes with lime.",
    image: "/images/kids-drinks/kd14-watermelon-slush.jpg",
    badges: ["Occasional Treat", "Hydrating"],
  },
  {
    id: "kd15-peach-yogurt-smoothie",
    name: "Peach Yogurt Smoothie",
    description: "Ripe peaches blended with yogurt and a drizzle of honey.",
    image: "/images/kids-drinks/kd15-peach-yogurt-smoothie.jpg",
    badges: ["Everyday Smoothie"],
  },
];
