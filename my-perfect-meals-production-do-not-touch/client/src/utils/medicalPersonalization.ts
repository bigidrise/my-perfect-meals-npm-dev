import type { Recipe } from "@shared/schema";

export interface MedicalBadge {
  id: string;
  label: string;
  description: string;
  color: string;
  textColor: string;
  category: 'metabolic' | 'digestive' | 'cardiovascular' | 'allergies' | 'fitness' | 'dietary';
}

export interface UserMedicalProfile {
  medicalConditions: string[];
  foodAllergies: string[];
  dietaryRestrictions: string[];
  primaryGoal: string;
  activityLevel: string;
  customConditions: Record<string, string>;
}

// Medical condition definitions with meal compatibility rules
const MEDICAL_CONDITIONS = {
  // Metabolic Conditions
  'diabetes_type1': {
    label: 'Type 1 Diabetes',
    category: 'metabolic' as const,
    color: 'bg-yellow-100 border-yellow-400',
    textColor: 'text-yellow-800',
    rules: (recipe: Recipe) => {
      const lowCarb = (recipe.carbs || 0) < 30;
      const highFiber = (recipe.fiber || 0) >= 3;
      const noSugar = (recipe.sugar || 0) < 10;
      return { compatible: lowCarb && highFiber && noSugar, reasons: [`Low carbs (${recipe.carbs}g)`, `High fiber (${recipe.fiber}g)`, `Low sugar (${recipe.sugar}g)`].filter((_, i) => [lowCarb, highFiber, noSugar][i]) }
    }
  },
  'diabetes_type2': {
    label: 'Type 2 Diabetes',
    category: 'metabolic' as const,
    color: 'bg-yellow-100 border-yellow-400',
    textColor: 'text-yellow-800',
    rules: (recipe: Recipe) => {
      const moderateCarbs = (recipe.carbs || 0) < 45;
      const highFiber = (recipe.fiber || 0) >= 2;
      const lowSugar = (recipe.sugar || 0) < 15;
      return { compatible: moderateCarbs && highFiber && lowSugar, reasons: [`Moderate carbs (${recipe.carbs}g)`, `Good fiber (${recipe.fiber}g)`, `Controlled sugar (${recipe.sugar}g)`].filter((_, i) => [moderateCarbs, highFiber, lowSugar][i]) }
    }
  },
  'prediabetes': {
    label: 'Pre-diabetes',
    category: 'metabolic' as const,
    color: 'bg-orange-100 border-orange-400',
    textColor: 'text-orange-800',
    rules: (recipe: Recipe) => {
      const moderateCarbs = (recipe.carbs || 0) < 50;
      const balanced = (recipe.protein || 0) >= 15;
      return { compatible: moderateCarbs && balanced, reasons: [`Moderate carbs (${recipe.carbs}g)`, `Good protein (${recipe.protein}g)`].filter((_, i) => [moderateCarbs, balanced][i]) }
    }
  },
  'insulin_dependent': {
    label: 'Insulin Dependent',
    category: 'metabolic' as const,
    color: 'bg-red-100 border-red-400',
    textColor: 'text-red-800',
    rules: (recipe: Recipe) => {
      const carbs = recipe.carbs || 0;
      const predictableCarbs = carbs > 0 && carbs < 60;
      const hasProtein = (recipe.protein || 0) >= 10;
      return { compatible: predictableCarbs && hasProtein, reasons: [`Predictable carbs (${carbs}g)`, `Adequate protein (${recipe.protein}g)`].filter((_, i) => [predictableCarbs, hasProtein][i]) }
    }
  },
  'hypertension': {
    label: 'High Blood Pressure',
    category: 'cardiovascular' as const,
    color: 'bg-blue-100 border-blue-400',
    textColor: 'text-blue-800',
    rules: (recipe: Recipe) => {
      const lowSodium = (recipe.sodium || 0) < 600;
      const hasKnown = recipe.ingredients?.some(ing => 
        ['banana', 'spinach', 'sweet potato', 'avocado', 'beans'].some(food => 
          ing.name.toLowerCase().includes(food)
        )
      ) || false;
      return { compatible: lowSodium, reasons: [`Low sodium (${recipe.sodium}mg)`, hasKnown ? 'Heart-healthy ingredients' : ''].filter(Boolean) }
    }
  },
  'high_cholesterol': {
    label: 'High Cholesterol',
    category: 'cardiovascular' as const,
    color: 'bg-blue-100 border-blue-400',
    textColor: 'text-blue-800',
    rules: (recipe: Recipe) => {
      const lowSatFat = (recipe.fat || 0) < 10;
      const hasOmega3 = recipe.ingredients?.some(ing => 
        ['salmon', 'tuna', 'walnuts', 'chia', 'flax'].some(food => 
          ing.name.toLowerCase().includes(food)
        )
      ) || false;
      return { compatible: lowSatFat, reasons: [`Low saturated fat`, hasOmega3 ? 'Contains omega-3s' : ''].filter(Boolean) }
    }
  },
  'crohns_disease': {
    label: "Crohn's Disease",
    category: 'digestive' as const,
    color: 'bg-green-100 border-green-400',
    textColor: 'text-green-800',
    rules: (recipe: Recipe) => {
      const lowFiber = (recipe.fiber || 0) < 3;
      const easyDigest = recipe.instructions?.some(inst => 
        inst.toLowerCase().includes('cook') || inst.toLowerCase().includes('steam')
      ) || false;
      const noSeeds = !recipe.ingredients?.some(ing => 
        ['nuts', 'seeds', 'corn', 'popcorn'].some(avoid => 
          ing.name.toLowerCase().includes(avoid)
        )
      ) || true;
      return { compatible: lowFiber && noSeeds, reasons: [`Low fiber (${recipe.fiber}g)`, 'No seeds/nuts', easyDigest ? 'Well-cooked' : ''].filter(Boolean) }
    }
  },
  'ibs': {
    label: 'IBS',
    category: 'digestive' as const,
    color: 'bg-green-100 border-green-400',
    textColor: 'text-green-800',
    rules: (recipe: Recipe) => {
      const moderateFiber = (recipe.fiber || 0) >= 2 && (recipe.fiber || 0) < 8;
      const lowFodmap = !recipe.ingredients?.some(ing => 
        ['onion', 'garlic', 'beans', 'apple'].some(fodmap => 
          ing.name.toLowerCase().includes(fodmap)
        )
      ) || true;
      return { compatible: moderateFiber && lowFodmap, reasons: [`Moderate fiber (${recipe.fiber}g)`, 'Low FODMAP friendly'].filter(Boolean) }
    }
  }
};

// Food allergy definitions
const FOOD_ALLERGIES = {
  'nuts': {
    label: 'Nut-Free',
    category: 'allergies' as const,
    color: 'bg-red-100 border-red-500',
    textColor: 'text-red-800',
    rules: (recipe: Recipe) => {
      const nutFree = !recipe.ingredients?.some(ing => 
        ['nuts', 'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'hazelnut'].some(nut => 
          ing.name.toLowerCase().includes(nut)
        )
      ) || true;
      return { compatible: nutFree, reasons: nutFree ? ['No nuts or nut products'] : [] }
    }
  },
  'dairy': {
    label: 'Dairy-Free',
    category: 'allergies' as const,
    color: 'bg-red-100 border-red-500',
    textColor: 'text-red-800',
    rules: (recipe: Recipe) => {
      const dairyFree = !recipe.ingredients?.some(ing => 
        ['milk', 'cheese', 'butter', 'yogurt', 'cream'].some(dairy => 
          ing.name.toLowerCase().includes(dairy)
        )
      ) || true;
      return { compatible: dairyFree, reasons: dairyFree ? ['No dairy products'] : [] }
    }
  },
  'gluten': {
    label: 'Gluten-Free',
    category: 'allergies' as const,
    color: 'bg-red-100 border-red-500',
    textColor: 'text-red-800',
    rules: (recipe: Recipe) => {
      const glutenFree = !recipe.ingredients?.some(ing => 
        ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye'].some(gluten => 
          ing.name.toLowerCase().includes(gluten)
        )
      ) || true;
      return { compatible: glutenFree, reasons: glutenFree ? ['No gluten-containing ingredients'] : [] }
    }
  },
  'shellfish': {
    label: 'Shellfish-Free',
    category: 'allergies' as const,
    color: 'bg-red-100 border-red-500',
    textColor: 'text-red-800',
    rules: (recipe: Recipe) => {
      const shellfishFree = !recipe.ingredients?.some(ing => 
        ['shrimp', 'crab', 'lobster', 'clam', 'oyster', 'scallop'].some(shellfish => 
          ing.name.toLowerCase().includes(shellfish)
        )
      ) || true;
      return { compatible: shellfishFree, reasons: shellfishFree ? ['No shellfish'] : [] }
    }
  }
};

// Fitness goal compatibility
const FITNESS_GOALS = {
  'weight_loss': {
    label: 'Weight Loss',
    category: 'fitness' as const,
    color: 'bg-purple-100 border-purple-400',
    textColor: 'text-purple-800',
    rules: (recipe: Recipe) => {
      const lowCalorie = (recipe.calories || 0) < 500;
      const highProtein = (recipe.protein || 0) >= 15;
      const goodFiber = (recipe.fiber || 0) >= 3;
      return { compatible: lowCalorie, reasons: [`Low calories (${recipe.calories})`, highProtein ? `High protein (${recipe.protein}g)` : '', goodFiber ? `High fiber (${recipe.fiber}g)` : ''].filter(Boolean) }
    }
  },
  'muscle_gain': {
    label: 'Muscle Building',
    category: 'fitness' as const,
    color: 'bg-indigo-100 border-indigo-400',
    textColor: 'text-indigo-800',
    rules: (recipe: Recipe) => {
      const highProtein = (recipe.protein || 0) >= 25;
      const goodCalories = (recipe.calories || 0) >= 400;
      const hasCarbs = (recipe.carbs || 0) >= 20;
      return { compatible: highProtein, reasons: [`High protein (${recipe.protein}g)`, goodCalories ? `Good calories (${recipe.calories})` : '', hasCarbs ? `Good carbs (${recipe.carbs}g)` : ''].filter(Boolean) }
    }
  },
  'maintenance': {
    label: 'Weight Maintenance',
    category: 'fitness' as const,
    color: 'bg-gray-100 border-gray-400',
    textColor: 'text-gray-800',
    rules: (recipe: Recipe) => {
      const balanced = (recipe.calories || 0) >= 300 && (recipe.calories || 0) <= 600;
      const goodProtein = (recipe.protein || 0) >= 12;
      return { compatible: balanced, reasons: [`Balanced calories (${recipe.calories})`, goodProtein ? `Good protein (${recipe.protein}g)` : ''].filter(Boolean) }
    }
  }
};

// Generate medical badges for a recipe based on user's medical profile
export function generateMedicalBadges(recipe: Recipe, userProfile: UserMedicalProfile): MedicalBadge[] {
  const badges: MedicalBadge[] = [];

  // Check medical conditions
  userProfile.medicalConditions.forEach(conditionId => {
    const condition = MEDICAL_CONDITIONS[conditionId as keyof typeof MEDICAL_CONDITIONS];
    if (condition) {
      const compatibility = condition.rules(recipe);
      if (compatibility.compatible) {
        badges.push({
          id: `medical-${conditionId}`,
          label: condition.label,
          description: `Safe for ${condition.label}: ${compatibility.reasons.join(', ')}`,
          color: condition.color,
          textColor: condition.textColor,
          category: condition.category
        });
      }
    }
  });

  // Check food allergies
  userProfile.foodAllergies.forEach(allergyId => {
    const allergy = FOOD_ALLERGIES[allergyId as keyof typeof FOOD_ALLERGIES];
    if (allergy) {
      const compatibility = allergy.rules(recipe);
      if (compatibility.compatible) {
        badges.push({
          id: `allergy-${allergyId}`,
          label: allergy.label,
          description: `Safe for ${allergy.label}: ${compatibility.reasons.join(', ')}`,
          color: allergy.color,
          textColor: allergy.textColor,
          category: allergy.category
        });
      }
    }
  });

  // Check fitness goals
  const fitnessGoal = FITNESS_GOALS[userProfile.primaryGoal as keyof typeof FITNESS_GOALS];
  if (fitnessGoal) {
    const compatibility = fitnessGoal.rules(recipe);
    if (compatibility.compatible) {
      badges.push({
        id: `fitness-${userProfile.primaryGoal}`,
        label: fitnessGoal.label,
        description: `Supports ${fitnessGoal.label}: ${compatibility.reasons.join(', ')}`,
        color: fitnessGoal.color,
        textColor: fitnessGoal.textColor,
        category: fitnessGoal.category
      });
    }
  }

  // Check dietary restrictions
  userProfile.dietaryRestrictions.forEach(restriction => {
    if (recipe.dietaryRestrictions?.includes(restriction)) {
      badges.push({
        id: `dietary-${restriction}`,
        label: restriction.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `Meets ${restriction.replace('_', ' ')} dietary requirements`,
        color: 'bg-green-100 border-green-400',
        textColor: 'text-green-800',
        category: 'dietary'
      });
    }
  });

  return badges;
}

// Get a mock user profile (you'll replace this with real API data)
export function getUserMedicalProfile(userId: number): UserMedicalProfile {
  // This should come from your user API/database
  // For now, return a sample profile for demonstration
  return {
    medicalConditions: ['diabetes_type2', 'hypertension'],
    foodAllergies: ['nuts', 'dairy'],
    dietaryRestrictions: ['gluten_free'],
    primaryGoal: 'weight_loss',
    activityLevel: 'moderate',
    customConditions: {}
  };
}

// Images removed for alpha testing - focusing on ingredients and instructions
export function generateRecipeImage(recipeName: string): string {
  // Function removed - no images for alpha testing
  return "";
}