
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
  
  const NON_DAIRY_MILK_RE = /\b(almond|oat|soy|coconut|cashew|pea)[\s-]*milk\b/;
  const NON_DAIRY_BUTTER_RE = /\b(peanut|almond|cashew|sunflower|apple|pumpkin)[\s-]*butter\b/;
  const HALF_AND_HALF_RE = /\bhalf[\s&-]+and[\s&-]+half\b|half[\s-]*&[\s-]*half/;

  function isDairyIngredient(ingredient: string): boolean {
    if (NON_DAIRY_MILK_RE.test(ingredient)) return false;
    if (NON_DAIRY_BUTTER_RE.test(ingredient)) return false;
    if (HALF_AND_HALF_RE.test(ingredient)) return true;
    return ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'ghee'].some(dairy => ingredient.includes(dairy));
  }

  // Allergy Checks
  allergies.forEach((allergy: string) => {
    const allergyLower = allergy.toLowerCase();
    const hasAllergen = mealIngredients.some((ingredient: string) => 
      ingredient.includes(allergyLower) ||
      (allergyLower.includes('dairy') && isDairyIngredient(ingredient)) ||
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
    
    if (restrictionLower.includes('kosher')) {
      const KOSHER_FORBIDDEN = ['pork', 'bacon', 'ham', 'lard', 'shrimp', 'crab', 'lobster', 'clam', 'oyster', 'shellfish', 'scallop'];
      const MEAT_TERMS = ['chicken', 'beef', 'lamb', 'turkey', 'veal', 'steak', 'brisket', 'meat'];
      const DAIRY_TERMS = ['cheese', 'butter', 'cream', 'milk', 'yogurt', 'ghee'];
      const hasForbidden = mealIngredients.some((i: string) => KOSHER_FORBIDDEN.some(f => i.includes(f)))
        || KOSHER_FORBIDDEN.some(f => mealName.includes(f) || mealDescription.includes(f));
      const hasMeatDairyMix = MEAT_TERMS.some(m => mealIngredients.some((i: string) => i.includes(m)) || mealName.includes(m))
        && DAIRY_TERMS.some(d => mealIngredients.some((i: string) => i.includes(d)));
      if (hasForbidden) {
        badges.push({
          badge: '❌ Not Kosher — Forbidden Ingredient',
          explanation: 'This meal contains an ingredient that is not permitted under kosher law.',
          type: 'alert'
        });
      } else if (hasMeatDairyMix) {
        badges.push({
          badge: '❌ Not Kosher — Meat & Dairy Mixed',
          explanation: 'Mixing meat and dairy in the same meal violates kosher law (basar b\'chalav).',
          type: 'alert'
        });
      } else {
        badges.push({
          badge: '✅ Kosher Compliant',
          explanation: 'This meal does not contain known kosher violations. Confirm certification with your supplier.',
          type: 'safe'
        });
      }
    }

    if (restrictionLower.includes('halal')) {
      const HALAL_FORBIDDEN = ['pork', 'bacon', 'ham', 'lard', 'pepperoni', 'wine', 'beer', 'alcohol', 'sake', 'rum', 'bourbon', 'brandy'];
      const hasForbidden = mealIngredients.some((i: string) => HALAL_FORBIDDEN.some(f => i.includes(f)))
        || HALAL_FORBIDDEN.some(f => mealName.includes(f) || mealDescription.includes(f));
      if (hasForbidden) {
        badges.push({
          badge: '❌ Not Halal — Forbidden Ingredient',
          explanation: 'This meal contains an ingredient that is not permitted under halal law.',
          type: 'alert'
        });
      } else {
        badges.push({
          badge: '✅ Halal Compliant',
          explanation: 'This meal does not contain known halal violations. Confirm meat certification with your supplier.',
          type: 'safe'
        });
      }
    }

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
      const hasAnimalProducts = mealIngredients.some((ingredient: string) => {
        if (NON_DAIRY_MILK_RE.test(ingredient)) return false;
        if (NON_DAIRY_BUTTER_RE.test(ingredient)) return false;
        return ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'bacon', 'ham', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg'].some(animal => ingredient.includes(animal));
      });
      
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
