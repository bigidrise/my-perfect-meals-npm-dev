// Competition-prep premade meals for Performance & Competition Builder
// Used ONLY when dietType="competition"

export interface AthleteMeal {
  id: string;
  category: "poultry" | "redmeat" | "fish" | "eggs_shakes";
  title: string;
  protein_source: string;
  protein_oz: number;
  protein_g: number;
  carb_source?: string;
  carb_g?: number;
  fibrous_source: string[];
  fibrous_g?: number;
  macros: {
    protein: number;
    starchyCarbs: number;
    fibrousCarbs: number;
    fat: number;
    kcal: number;
  };
  tags: string[];
  includeCarbs: boolean;
}

export const competitionPremadeMeals: AthleteMeal[] = [
  // ============================================
  // POULTRY - PROTEIN ONLY (No Carbs)
  // ============================================
  {
    id: "COMP-P1",
    category: "poultry",
    title: "Grilled Chicken Breast (5 oz)",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 3, kcal: 170 },
    tags: ["competition_prep", "low_sodium", "protein_only"],
    includeCarbs: false
  },
  {
    id: "COMP-P2",
    category: "poultry",
    title: "Turkey Breast (5 oz)",
    protein_source: "Turkey Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 2, kcal: 160 },
    tags: ["competition_prep", "low_sodium", "protein_only"],
    includeCarbs: false
  },

  // ============================================
  // POULTRY - PROTEIN + VEGGIES
  // ============================================
  {
    id: "COMP-P3",
    category: "poultry",
    title: "Chicken Breast + Broccoli",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 12, fat: 3, kcal: 215 },
    tags: ["competition_prep", "classic"],
    includeCarbs: false
  },
  {
    id: "COMP-P4",
    category: "poultry",
    title: "Chicken Breast + Asparagus",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Asparagus"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 10, fat: 3, kcal: 205 },
    tags: ["competition_prep", "low_sodium"],
    includeCarbs: false
  },
  {
    id: "COMP-P5",
    category: "poultry",
    title: "Turkey Breast + Green Beans",
    protein_source: "Turkey Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Green Beans"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 11, fat: 2, kcal: 205 },
    tags: ["competition_prep"],
    includeCarbs: false
  },
  {
    id: "COMP-P6",
    category: "poultry",
    title: "Chicken Breast + Spinach",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Spinach"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 8, fat: 3, kcal: 200 },
    tags: ["competition_prep", "nutrient_dense"],
    includeCarbs: false
  },

  // ============================================
  // POULTRY - PROTEIN + STARCH + VEGGIES
  // ============================================
  {
    id: "COMP-P7",
    category: "poultry",
    title: "Chicken, Rice & Broccoli",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "White Rice",
    carb_g: 40,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 12, fat: 3, kcal: 375 },
    tags: ["competition_prep", "classic", "balanced"],
    includeCarbs: true
  },
  {
    id: "COMP-P8",
    category: "poultry",
    title: "Chicken, Sweet Potato & Asparagus",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Sweet Potato",
    carb_g: 40,
    fibrous_source: ["Asparagus"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 10, fat: 3, kcal: 370 },
    tags: ["competition_prep", "balanced"],
    includeCarbs: true
  },
  {
    id: "COMP-P9",
    category: "poultry",
    title: "Turkey, Quinoa & Green Beans",
    protein_source: "Turkey Breast",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Quinoa",
    carb_g: 40,
    fibrous_source: ["Green Beans"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 11, fat: 4, kcal: 380 },
    tags: ["competition_prep", "balanced"],
    includeCarbs: true
  },

  // ============================================
  // POULTRY - PROTEIN + FRUIT
  // ============================================
  {
    id: "COMP-P10",
    category: "poultry",
    title: "Chicken Breast + Berries",
    protein_source: "Chicken Breast",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Mixed Berries",
    carb_g: 15,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 15, fibrousCarbs: 4, fat: 3, kcal: 235 },
    tags: ["competition_prep", "low_glycemic"],
    includeCarbs: true
  },

  // ============================================
  // FISH - PROTEIN ONLY
  // ============================================
  {
    id: "COMP-F1",
    category: "fish",
    title: "White Fish Fillet (5 oz)",
    protein_source: "Tilapia",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 2, kcal: 155 },
    tags: ["competition_prep", "lean", "protein_only"],
    includeCarbs: false
  },
  {
    id: "COMP-F2",
    category: "fish",
    title: "Cod Fillet (5 oz)",
    protein_source: "Cod",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 2, kcal: 155 },
    tags: ["competition_prep", "lean", "protein_only"],
    includeCarbs: false
  },

  // ============================================
  // FISH - PROTEIN + VEGGIES
  // ============================================
  {
    id: "COMP-F3",
    category: "fish",
    title: "White Fish + Asparagus",
    protein_source: "Tilapia",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Asparagus"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 10, fat: 2, kcal: 195 },
    tags: ["competition_prep", "lean"],
    includeCarbs: false
  },
  {
    id: "COMP-F4",
    category: "fish",
    title: "Cod + Broccoli",
    protein_source: "Cod",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 12, fat: 2, kcal: 205 },
    tags: ["competition_prep", "lean"],
    includeCarbs: false
  },
  {
    id: "COMP-F5",
    category: "fish",
    title: "Salmon + Spinach",
    protein_source: "Salmon",
    protein_oz: 4,
    protein_g: 30,
    fibrous_source: ["Spinach"],
    fibrous_g: 150,
    macros: { protein: 30, starchyCarbs: 0, fibrousCarbs: 8, fat: 8, kcal: 210 },
    tags: ["competition_prep", "omega3"],
    includeCarbs: false
  },

  // ============================================
  // FISH - PROTEIN + STARCH + VEGGIES
  // ============================================
  {
    id: "COMP-F6",
    category: "fish",
    title: "White Fish, Rice & Broccoli",
    protein_source: "Tilapia",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "White Rice",
    carb_g: 40,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 12, fat: 2, kcal: 365 },
    tags: ["competition_prep", "balanced"],
    includeCarbs: true
  },
  {
    id: "COMP-F7",
    category: "fish",
    title: "Cod, Sweet Potato & Asparagus",
    protein_source: "Cod",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Sweet Potato",
    carb_g: 40,
    fibrous_source: ["Asparagus"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 10, fat: 2, kcal: 360 },
    tags: ["competition_prep", "balanced"],
    includeCarbs: true
  },

  // ============================================
  // FISH - PROTEIN + FRUIT
  // ============================================
  {
    id: "COMP-F8",
    category: "fish",
    title: "White Fish + Grapefruit",
    protein_source: "Tilapia",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Grapefruit",
    carb_g: 15,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 15, fibrousCarbs: 3, fat: 2, kcal: 220 },
    tags: ["competition_prep", "low_glycemic"],
    includeCarbs: true
  },

  // ============================================
  // RED MEAT - PROTEIN ONLY
  // ============================================
  {
    id: "COMP-R1",
    category: "redmeat",
    title: "Lean Steak (5 oz)",
    protein_source: "Top Sirloin",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 6, kcal: 205 },
    tags: ["competition_prep", "protein_only"],
    includeCarbs: false
  },
  {
    id: "COMP-R2",
    category: "redmeat",
    title: "Bison (5 oz)",
    protein_source: "Bison",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 4, kcal: 185 },
    tags: ["competition_prep", "lean", "protein_only"],
    includeCarbs: false
  },

  // ============================================
  // RED MEAT - PROTEIN + VEGGIES
  // ============================================
  {
    id: "COMP-R3",
    category: "redmeat",
    title: "Lean Steak + Green Beans",
    protein_source: "Top Sirloin",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Green Beans"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 11, fat: 6, kcal: 250 },
    tags: ["competition_prep"],
    includeCarbs: false
  },
  {
    id: "COMP-R4",
    category: "redmeat",
    title: "Bison + Broccoli",
    protein_source: "Bison",
    protein_oz: 5,
    protein_g: 35,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 12, fat: 4, kcal: 230 },
    tags: ["competition_prep", "lean"],
    includeCarbs: false
  },

  // ============================================
  // RED MEAT - PROTEIN + STARCH + VEGGIES
  // ============================================
  {
    id: "COMP-R5",
    category: "redmeat",
    title: "Steak, Rice & Spinach",
    protein_source: "Top Sirloin",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Brown Rice",
    carb_g: 40,
    fibrous_source: ["Spinach"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 8, fat: 6, kcal: 405 },
    tags: ["competition_prep", "balanced", "iron"],
    includeCarbs: true
  },
  {
    id: "COMP-R6",
    category: "redmeat",
    title: "Bison, Sweet Potato & Broccoli",
    protein_source: "Bison",
    protein_oz: 5,
    protein_g: 35,
    carb_source: "Sweet Potato",
    carb_g: 40,
    fibrous_source: ["Broccoli"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 12, fat: 4, kcal: 385 },
    tags: ["competition_prep", "balanced", "lean"],
    includeCarbs: true
  },

  // ============================================
  // EGGS & PROTEIN SHAKES - PROTEIN ONLY
  // ============================================
  {
    id: "COMP-E1",
    category: "eggs_shakes",
    title: "Egg White Scramble (1.5 cups)",
    protein_source: "Egg Whites",
    protein_oz: 8,
    protein_g: 35,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 0, fat: 0, kcal: 140 },
    tags: ["competition_prep", "lean", "protein_only"],
    includeCarbs: false
  },
  {
    id: "COMP-E2",
    category: "eggs_shakes",
    title: "Egg Whites + Whole Egg",
    protein_source: "Egg Whites + Whole Egg",
    protein_oz: 6,
    protein_g: 30,
    fibrous_source: [],
    macros: { protein: 30, starchyCarbs: 0, fibrousCarbs: 0, fat: 5, kcal: 175 },
    tags: ["competition_prep", "protein_only"],
    includeCarbs: false
  },

  // ============================================
  // EGGS & SHAKES - PROTEIN + VEGGIES
  // ============================================
  {
    id: "COMP-E3",
    category: "eggs_shakes",
    title: "Egg White Scramble + Spinach",
    protein_source: "Egg Whites",
    protein_oz: 8,
    protein_g: 35,
    fibrous_source: ["Spinach"],
    fibrous_g: 150,
    macros: { protein: 35, starchyCarbs: 0, fibrousCarbs: 8, fat: 0, kcal: 175 },
    tags: ["competition_prep", "lean"],
    includeCarbs: false
  },

  // ============================================
  // EGGS & SHAKES - PROTEIN + STARCH + VEGGIES
  // ============================================
  {
    id: "COMP-E4",
    category: "eggs_shakes",
    title: "Egg White Bowl with Oats & Veggies",
    protein_source: "Egg Whites",
    protein_oz: 8,
    protein_g: 35,
    carb_source: "Oatmeal",
    carb_g: 40,
    fibrous_source: ["Zucchini"],
    fibrous_g: 100,
    macros: { protein: 35, starchyCarbs: 40, fibrousCarbs: 5, fat: 2, kcal: 340 },
    tags: ["competition_prep", "breakfast", "balanced"],
    includeCarbs: true
  },

  // ============================================
  // EGGS & SHAKES - PROTEIN + FRUIT
  // ============================================
  {
    id: "COMP-E5",
    category: "eggs_shakes",
    title: "Greek Yogurt + Berries",
    protein_source: "Greek Yogurt",
    protein_oz: 7,
    protein_g: 30,
    carb_source: "Mixed Berries",
    carb_g: 20,
    fibrous_source: [],
    macros: { protein: 30, starchyCarbs: 20, fibrousCarbs: 5, fat: 2, kcal: 225 },
    tags: ["competition_prep", "low_glycemic", "antioxidant"],
    includeCarbs: true
  },
  {
    id: "COMP-E6",
    category: "eggs_shakes",
    title: "Egg Whites + Grapefruit",
    protein_source: "Egg Whites",
    protein_oz: 8,
    protein_g: 35,
    carb_source: "Grapefruit",
    carb_g: 15,
    fibrous_source: [],
    macros: { protein: 35, starchyCarbs: 15, fibrousCarbs: 3, fat: 0, kcal: 215 },
    tags: ["competition_prep", "low_glycemic"],
    includeCarbs: true
  }
];

export const getCompetitionMealsByCategory = (category: AthleteMeal["category"]) =>
  competitionPremadeMeals.filter((meal) => meal.category === category);

export default competitionPremadeMeals;
