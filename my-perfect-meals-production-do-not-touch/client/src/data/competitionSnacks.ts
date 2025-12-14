import { Meal } from "@/components/MealCard";

export interface CompetitionSnackOption {
  id: string;
  title: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  notes: string;
}

// COMPETITION-SAFE SNACK LIST (20 OPTIONS)
// Low sugar (≤3g), clean fats or high protein, diet-safe for bodybuilders
export const competitionSnackOptions: CompetitionSnackOption[] = [
  {
    id: "sn-almonds",
    title: "Raw Almonds (1 oz)",
    protein_g: 6,
    carbs_g: 6,
    fat_g: 14,
    sugar_g: 1,
    notes: "Clean fats, crunchy, prep-safe"
  },
  {
    id: "sn-walnuts",
    title: "Raw Walnuts (1 oz)",
    protein_g: 4,
    carbs_g: 4,
    fat_g: 18,
    sugar_g: 0,
    notes: "High omega-3, zero sugar"
  },
  {
    id: "sn-pistachios",
    title: "Pistachios (1 oz)",
    protein_g: 6,
    carbs_g: 8,
    fat_g: 13,
    sugar_g: 2,
    notes: "Great crunch, clean fats"
  },
  {
    id: "sn-ricecakes",
    title: "Plain Rice Cakes (2)",
    protein_g: 2,
    carbs_g: 14,
    fat_g: 0,
    sugar_g: 0,
    notes: "Classic contest prep crunch"
  },
  {
    id: "sn-ricecakes-peanutbutter",
    title: "Rice Cake + 1 tsp Natural PB",
    protein_g: 4,
    carbs_g: 14,
    fat_g: 4,
    sugar_g: 1,
    notes: "Light fat, no junk sugars"
  },
  {
    id: "sn-cucumber-chips",
    title: "Crispy Cucumber Slices + Sea Salt",
    protein_g: 1,
    carbs_g: 3,
    fat_g: 0,
    sugar_g: 1,
    notes: "Zero-guilt crunchy snack"
  },
  {
    id: "sn-bellpepper-strips",
    title: "Red Bell Pepper Strips",
    protein_g: 1,
    carbs_g: 4,
    fat_g: 0,
    sugar_g: 2,
    notes: "Sweet flavor, low sugar"
  },
  {
    id: "sn-celery",
    title: "Celery Sticks",
    protein_g: 0,
    carbs_g: 1,
    fat_g: 0,
    sugar_g: 0,
    notes: "Zero-calorie crunch"
  },
  {
    id: "sn-turkey-slices",
    title: "Lean Turkey Slices (2 oz)",
    protein_g: 10,
    carbs_g: 1,
    fat_g: 1,
    sugar_g: 1,
    notes: "Ultra-lean protein"
  },
  {
    id: "sn-jerky",
    title: "Low-Sugar Beef Jerky (1 oz)",
    protein_g: 10,
    carbs_g: 3,
    fat_g: 1,
    sugar_g: 1,
    notes: "Check label – low sugar only"
  },
  {
    id: "sn-tuna-pack",
    title: "Tuna Pack (no mayo)",
    protein_g: 14,
    carbs_g: 1,
    fat_g: 0,
    sugar_g: 0,
    notes: "Prep staple, portable"
  },
  {
    id: "sn-greekyogurt",
    title: "Unsweetened Greek Yogurt (½ cup)",
    protein_g: 12,
    carbs_g: 3,
    fat_g: 0,
    sugar_g: 2,
    notes: "Low dairy, very low sugar"
  },
  {
    id: "sn-blueberries",
    title: "Blueberries (½ cup)",
    protein_g: 0,
    carbs_g: 10,
    fat_g: 0,
    sugar_g: 7,
    notes: "Only fruit used in prep"
  },
  {
    id: "sn-proteinshake",
    title: "Isolate Protein Shake (1 scoop)",
    protein_g: 25,
    carbs_g: 2,
    fat_g: 0,
    sugar_g: 1,
    notes: "Zero-lactose isolate"
  },
  {
    id: "sn-zucchini-chips",
    title: "Air-Fried Zucchini Chips",
    protein_g: 2,
    carbs_g: 4,
    fat_g: 1,
    sugar_g: 2,
    notes: "Crunchy, low-cal"
  },
  {
    id: "sn-seaweed-snacks",
    title: "Seaweed Snack Sheets",
    protein_g: 1,
    carbs_g: 1,
    fat_g: 2,
    sugar_g: 0,
    notes: "Zero BS, perfect cutting snack"
  },
  {
    id: "sn-airpopped-popcorn",
    title: "Air-Popped Popcorn (1½ cups)",
    protein_g: 1,
    carbs_g: 6,
    fat_g: 0,
    sugar_g: 0,
    notes: "No oil, pure crunch"
  },
  {
    id: "sn-pickles",
    title: "Pickle Spears",
    protein_g: 0,
    carbs_g: 1,
    fat_g: 0,
    sugar_g: 1,
    notes: "Salt hit without calories"
  },
  {
    id: "sn-protein-pudding",
    title: "Casein Pudding (½ scoop + water)",
    protein_g: 12,
    carbs_g: 1,
    fat_g: 0,
    sugar_g: 1,
    notes: "Sweet tooth fix for prep"
  },
  {
    id: "sn-eggwhites-muffin",
    title: "Egg White Muffins (2)",
    protein_g: 12,
    carbs_g: 2,
    fat_g: 0,
    sugar_g: 0,
    notes: "Meal-prep friendly"
  },
];

// Convert competition snack to Meal object
export function competitionSnackToMeal(snack: CompetitionSnackOption): Meal {
  const calories = (snack.protein_g * 4) + (snack.carbs_g * 4) + (snack.fat_g * 9);

  return {
    id: `snack-${snack.id}-${Date.now()}`,
    title: snack.title,
    name: snack.title,
    servings: 1,
    ingredients: [],
    instructions: [],
    nutrition: {
      calories: Math.round(calories),
      protein: snack.protein_g,
      carbs: snack.carbs_g,
      fat: snack.fat_g,
    },
    entryType: "quick",
  };
}
