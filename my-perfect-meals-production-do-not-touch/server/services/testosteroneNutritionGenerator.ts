import type { User } from "@shared/schema";
import { convertStructuredIngredients } from "../utils/unitConverter";

interface TestosteroneMealOptions {
  testosteroneLevel: number;
  activityLevel: string;
  user?: User;
}

interface TestosteroneMeal {
  id: string;
  name: string;
  type: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
  }>;
  instructions: string[];
  nutritionInfo: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    zinc: number;
    vitaminD: number;
  };
  testosteroneBenefits: string[];
  medicalBadges: string[];
  imageUrl?: string;
}

interface TestosteroneMealPlan {
  meals: TestosteroneMeal[];
  nutritionalGuidance: {
    dailyTargets: {
      zinc: string;
      vitaminD: string;
      protein: string;
      healthyFats: string;
    };
    keyNutrients: Array<{
      nutrient: string;
      benefit: string;
      sources: string[];
    }>;
    lifestyle: {
      timing: string[];
      exercise: string[];
      sleep: string[];
    };
  };
}

// Science-based testosterone-supporting foods
const testosteroneBoostingIngredients = {
  highZinc: [
    { name: "Oysters", zinc: "74mg per 100g", benefit: "Highest natural zinc source" },
    { name: "Grass-fed beef", zinc: "12mg per 100g", benefit: "High bioavailable zinc + protein" },
    { name: "Pumpkin seeds", zinc: "10mg per 100g", benefit: "Plant-based zinc + healthy fats" },
    { name: "Dark chocolate", zinc: "9mg per 100g", benefit: "Zinc + antioxidants" }
  ],
  vitaminD: [
    { name: "Wild salmon", vitaminD: "988 IU per 100g", benefit: "Omega-3 + vitamin D" },
    { name: "Sardines", vitaminD: "480 IU per 100g", benefit: "Complete protein + vitamin D" },
    { name: "Egg yolks", vitaminD: "87 IU per yolk", benefit: "Cholesterol for hormone production" },
    { name: "Tuna", vitaminD: "200 IU per 100g", benefit: "Lean protein + vitamin D" }
  ],
  healthyFats: [
    { name: "Extra virgin olive oil", benefit: "Monounsaturated fats for hormone production" },
    { name: "Avocado", benefit: "Healthy fats + potassium" },
    { name: "Walnuts", benefit: "Omega-3 fatty acids" },
    { name: "Brazil nuts", benefit: "Selenium for testosterone synthesis" }
  ],
  cruciferous: [
    { name: "Broccoli", benefit: "DIM compound reduces estrogen" },
    { name: "Cauliflower", benefit: "Supports healthy estrogen metabolism" },
    { name: "Brussels sprouts", benefit: "Phytonutrients for hormone balance" }
  ]
};

export async function generateTestosteroneSupportMeals(options: TestosteroneMealOptions): Promise<TestosteroneMealPlan> {
  const { testosteroneLevel, activityLevel, user } = options;
  
  // Determine meal plan intensity based on testosterone level
  const needsSupport = testosteroneLevel < 400;
  const isOptimal = testosteroneLevel > 600;
  
  const meals: TestosteroneMeal[] = [
    // High-zinc breakfast
    {
      id: "testosterone-breakfast-1",
      name: "Testosterone Power Breakfast",
      type: "breakfast",
      ingredients: convertStructuredIngredients([
        { name: "Free-range eggs", amount: "3", unit: "large" },
        { name: "Grass-fed beef sausage", amount: "2", unit: "links" },
        { name: "Spinach", amount: "1", unit: "cup" },
        { name: "Avocado", amount: "1/2", unit: "medium" },
        { name: "Pumpkin seeds", amount: "1", unit: "tablespoon" },
        { name: "Extra virgin olive oil", amount: "1", unit: "tablespoon" }
      ]),
      instructions: [
        "Heat olive oil in a non-stick pan over medium heat",
        "Cook grass-fed sausage until browned, about 5-6 minutes",
        "Add spinach to the pan and cook until wilted",
        "Scramble eggs with the spinach mixture",
        "Serve with sliced avocado and sprinkle pumpkin seeds on top",
        "Season with salt, pepper, and herbs to taste"
      ],
      nutritionInfo: {
        calories: 485,
        protein: 28,
        carbs: 8,
        fat: 38,
        zinc: 4.2,
        vitaminD: 120
      },
      testosteroneBenefits: [
        "High zinc content supports testosterone production",
        "Cholesterol from eggs provides building blocks for hormones",
        "Healthy fats optimize hormone synthesis",
        "Vitamin D from eggs supports testosterone levels"
      ],
      medicalBadges: generateMedicalBadges(user, "high-protein-low-carb"),
      imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400"
    },
    
    // Zinc-rich lunch
    {
      id: "testosterone-lunch-1", 
      name: "Zinc-Powered Beef & Broccoli Bowl",
      type: "lunch",
      ingredients: convertStructuredIngredients([
        { name: "Grass-fed ground beef", amount: "6", unit: "oz" },
        { name: "Broccoli florets", amount: "2", unit: "cups" },
        { name: "Brown rice", amount: "1/2", unit: "cup cooked" },
        { name: "Walnuts", amount: "1/4", unit: "cup" },
        { name: "Garlic", amount: "3", unit: "cloves" },
        { name: "Coconut oil", amount: "1", unit: "tablespoon" }
      ]),
      instructions: [
        "Heat coconut oil in a large skillet over medium-high heat",
        "Add ground beef and cook until browned, breaking it up as it cooks",
        "Add minced garlic and cook for 1 minute until fragrant",
        "Steam broccoli until tender-crisp, about 4-5 minutes",
        "Serve beef over brown rice, top with steamed broccoli",
        "Garnish with chopped walnuts for extra healthy fats"
      ],
      nutritionInfo: {
        calories: 520,
        protein: 35,
        carbs: 28,
        fat: 32,
        zinc: 8.5,
        vitaminD: 15
      },
      testosteroneBenefits: [
        "Grass-fed beef provides high bioavailable zinc",
        "Broccoli contains DIM compound that helps balance hormones",
        "Walnuts provide omega-3 fatty acids for hormone production",
        "Complex carbs support energy for testosterone synthesis"
      ],
      medicalBadges: generateMedicalBadges(user, "heart-healthy-high-protein"),
      imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400"
    },

    // Omega-3 rich dinner
    {
      id: "testosterone-dinner-1",
      name: "Wild Salmon with Testosterone-Supporting Sides",
      type: "dinner", 
      ingredients: convertStructuredIngredients([
        { name: "Wild-caught salmon", amount: "6", unit: "oz" },
        { name: "Brussels sprouts", amount: "2", unit: "cups" },
        { name: "Sweet potato", amount: "1", unit: "medium" },
        { name: "Brazil nuts", amount: "3", unit: "pieces" },
        { name: "Lemon", amount: "1", unit: "whole" },
        { name: "Olive oil", amount: "2", unit: "tablespoons" }
      ]),
      instructions: [
        "Preheat oven to 400°F (200°C)",
        "Season salmon with lemon juice, salt, and pepper",
        "Cube sweet potato and toss with 1 tbsp olive oil",
        "Halve Brussels sprouts and toss with remaining olive oil",
        "Roast vegetables for 25 minutes, salmon for 12-15 minutes",
        "Serve with crushed Brazil nuts on top for selenium boost"
      ],
      nutritionInfo: {
        calories: 465,
        protein: 38,
        carbs: 22,
        fat: 28,
        zinc: 1.2,
        vitaminD: 988
      },
      testosteroneBenefits: [
        "Salmon provides vitamin D essential for testosterone production",
        "Omega-3 fatty acids reduce inflammation and support hormone health",
        "Brazil nuts are rich in selenium for testosterone synthesis",
        "Brussels sprouts help metabolize excess estrogen"
      ],
      medicalBadges: generateMedicalBadges(user, "heart-healthy-anti-inflammatory"),
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400"
    },

    // Testosterone-boosting snack
    {
      id: "testosterone-snack-1",
      name: "Hormone-Boosting Trail Mix",
      type: "snack",
      ingredients: convertStructuredIngredients([
        { name: "Raw almonds", amount: "1/4", unit: "cup" },
        { name: "Pumpkin seeds", amount: "2", unit: "tablespoons" },
        { name: "Dark chocolate", amount: "1", unit: "oz 85% cacao" },
        { name: "Dried goji berries", amount: "1", unit: "tablespoon" },
        { name: "Brazil nuts", amount: "2", unit: "pieces" }
      ]),
      instructions: [
        "Combine all ingredients in a bowl",
        "Mix well to distribute evenly",
        "Store in an airtight container",
        "Consume as a mid-afternoon energy boost",
        "Pair with green tea for additional antioxidants"
      ],
      nutritionInfo: {
        calories: 285,
        protein: 12,
        carbs: 18,
        fat: 22,
        zinc: 3.8,
        vitaminD: 0
      },
      testosteroneBenefits: [
        "High zinc content from pumpkin seeds supports T-production",
        "Dark chocolate provides magnesium and antioxidants",
        "Brazil nuts deliver selenium for hormone synthesis",
        "Healthy fats support overall hormone production"
      ],
      medicalBadges: generateMedicalBadges(user, "antioxidant-rich"),
      imageUrl: "https://images.unsplash.com/photo-1599599810694-57a2ca91f4af?w=400"
    }
  ];

  return {
    meals,
    nutritionalGuidance: {
      dailyTargets: {
        zinc: "11-15mg (testosterone production)",
        vitaminD: "600-800 IU (hormone synthesis)",
        protein: "1.6-2.2g per kg body weight (muscle maintenance)",
        healthyFats: "25-35% of total calories (hormone production)"
      },
      keyNutrients: [
        {
          nutrient: "Zinc",
          benefit: "Essential cofactor for testosterone production and sperm health",
          sources: ["Oysters", "Grass-fed beef", "Pumpkin seeds", "Dark chocolate"]
        },
        {
          nutrient: "Vitamin D",
          benefit: "Supports testosterone synthesis and immune function",
          sources: ["Wild salmon", "Sardines", "Egg yolks", "Fortified foods"]
        },
        {
          nutrient: "Healthy Fats",
          benefit: "Provide cholesterol and building blocks for hormone production",
          sources: ["Olive oil", "Avocados", "Nuts", "Fatty fish"]
        },
        {
          nutrient: "Magnesium",
          benefit: "Supports testosterone production and reduces cortisol",
          sources: ["Dark leafy greens", "Nuts", "Seeds", "Dark chocolate"]
        }
      ],
      lifestyle: {
        timing: [
          "Eat protein within 1 hour of waking to support morning testosterone peak",
          "Have largest meals earlier in the day when testosterone is highest",
          "Stop eating 3 hours before bed to optimize sleep and recovery"
        ],
        exercise: [
          "Combine with resistance training for maximum testosterone benefits",
          "Consume protein within 2 hours post-workout",
          "Avoid excessive endurance exercise which can lower testosterone"
        ],
        sleep: [
          "Aim for 7-9 hours of quality sleep for optimal hormone production",
          "Most testosterone is produced during deep sleep phases",
          "Avoid large meals and alcohol before bedtime"
        ]
      }
    }
  };
}

function generateMedicalBadges(user: User | undefined, mealType: string): string[] {
  const badges: string[] = [];
  
  // Base testosterone support badge
  badges.push("Testosterone-Supporting");
  
  if (mealType.includes("high-protein")) {
    badges.push("High-Protein");
  }
  
  if (mealType.includes("heart-healthy")) {
    badges.push("Heart-Healthy");
  }
  
  if (mealType.includes("anti-inflammatory")) {
    badges.push("Anti-Inflammatory");
  }
  
  if (mealType.includes("antioxidant")) {
    badges.push("Antioxidant-Rich");
  }
  
  if (mealType.includes("low-carb")) {
    badges.push("Low-Carb");
  }
  
  // Medical condition considerations
  if (user?.healthConditions?.includes("diabetes")) {
    badges.push("Diabetes-Friendly");
  }
  
  if (user?.healthConditions?.includes("hypertension")) {
    badges.push("Heart-Safe");
  }
  
  return badges;
}