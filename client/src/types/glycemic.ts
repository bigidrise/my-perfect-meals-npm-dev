export type GlycemicSettings = {
  bloodGlucose: number | null;        // mg/dL, nullable if user hasn't set it
  preferredCarbs: string[];           // e.g. ["berries","broccoli"]
  updatedAt?: string | null;
};

export type GlycemicTier = "low" | "mid" | "high" | "unknown";

export const LOW_GI: string[] = [
  "Berries", "Cherries", "Apples", "Pears", "Grapefruit",
  "Leafy Greens", "Broccoli", "Cauliflower", "Zucchini", "Green Beans",
  "Lentils", "Chickpeas", "Black Beans", "Quinoa", "Steel-cut Oats",
  "Sweet Potato (small)", "Carrots", "Tomatoes", "Cucumber", "Peppers",
];

export const MID_GI: string[] = [
  "Brown Rice", "Whole Wheat Pasta", "Whole Grain Bread", "Couscous",
  "Pineapple", "Bananas", "Corn", "Sweet Potato (medium)", "Basmati Rice",
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
