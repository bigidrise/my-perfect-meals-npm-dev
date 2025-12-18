
// client/src/utils/medicalBadges.ts
export interface UserProfile {
  allergies?: string[];
  healthConditions?: string[];
  dietaryRestrictions?: string[];
  age?: number;
  weight?: number;
  height?: number;
  activityLevel?: string;
  goals?: string[];
}

export interface MedicalBadge {
  badge: string;
  explanation: string;
  type: 'safe' | 'warning' | 'alert';
}

export function getUserMedicalProfile(userId: number): UserProfile {
  // For development, return a mock profile
  // In production, this would fetch from your user profile API
  const mockProfile: UserProfile = {
    allergies: ['nuts', 'dairy'],
    healthConditions: ['diabetes', 'hypertension'],
    dietaryRestrictions: ['vegetarian'],
    age: 35,
    weight: 70,
    height: 170,
    activityLevel: 'moderate',
    goals: ['weight_loss', 'muscle_gain']
  };
  
  // Try to get from localStorage first
  const stored = localStorage.getItem('userOnboardingProfile');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...mockProfile, ...parsed };
    } catch (e) {
      console.warn('Failed to parse stored profile, using mock');
    }
  }
  
  return mockProfile;
}

export function generateMedicalBadges(meal: any, userProfile: UserProfile): MedicalBadge[] {
  const badges: MedicalBadge[] = [];
  
  if (!meal || !userProfile) {
    return badges;
  }
  
  const allergies = userProfile.allergies || [];
  const healthConditions = userProfile.healthConditions || [];
  const dietaryRestrictions = userProfile.dietaryRestrictions || [];
  const mealIngredients = meal.ingredients?.map((i: any) => (i.name || i.item || '').toLowerCase()) || [];
  const mealName = (meal.name || '').toLowerCase();
  const mealDescription = (meal.description || '').toLowerCase();
  
  // Allergy Checks
  allergies.forEach((allergy: string) => {
    const allergyLower = allergy.toLowerCase();
    const hasAllergen = mealIngredients.some((ingredient: string) => 
      ingredient.includes(allergyLower) ||
      (allergyLower.includes('dairy') && ['milk', 'cheese', 'butter', 'cream', 'yogurt'].some(dairy => ingredient.includes(dairy))) ||
      (allergyLower.includes('nuts') && ['peanut', 'almond', 'walnut', 'cashew', 'pecan'].some(nut => ingredient.includes(nut))) ||
      (allergyLower.includes('gluten') && ['wheat', 'flour', 'bread', 'pasta'].some(gluten => ingredient.includes(gluten)))
    ) || mealName.includes(allergyLower) || mealDescription.includes(allergyLower);
    
    if (hasAllergen) {
      badges.push({
        badge: `⚠️ Contains ${allergy}`,
        explanation: `This meal contains ${allergy}. Avoid if you have a ${allergy} allergy.`,
        type: 'alert'
      });
    } else {
      badges.push({
        badge: `✅ ${allergy}-Free`,
        explanation: `This meal does not contain ${allergy}. Safe for individuals with ${allergy} allergies.`,
        type: 'safe'
      });
    }
  });
  
  // Health Condition Checks
  healthConditions.forEach((condition: string) => {
    const conditionLower = condition.toLowerCase();
    
    if (conditionLower.includes('diabetes')) {
      const carbCount = meal.nutrition?.carbs || meal.carbs || meal.nutrition?.carbs_g || 0;
      if (carbCount <= 30) {
        badges.push({
          badge: '✅ Diabetes-Friendly',
          explanation: `Low carbohydrate content (${carbCount}g) suitable for diabetes management.`,
          type: 'safe'
        });
      } else if (carbCount > 45) {
        badges.push({
          badge: '⚠️ High Carbs',
          explanation: `Higher carbohydrate content (${carbCount}g) - monitor blood glucose carefully.`,
          type: 'warning'
        });
      }
    }
    
    if (conditionLower.includes('hypertension') || conditionLower.includes('high blood pressure')) {
      const sodiumContent = meal.nutrition?.sodium || meal.sodium || 0;
      if (sodiumContent <= 600) {
        badges.push({
          badge: '✅ Heart-Healthy',
          explanation: `Low sodium content suitable for blood pressure management.`,
          type: 'safe'
        });
      } else {
        badges.push({
          badge: '⚠️ High Sodium',
          explanation: `Higher sodium content - consider reducing portion or modifying recipe.`,
          type: 'warning'
        });
      }
    }
  });
  
  // Dietary Restriction Checks
  dietaryRestrictions.forEach((restriction: string) => {
    const restrictionLower = restriction.toLowerCase();
    
    if (restrictionLower.includes('vegetarian')) {
      const hasMeat = mealIngredients.some((ingredient: string) =>
        ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'bacon', 'ham'].some(meat => ingredient.includes(meat))
      ) || ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'bacon', 'ham'].some(meat => 
        mealName.includes(meat) || mealDescription.includes(meat)
      );
      
      if (hasMeat) {
        badges.push({
          badge: '❌ Contains Meat',
          explanation: 'This meal contains meat products. Not suitable for vegetarian diet.',
          type: 'alert'
        });
      } else {
        badges.push({
          badge: '✅ Vegetarian',
          explanation: 'This meal is suitable for vegetarian diet.',
          type: 'safe'
        });
      }
    }
    
    if (restrictionLower.includes('vegan')) {
      const hasAnimalProducts = mealIngredients.some((ingredient: string) =>
        ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'bacon', 'ham', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg'].some(animal => ingredient.includes(animal))
      );
      
      if (hasAnimalProducts) {
        badges.push({
          badge: '❌ Contains Animal Products',
          explanation: 'This meal contains animal products. Not suitable for vegan diet.',
          type: 'alert'
        });
      } else {
        badges.push({
          badge: '✅ Vegan',
          explanation: 'This meal is suitable for vegan diet.',
          type: 'safe'
        });
      }
    }
  });
  
  // If no specific badges were generated, add a general safety badge
  if (badges.length === 0) {
    badges.push({
      badge: '✅ No Restrictions',
      explanation: 'This meal appears suitable for your dietary profile.',
      type: 'safe'
    });
  }
  
  return badges;
}
