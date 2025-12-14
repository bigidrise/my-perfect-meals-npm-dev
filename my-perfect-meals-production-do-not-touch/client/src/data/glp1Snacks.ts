// glp1Snacks.ts
// GLP-1 specific snack catalog – completely separate from diabetic snacks.
// Do NOT import / reuse DIABETIC_SNACK_CATEGORIES in this file.

/**
 * Local snack category type.
 * Even if a similar type exists elsewhere, this keeps GLP-1 data isolated
 * so we don't accidentally couple it to diabetic snacks.
 */
type SnackCategory = {
  name: string;
  emoji: string;
  items: string[];
};

/**
 * GLP-1 snack catalog
 *
 * Guardrail intent:
 * - Lower fat / easier to digest where possible
 * - Moderate fiber (not giant raw-veg bowls)
 * - Controlled carb portions
 * - Very low / no added sugar
 * - Lots of soft, gentle options for nausea / slower digestion days
 */
export const GLP1_SNACK_CATEGORIES: SnackCategory[] = [
  {
    name: "Sweet Treats",
    emoji: "🍓",
    items: [
      "Banana cinnamon protein whip (unsweetened)",
      "Berry Greek yogurt mousse (low-fat)",
      "Blueberry kefir cup (unsweetened)",
      "Chilled watermelon cubes (small portion)",
      "Cinnamon oat pudding (no sugar added)",
      "Cinnamon vanilla Greek yogurt cup (low sugar)",
      "Frozen applesauce spoonfuls (unsweetened)",
      "Frozen banana slices (small portion)",
      "Honeydew melon scoops (small portion)",
      "Kiwi cottage whip (low-fat, no sugar added)",
      "Lemon protein mousse (no sugar added)",
      "Mango Greek yogurt swirl (unsweetened)",
      "Mixed berry compote (no added sugar)",
      "Peach kefir parfait (unsweetened)",
      "Pineapple Greek yogurt blend (light portion)",
      "Protein pudding cup (low-sugar)",
      "Raspberry protein fluff (no sugar added)",
      "Soft baked cinnamon pear cup (no added sugar)",
      "Strawberry chia whip (no sugar added)",
      "Vanilla chia bowl (light portion, unsweetened)",
    ].sort(),
  },
  {
    name: "Savory & Crunchy",
    emoji: "🧀",
    items: [
      "Avocado tuna soft roll (light portion)",
      "Baked parmesan zucchini rounds",
      "Boiled egg with light seasoning",
      "Chicken salad cucumber roll (light mayo)",
      "Cottage cheese & soft diced tomatoes",
      "Cucumber slices with light Greek yogurt dip",
      "Edamame (steamed, lightly salted)",
      "Egg salad soft bites (low-fat)",
      "Light turkey & cheese roll (thin slices)",
      "Mini mozzarella & basil bites (light portion)",
      "Mini salmon salad cups (light mayo)",
      "Miso-marinated tofu cubes (soft, baked)",
      "Roasted chickpea mash cup (not whole chickpeas)",
      "Salmon avocado cucumber roll",
      "Savory ricotta cup with herbs",
      "Soft roasted sweet potato bites",
      "Soft turkey meatball bites (lean)",
      "Tuna salad soft cups (low-fat)",
      "Turkey & hummus cucumber bites",
      "Warm bone broth veggie sipper",
    ].sort(),
  },
  {
    name: "Light & Gentle",
    emoji: "🍎",
    items: [
      "Applesauce cup (unsweetened)",
      "Banana oatmeal cup (soft)",
      "Bone broth cup",
      "Cinnamon poached pear cup",
      "Coconut water protein sipper",
      "Cucumber-mint hydration cup",
      "Egg white soft scramble cup",
      "Ginger tea gelatin cubes",
      "Kefir drink cup (plain, unsweetened)",
      "Light miso broth with tofu",
      "Melon cup (light portion)",
      "Oatmeal protein mini cup",
      "Papaya digestive slices",
      "Peach hydration cup (soft diced)",
      "Plain Greek yogurt mini cup",
      "Protein ginger shot (unsweetened)",
      "Soft scrambled eggs (light)",
      "Steamed zucchini cup",
      "Vanilla protein hydration shake (light)",
      "Warm lemon water sipper",
    ].sort(),
  },
  {
    name: "Protein & Energy",
    emoji: "💪",
    items: [
      "Chicken breast soft bites",
      "Chicken salad soft cup (light mayo)",
      "Cottage cheese & soft berries",
      "Egg bites (low-fat)",
      "Greek yogurt (plain, low-fat)",
      "Kefir protein drink (unsweetened)",
      "Light tuna salad cup",
      "Mini turkey breast slices",
      "Peanut butter protein ball (small portion)",
      "Plain protein shake (no sugar added)",
      "Protein chia pudding (unsweetened)",
      "Protein iced coffee (unsweetened)",
      "Protein ricotta whip",
      "Protein smoothie (low-fat, unsweetened)",
      "Roasted turkey soft slices",
      "Salmon flake cup (no sugar added)",
      "Soft tofu protein cup",
      "Tuna salad soft boats",
      "Vanilla protein pudding (low sugar)",
      "Yogurt protein parfait (low sugar)",
    ].sort(),
  },
  {
    name: "Drinkables",
    emoji: "🥤",
    items: [
      "Almond milk protein shake (unsweetened)",
      "Berry kefir shake (unsweetened)",
      "Blueberry protein drink (unsweetened)",
      "Bone broth protein cup",
      "Cacao protein blend (unsweetened)",
      "Chocolate protein shake (unsweetened)",
      "Cinnamon vanilla shake (no sugar added)",
      "Citrus hydration tea (unsweetened)",
      "Collagen drink (unsweetened)",
      "Cucumber mint hydration drink",
      "Ginger turmeric digest shot",
      "Green tea (unsweetened)",
      "Herbal iced tea (unsweetened)",
      "Hydration electrolyte drink (unsweetened)",
      "Kefir drink (plain, unsweetened)",
      "Matcha protein latte (no sugar)",
      "Protein cold brew (unsweetened)",
      "Protein iced coffee (unsweetened)",
      "Vanilla almond protein drink (unsweetened)",
      "Vegetable juice blend (low sodium, unsweetened)",
    ].sort(),
  },
  {
    name: "Dessert Bites",
    emoji: "🍪",
    items: [
      "Almond butter protein mini (no added sugar)",
      "Blueberry protein cheesecake crumble (low sugar)",
      "Cinnamon oat protein mini (no sugar added)",
      "Cocoa cottage whip (unsweetened)",
      "Coconut vanilla protein cube",
      "Frozen Greek yogurt mini (unsweetened)",
      "Frozen mango cube (unsweetened)",
      "Frozen protein fluff bite",
      "Lemon protein square (no sugar)",
      "Mini chia cookie (no added sugar)",
      "Mini protein truffle (unsweetened)",
      "Peanut butter protein crumble (small portion)",
      "Protein brownie bite (low sugar)",
      "Protein cookie dough mini (no sugar added)",
      "Raspberry yogurt protein bite",
      "Soft baked protein pear square",
      "Soft cinnamon protein truffle",
      "Strawberry protein cream bite",
      "Vanilla protein cube (no sugar added)",
      "Whipped chocolate protein cream (unsweetened)",
    ].sort(),
  },
];

/**
 * Flattened list of all GLP-1 snack strings
 * – useful for ingredient pickers, validation, etc.
 */
export const ALL_GLP1_SNACK_INGREDIENTS = GLP1_SNACK_CATEGORIES.flatMap(
  (cat) => cat.items
);

/**
 * Category name → items mapping
 * Mirrors the diabeticSnackIngredients structure, but GLP-1 only.
 */
export const glp1SnackIngredients: Record<string, string[]> = {
  "Sweet Treats": GLP1_SNACK_CATEGORIES[0].items,
  "Savory & Crunchy": GLP1_SNACK_CATEGORIES[1].items,
  "Light & Gentle": GLP1_SNACK_CATEGORIES[2].items,
  "Protein & Energy": GLP1_SNACK_CATEGORIES[3].items,
  "Drinkables": GLP1_SNACK_CATEGORIES[4].items,
  "Dessert Bites": GLP1_SNACK_CATEGORIES[5].items,
};
