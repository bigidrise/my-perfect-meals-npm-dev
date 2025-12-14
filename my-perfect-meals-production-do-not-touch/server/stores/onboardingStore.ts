import type { OnboardingProfile, DietType, Condition } from '../../shared/types/profile';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export async function getUserOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length) {
      console.warn(`No user found for ID: ${userId}`);
      return null;
    }

    const userData = user[0];
    
    // Map database fields to OnboardingProfile
    const profile: OnboardingProfile = {
      userId: userData.id,
      caloriesTarget: userData.dailyCalorieTarget || undefined,
      proteinTargetG: undefined, // Add to schema if needed
      carbsTargetG: undefined,   // Add to schema if needed  
      fatTargetG: undefined,     // Add to schema if needed
      preferredDiets: mapDietaryRestrictions(userData.dietaryRestrictions || []),
      disallowedIngredients: [
        ...(userData.dislikedFoods || []),
        ...(userData.avoidedFoods || [])
      ],
      allergies: userData.allergies || [],
      conditions: mapHealthConditions(userData.healthConditions || []),
      lowGlycemicMode: (userData.healthConditions || []).some((c: string) => 
        c.toLowerCase().includes('diabetes') || c.toLowerCase().includes('glucose')
      ),
      bodyType: userData.bodyType as 'endomorph' | 'mesomorph' | 'ectomorph' | undefined,
      sugarSubPref: 'stevia', // Default for diabetes users, could be added to schema
    };

    return profile;
  } catch (error) {
    console.error('Error fetching onboarding profile:', error);
    return null;
  }
}

function mapDietaryRestrictions(restrictions: string[]): DietType[] {
  const dietMap: Record<string, DietType> = {
    'keto': 'keto',
    'ketogenic': 'keto',
    'low_carb': 'low_carb',
    'low-carb': 'low_carb',
    'mediterranean': 'mediterranean',
    'paleo': 'paleo',
    'vegan': 'vegan',
    'vegetarian': 'vegetarian',
    'pescatarian': 'pescatarian',
    'gluten_free': 'gluten_free',
    'gluten-free': 'gluten_free',
    'dairy_free': 'dairy_free',
    'dairy-free': 'dairy_free',
  };

  const mapped = restrictions
    .map(r => dietMap[r.toLowerCase()])
    .filter(Boolean) as DietType[];
  
  return mapped.length > 0 ? mapped : ['balanced'];
}

function mapHealthConditions(conditions: string[]): Condition[] {
  const conditionMap: Record<string, Condition> = {
    'type1_diabetes': 'type1_diabetes',
    'type 1 diabetes': 'type1_diabetes',
    'type1 diabetes': 'type1_diabetes',
    'type2_diabetes': 'type2_diabetes',
    'type 2 diabetes': 'type2_diabetes',
    'type2 diabetes': 'type2_diabetes',
    'diabetes': 'type2_diabetes', // Default to type 2
    'celiac': 'celiac',
    'celiac disease': 'celiac',
    'crohns': 'crohns',
    'crohn\'s': 'crohns',
    'hypertension': 'hypertension',
    'high blood pressure': 'hypertension',
    'pregnancy': 'pregnancy',
    'lactose_intolerance': 'lactose_intolerance',
    'lactose intolerance': 'lactose_intolerance',
    'shellfish_allergy': 'shellfish_allergy',
    'shellfish allergy': 'shellfish_allergy',
    'peanut_allergy': 'peanut_allergy',
    'peanut allergy': 'peanut_allergy',
    'nut_allergy': 'nut_allergy',
    'nut allergy': 'nut_allergy',
    'egg_allergy': 'egg_allergy',
    'egg allergy': 'egg_allergy',
    'soy_allergy': 'soy_allergy',
    'soy allergy': 'soy_allergy',
  };

  return conditions
    .map(c => conditionMap[c.toLowerCase()])
    .filter(Boolean) as Condition[];
}
