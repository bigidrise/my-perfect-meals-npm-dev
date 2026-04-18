export type GlycemicSettings = {
  bloodGlucose: number | null;
  preferredCarbs: string[];           // legacy flat list — kept for backward compatibility
  lowRangeCarbs: string[];            // carbs preferred when glucose is LOW (<80 mg/dL)
  midRangeCarbs: string[];            // carbs preferred when glucose is IN RANGE (80–140)
  highRangeCarbs: string[];           // carbs preferred when glucose is ELEVATED (>140)
  updatedAt?: string | null;
};

export type GlycemicTier = "low" | "mid" | "high" | "unknown";

// LOW GLUCOSE RANGE foods — fast-acting carbs that help stabilize low blood sugar
// Clinically appropriate when glucose < 80 mg/dL
export const LOW_RANGE_OPTIONS: string[] = [
  "Berries", "Cherries", "Apples", "Pears", "Grapefruit",
  "Bananas", "Pineapple", "Oranges", "Grapes", "Melon",
  "Brown Rice", "Whole Grain Bread", "Oatmeal", "Quinoa",
  "Sweet Potato", "Corn", "Lentils", "Chickpeas", "Black Beans",
  "Greek Yogurt", "Milk",
];

// IN-RANGE GLUCOSE options — balanced low-to-mid GI carbs for stable blood sugar
export const MID_RANGE_OPTIONS: string[] = [
  "Berries", "Cherries", "Apples", "Pears", "Grapefruit",
  "Leafy Greens", "Broccoli", "Cauliflower", "Zucchini", "Green Beans",
  "Lentils", "Chickpeas", "Black Beans", "Quinoa", "Steel-cut Oats",
  "Sweet Potato", "Carrots", "Tomatoes", "Cucumber", "Peppers",
  "Brown Rice", "Whole Wheat Pasta", "Whole Grain Bread",
];

// HIGH GLUCOSE RANGE options — strictly low-GI, minimal glycemic load
export const HIGH_RANGE_OPTIONS: string[] = [
  "Leafy Greens", "Broccoli", "Cauliflower", "Zucchini", "Green Beans",
  "Asparagus", "Brussels Sprouts", "Cabbage", "Spinach", "Kale",
  "Cucumbers", "Celery", "Bell Peppers", "Mushrooms", "Tomatoes",
  "Berries", "Cherries", "Grapefruit",
  "Lentils", "Chickpeas", "Black Beans",
  "Steel-cut Oats", "Quinoa",
  "Avocado", "Almonds", "Walnuts",
];

// Legacy GI lists — kept for backward compatibility and classifyCarb()
export const LOW_GI: string[] = [
  "Berries", "Cherries", "Apples", "Pears", "Grapefruit",
  "Leafy Greens", "Broccoli", "Cauliflower", "Zucchini", "Green Beans",
  "Lentils", "Chickpeas", "Black Beans", "Quinoa", "Steel-cut Oats",
  "Sweet Potato", "Carrots", "Tomatoes", "Cucumber", "Peppers",
];

export const MID_GI: string[] = [
  "Brown Rice", "Whole Wheat Pasta", "Whole Grain Bread", "Couscous",
  "Pineapple", "Bananas", "Corn", "Sweet Potato", "Basmati Rice",
];

export const HIGH_GI: string[] = [
  "White Rice", "White Bread", "Potatoes (baked)", "Watermelon",
  "Dates", "Rice Cakes", "Instant Oatmeal",
];

export function classifyCarb(carb: string): GlycemicTier {
  const normalized = carb.trim();
  if (LOW_GI.some(item => item.toLowerCase() === normalized.toLowerCase())) return "low";
  if (MID_GI.some(item => item.toLowerCase() === normalized.toLowerCase())) return "mid";
  if (HIGH_GI.some(item => item.toLowerCase() === normalized.toLowerCase())) return "high";
  return "unknown";
}

export function splitByTier(carbs: string[]): {
  low: string[];
  mid: string[];
  high: string[];
  unknown: string[];
} {
  return {
    low: carbs.filter(c => classifyCarb(c) === "low"),
    mid: carbs.filter(c => classifyCarb(c) === "mid"),
    high: carbs.filter(c => classifyCarb(c) === "high"),
    unknown: carbs.filter(c => classifyCarb(c) === "unknown"),
  };
}
