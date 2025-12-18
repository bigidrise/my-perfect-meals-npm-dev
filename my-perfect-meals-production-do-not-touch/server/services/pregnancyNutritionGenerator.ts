import type { User } from "@shared/schema";

interface PregnancyMealOptions {
  trimester: number;
  weekOfPregnancy: number;
  symptoms?: string[];
  user?: User;
}

interface PregnancyMeal {
  id: string;
  name: string;
  type: string;
  trimester: number;
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
    folate: number;
    iron: number;
    calcium: number;
    dha: number;
  };
  pregnancyBenefits: string[];
  medicalBadges: string[];
  imageUrl?: string;
}

interface PregnancyMealPlan {
  meals: PregnancyMeal[];
  trimesterGuidance: {
    trimester: number;
    keyNutrients: Array<{
      nutrient: string;
      dailyTarget: string;
      importance: string;
      sources: string[];
    }>;
    commonSymptoms: Array<{
      symptom: string;
      nutritionalSupport: string;
      helpfulFoods: string[];
    }>;
    avoidFoods: string[];
    lifestyle: {
      hydration: string;
      exercise: string;
      supplements: string[];
    };
  };
}

// Trimester-specific nutritional requirements
const trimesterRequirements = {
  1: {
    keyFocus: "Neural tube development, nausea management",
    calories: "+0 calories (maintain pre-pregnancy intake)",
    folate: "600-800 mcg daily",
    iron: "27mg daily", 
    symptoms: ["nausea", "fatigue", "food aversions"]
  },
  2: {
    keyFocus: "Rapid growth, bone development",
    calories: "+340 calories daily",
    calcium: "1000mg daily",
    protein: "+25g daily",
    symptoms: ["heartburn", "constipation", "increased appetite"]
  },
  3: {
    keyFocus: "Brain development, preparation for birth",
    calories: "+450 calories daily", 
    dha: "200-300mg daily",
    iron: "27mg daily (prevent anemia)",
    symptoms: ["shortness of breath", "swelling", "frequent urination"]
  }
};

export async function generatePregnancyMealPlan(options: PregnancyMealOptions): Promise<PregnancyMealPlan> {
  const { trimester, weekOfPregnancy, symptoms = [], user } = options;
  
  const meals: PregnancyMeal[] = [];
  
  // First Trimester Meals (Focus: Folate, anti-nausea)
  if (trimester === 1) {
    meals.push(
      {
        id: "pregnancy-t1-breakfast",
        name: "Folate-Rich Morning Bowl",
        type: "breakfast",
        trimester: 1,
        ingredients: [
          { name: "Fortified whole grain cereal", amount: "1", unit: "cup" },
          { name: "Greek yogurt", amount: "1/2", unit: "cup" },
          { name: "Fresh strawberries", amount: "1/2", unit: "cup" },
          { name: "Orange juice", amount: "1/2", unit: "cup fortified" },
          { name: "Chopped walnuts", amount: "2", unit: "tablespoons" },
          { name: "Chia seeds", amount: "1", unit: "tablespoon" }
        ],
        instructions: [
          "Pour fortified cereal into bowl",
          "Top with Greek yogurt and fresh strawberries",
          "Sprinkle with walnuts and chia seeds",
          "Serve with fortified orange juice",
          "Eat slowly if experiencing morning sickness"
        ],
        nutritionInfo: {
          calories: 385,
          protein: 18,
          carbs: 52,
          fat: 12,
          folate: 420,
          iron: 12,
          calcium: 320,
          dha: 0
        },
        pregnancyBenefits: [
          "High folate content prevents neural tube defects",
          "B vitamins help reduce nausea symptoms",
          "Easy to digest when experiencing morning sickness",
          "Calcium supports early bone development"
        ],
        medicalBadges: generatePregnancyBadges(user, "folate-rich", trimester),
        imageUrl: "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=400"
      },
      {
        id: "pregnancy-t1-snack",
        name: "Ginger Anti-Nausea Smoothie",
        type: "snack",
        trimester: 1,
        ingredients: [
          { name: "Fresh ginger", amount: "1", unit: "inch piece" },
          { name: "Banana", amount: "1", unit: "medium" },
          { name: "Spinach", amount: "1", unit: "cup fresh" },
          { name: "Almond milk", amount: "1", unit: "cup fortified" },
          { name: "Honey", amount: "1", unit: "tablespoon" },
          { name: "Ice cubes", amount: "1/2", unit: "cup" }
        ],
        instructions: [
          "Peel and chop fresh ginger",
          "Add all ingredients to blender",
          "Blend until smooth and creamy",
          "Serve immediately while cold",
          "Sip slowly to help settle stomach"
        ],
        nutritionInfo: {
          calories: 165,
          protein: 4,
          carbs: 35,
          fat: 3,
          folate: 58,
          iron: 2,
          calcium: 240,
          dha: 0
        },
        pregnancyBenefits: [
          "Ginger naturally reduces nausea and vomiting",
          "Spinach provides essential folate",
          "Easy to consume when solid foods are difficult",
          "Potassium from banana supports muscle function"
        ],
        medicalBadges: generatePregnancyBadges(user, "anti-nausea", trimester),
        imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400"
      }
    );
  }
  
  // Second Trimester Meals (Focus: Protein, calcium, increased calories)
  if (trimester === 2) {
    meals.push(
      {
        id: "pregnancy-t2-lunch",
        name: "Protein-Packed Quinoa Power Bowl",
        type: "lunch", 
        trimester: 2,
        ingredients: [
          { name: "Cooked quinoa", amount: "1", unit: "cup" },
          { name: "Grilled chicken breast", amount: "4", unit: "oz" },
          { name: "Black beans", amount: "1/2", unit: "cup" },
          { name: "Avocado", amount: "1/2", unit: "medium" },
          { name: "Cherry tomatoes", amount: "1/2", unit: "cup" },
          { name: "Feta cheese", amount: "2", unit: "tablespoons" },
          { name: "Lemon vinaigrette", amount: "2", unit: "tablespoons" }
        ],
        instructions: [
          "Layer cooked quinoa in bowl as base",
          "Top with sliced grilled chicken breast",
          "Add black beans and cherry tomatoes",
          "Add cubed avocado and crumbled feta",
          "Drizzle with lemon vinaigrette",
          "Mix gently before eating"
        ],
        nutritionInfo: {
          calories: 520,
          protein: 38,
          carbs: 42,
          fat: 22,
          folate: 85,
          iron: 8,
          calcium: 180,
          dha: 0
        },
        pregnancyBenefits: [
          "High protein supports rapid fetal growth",
          "Complete amino acids from quinoa and chicken",
          "Fiber helps prevent constipation",
          "Healthy fats support brain development"
        ],
        medicalBadges: generatePregnancyBadges(user, "high-protein", trimester),
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400"
      },
      {
        id: "pregnancy-t2-dinner",
        name: "Calcium-Rich Salmon & Sweet Potato",
        type: "dinner",
        trimester: 2,
        ingredients: [
          { name: "Wild salmon fillet", amount: "5", unit: "oz" },
          { name: "Roasted sweet potato", amount: "1", unit: "large" },
          { name: "Steamed broccoli", amount: "1.5", unit: "cups" },
          { name: "Tahini sauce", amount: "2", unit: "tablespoons" },
          { name: "Sesame seeds", amount: "1", unit: "tablespoon" },
          { name: "Olive oil", amount: "1", unit: "tablespoon" }
        ],
        instructions: [
          "Season salmon with herbs and bake at 400°F for 12-15 minutes",
          "Roast sweet potato until tender, about 45 minutes",
          "Steam broccoli until bright green and tender",
          "Make tahini sauce with lemon juice and water",
          "Serve salmon over sweet potato with broccoli",
          "Drizzle with tahini sauce and sprinkle sesame seeds"
        ],
        nutritionInfo: {
          calories: 485,
          protein: 35,
          carbs: 38,
          fat: 22,
          folate: 78,
          iron: 3,
          calcium: 285,
          dha: 1200
        },
        pregnancyBenefits: [
          "DHA supports baby's brain and eye development",
          "High calcium content for bone development",
          "Beta-carotene from sweet potato supports vision",
          "Omega-3s reduce inflammation"
        ],
        medicalBadges: generatePregnancyBadges(user, "dha-rich", trimester),
        imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400"
      }
    );
  }
  
  // Third Trimester Meals (Focus: DHA, iron, energy)
  if (trimester === 3) {
    meals.push(
      {
        id: "pregnancy-t3-breakfast",
        name: "Iron-Fortified Energy Breakfast",
        type: "breakfast",
        trimester: 3,
        ingredients: [
          { name: "Fortified oatmeal", amount: "1", unit: "cup cooked" },
          { name: "Dried apricots", amount: "1/4", unit: "cup" },
          { name: "Pumpkin seeds", amount: "2", unit: "tablespoons" },
          { name: "Almond butter", amount: "2", unit: "tablespoons" },
          { name: "Sliced banana", amount: "1/2", unit: "medium" },
          { name: "Vitamin C-rich orange juice", amount: "1/2", unit: "cup" }
        ],
        instructions: [
          "Prepare fortified oatmeal according to package directions",
          "Stir in chopped dried apricots while warm",
          "Top with almond butter and sliced banana",
          "Sprinkle with pumpkin seeds for crunch",
          "Serve with orange juice to enhance iron absorption",
          "Eat while warm for best taste and nutrient absorption"
        ],
        nutritionInfo: {
          calories: 445,
          protein: 16,
          carbs: 58,
          fat: 18,
          folate: 120,
          iron: 18,
          calcium: 185,
          dha: 0
        },
        pregnancyBenefits: [
          "High iron content prevents third trimester anemia",
          "Vitamin C enhances iron absorption",
          "Complex carbs provide sustained energy",
          "Healthy fats support final brain development"
        ],
        medicalBadges: generatePregnancyBadges(user, "iron-rich", trimester),
        imageUrl: "https://images.unsplash.com/photo-1571167855111-dfe565eea8e4?w=400"
      },
      {
        id: "pregnancy-t3-snack",
        name: "DHA-Rich Sardine & Avocado Toast",
        type: "snack",
        trimester: 3,
        ingredients: [
          { name: "Whole grain bread", amount: "2", unit: "slices" },
          { name: "Canned sardines", amount: "3", unit: "oz" },
          { name: "Ripe avocado", amount: "1", unit: "medium" },
          { name: "Lemon juice", amount: "1", unit: "tablespoon" },
          { name: "Cherry tomatoes", amount: "1/4", unit: "cup" },
          { name: "Sea salt", amount: "1", unit: "pinch" }
        ],
        instructions: [
          "Toast whole grain bread until golden",
          "Mash avocado with lemon juice and sea salt",
          "Spread avocado mixture on toast",
          "Top with sardines and cherry tomatoes",
          "Serve immediately while bread is still warm",
          "Can be cut into smaller pieces if preferred"
        ],
        nutritionInfo: {
          calories: 385,
          protein: 22,
          carbs: 32,
          fat: 22,
          folate: 65,
          iron: 4,
          calcium: 240,
          dha: 950
        },
        pregnancyBenefits: [
          "Extremely high DHA for final brain development",
          "Calcium supports baby's bone formation",
          "Protein supports rapid growth in third trimester",
          "Healthy fats prepare for breastfeeding"
        ],
        medicalBadges: generatePregnancyBadges(user, "brain-development", trimester),
        imageUrl: "https://images.unsplash.com/photo-1571197119374-5d89c4d84c1b?w=400"
      }
    );
  }

  return {
    meals,
    trimesterGuidance: generateTrimesterGuidance(trimester)
  };
}

function generateTrimesterGuidance(trimester: number) {
  const guidanceData = {
    1: {
      trimester: 1,
      keyNutrients: [
        {
          nutrient: "Folate/Folic Acid",
          dailyTarget: "600-800 mcg",
          importance: "Prevents neural tube defects and supports DNA formation",
          sources: ["Fortified cereals", "Leafy greens", "Legumes", "Citrus fruits"]
        },
        {
          nutrient: "Iron",
          dailyTarget: "27mg",
          importance: "Prevents anemia and supports increased blood volume",
          sources: ["Lean red meat", "Fortified cereals", "Spinach", "Beans"]
        },
        {
          nutrient: "Vitamin B6",
          dailyTarget: "1.9mg",
          importance: "Helps reduce nausea and supports brain development",
          sources: ["Chicken", "Fish", "Potatoes", "Bananas"]
        }
      ],
      commonSymptoms: [
        {
          symptom: "Morning Sickness",
          nutritionalSupport: "Small, frequent meals with ginger and vitamin B6",
          helpfulFoods: ["Crackers", "Ginger tea", "Bananas", "Toast"]
        },
        {
          symptom: "Fatigue",
          nutritionalSupport: "Iron-rich foods with vitamin C for absorption",
          helpfulFoods: ["Lean meats", "Citrus fruits", "Fortified cereals"]
        }
      ],
      avoidFoods: ["Raw fish", "Unpasteurized dairy", "High-mercury fish", "Raw eggs", "Alcohol"],
      lifestyle: {
        hydration: "8-10 glasses of water daily to support increased blood volume",
        exercise: "Light exercise like walking, avoid contact sports",
        supplements: ["Prenatal vitamin with folate", "Consider B6 for nausea"]
      }
    },
    2: {
      trimester: 2,
      keyNutrients: [
        {
          nutrient: "Protein",
          dailyTarget: "75-100g (+25g from pre-pregnancy)",
          importance: "Supports rapid fetal growth and maternal tissue changes",
          sources: ["Lean meats", "Fish", "Eggs", "Dairy", "Legumes"]
        },
        {
          nutrient: "Calcium",
          dailyTarget: "1000mg",
          importance: "Essential for baby's bone and tooth development",
          sources: ["Dairy products", "Fortified plant milks", "Sardines", "Kale"]
        },
        {
          nutrient: "Vitamin D",
          dailyTarget: "600 IU",
          importance: "Helps calcium absorption and bone development",
          sources: ["Fortified milk", "Fatty fish", "Egg yolks", "Sunlight"]
        }
      ],
      commonSymptoms: [
        {
          symptom: "Heartburn",
          nutritionalSupport: "Smaller meals, avoid spicy/acidic foods",
          helpfulFoods: ["Oatmeal", "Bananas", "Yogurt", "Ginger"]
        },
        {
          symptom: "Constipation",
          nutritionalSupport: "High fiber foods with plenty of water",
          helpfulFoods: ["Prunes", "Whole grains", "Vegetables", "Fruits"]
        }
      ],
      avoidFoods: ["Raw fish", "High-mercury fish", "Unpasteurized products", "Excessive caffeine"],
      lifestyle: {
        hydration: "10-12 glasses daily as blood volume increases",
        exercise: "Moderate exercise like swimming, prenatal yoga",
        supplements: ["Continue prenatal vitamin", "Consider DHA supplement"]
      }
    },
    3: {
      trimester: 3,
      keyNutrients: [
        {
          nutrient: "DHA (Omega-3)",
          dailyTarget: "200-300mg",
          importance: "Critical for baby's brain and eye development",
          sources: ["Fatty fish", "Walnuts", "Chia seeds", "DHA supplements"]
        },
        {
          nutrient: "Iron",
          dailyTarget: "27mg",
          importance: "Prevents anemia as blood volume peaks",
          sources: ["Red meat", "Dark leafy greens", "Fortified cereals"]
        },
        {
          nutrient: "Choline",
          dailyTarget: "450mg",
          importance: "Supports brain development and memory",
          sources: ["Eggs", "Beef liver", "Fish", "Soybeans"]
        }
      ],
      commonSymptoms: [
        {
          symptom: "Swelling",
          nutritionalSupport: "Reduce sodium, increase potassium-rich foods",
          helpfulFoods: ["Bananas", "Potatoes", "Spinach", "Low-sodium options"]
        },
        {
          symptom: "Shortness of Breath",
          nutritionalSupport: "Smaller, more frequent meals to avoid fullness",
          helpfulFoods: ["Small portions", "Nutrient-dense foods", "Iron-rich options"]
        }
      ],
      avoidFoods: ["Raw fish", "High-mercury fish", "Excess sodium", "Large meals"],
      lifestyle: {
        hydration: "8-10 glasses daily, monitor for swelling",
        exercise: "Gentle exercises, avoid lying flat on back",
        supplements: ["Prenatal vitamin", "DHA supplement", "Consider probiotics"]
      }
    }
  };

  return guidanceData[trimester as keyof typeof guidanceData];
}

function generatePregnancyBadges(user: User | undefined, mealType: string, trimester: number): string[] {
  const badges: string[] = [];
  
  // Trimester-specific badges
  badges.push(`Trimester ${trimester} Optimized`);
  
  if (mealType.includes("folate")) {
    badges.push("Folate-Rich");
  }
  
  if (mealType.includes("anti-nausea")) {
    badges.push("Nausea-Fighting");
  }
  
  if (mealType.includes("high-protein")) {
    badges.push("High-Protein");
  }
  
  if (mealType.includes("dha")) {
    badges.push("DHA-Rich");
  }
  
  if (mealType.includes("iron")) {
    badges.push("Iron-Fortified");
  }
  
  if (mealType.includes("brain")) {
    badges.push("Brain-Development");
  }
  
  // Pregnancy safety badge
  badges.push("Pregnancy-Safe");
  
  return badges;
}