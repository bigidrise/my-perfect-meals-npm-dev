// server/services/mealValidation.ts
// Guardrails to ensure no blank amounts or missing instructions

import { hydrateMeal, MealLike } from './mealInstructionResolver';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validates and auto-fixes meal data before saving or displaying
export function validateAndFixMeal(meal: MealLike): { meal: MealLike; validation: ValidationResult } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Auto-hydrate if needed
  let processedMeal = meal;
  
  // Check for missing amounts
  const missingAmounts = meal.ingredients.filter(ing => !ing.amount || ing.amount.trim() === '');
  if (missingAmounts.length > 0) {
    warnings.push(`Auto-filled ${missingAmounts.length} missing ingredient amounts`);
    processedMeal = hydrateMeal(meal);
  }
  
  // Check for missing instructions
  if (!processedMeal.instructions || processedMeal.instructions.length === 0) {
    warnings.push('Auto-generated cooking instructions from meal pattern');
    processedMeal = hydrateMeal(processedMeal);
  }
  
  // Final validation checks
  const stillMissingAmounts = processedMeal.ingredients.filter(ing => !ing.amount || ing.amount.trim() === '');
  if (stillMissingAmounts.length > 0) {
    errors.push(`Unable to determine amounts for: ${stillMissingAmounts.map(i => i.name).join(', ')}`);
  }
  
  if (!processedMeal.instructions || processedMeal.instructions.length === 0) {
    errors.push('No cooking instructions available');
  }
  
  // Check for raw animal proteins without safe temperatures
  const rawProteins = processedMeal.ingredients.filter(ing => {
    const name = ing.name.toLowerCase();
    return ['chicken', 'turkey', 'beef', 'pork', 'salmon', 'fish'].some(protein => name.includes(protein));
  });
  
  if (rawProteins.length > 0) {
    const hasTemperature = processedMeal.instructions?.some(step => 
      step.includes('°F') || step.includes('165°') || step.includes('145°') || step.includes('160°')
    );
    
    if (!hasTemperature) {
      warnings.push('Consider adding safe cooking temperatures for meat/fish');
    }
  }
  
  // Check servings range
  if (!processedMeal.servings || processedMeal.servings < 1 || processedMeal.servings > 8) {
    processedMeal.servings = 2;
    warnings.push('Adjusted servings to safe range (1-8)');
  }
  
  return {
    meal: processedMeal,
    validation: {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  };
}

// Unit test helper - validates specific templates work correctly
export function testTemplate(templateName: string, servings: number = 2): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Test data for common templates
  const testMeals: Record<string, MealLike> = {
    'sheet_pan_chicken': {
      title: 'Sheet-Pan Chicken & Broccoli',
      servings,
      ingredients: [
        { name: 'chicken breast' },
        { name: 'broccoli' },
        { name: 'olive oil' }
      ],
      tags: ['sheet-pan']
    },
    'stir_fry': {
      title: 'Chicken Stir Fry',
      servings,
      ingredients: [
        { name: 'chicken' },
        { name: 'bell peppers' },
        { name: 'rice' },
        { name: 'soy sauce' }
      ],
      tags: ['stir-fry']
    },
    'omelet': {
      title: 'Veggie Omelet',
      servings,
      ingredients: [
        { name: 'eggs' },
        { name: 'spinach' },
        { name: 'cheese' },
        { name: 'butter' }
      ],
      tags: ['omelet']
    }
  };
  
  const testMeal = testMeals[templateName];
  if (!testMeal) {
    errors.push(`Unknown template: ${templateName}`);
    return { isValid: false, errors, warnings };
  }
  
  const { meal: processed, validation } = validateAndFixMeal(testMeal);
  
  // Template-specific checks
  const blankAmounts = processed.ingredients.filter(ing => !ing.amount || ing.amount.trim() === '');
  if (blankAmounts.length > 0) {
    errors.push(`Template ${templateName} has blank amounts: ${blankAmounts.map(i => i.name).join(', ')}`);
  }
  
  if (!processed.instructions || processed.instructions.length === 0) {
    errors.push(`Template ${templateName} has no instructions`);
  }
  
  // Check for safe temperatures with raw proteins
  if (templateName.includes('chicken') || templateName.includes('beef')) {
    const hasSafeTemp = processed.instructions?.some(step => step.includes('165°F') || step.includes('145°F'));
    if (!hasSafeTemp) {
      errors.push(`Template ${templateName} missing safe cooking temperature`);
    }
  }
  
  return {
    isValid: errors.length === 0 && validation.isValid,
    errors: [...errors, ...validation.errors],
    warnings: [...warnings, ...validation.warnings]
  };
}