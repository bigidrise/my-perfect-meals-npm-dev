/**
 * Recipe Preparation Validator
 *
 * Checks that ingredient forms and cooking instructions agree.
 * Read-only: does not modify recipes, macros, or clinical guardrails.
 */

export interface PreparationIngredient {
  name: string;
  amount?: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

export interface PreparationRecipe {
  ingredients: PreparationIngredient[];
  instructions?: string[];
}

export interface PreparationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRecipePreparation(
  recipe: PreparationRecipe
): PreparationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const instructions = (recipe.instructions ?? []).join(" ").toLowerCase();

  for (const ingredient of recipe.ingredients ?? []) {
    const description = [
      ingredient.name,
      ingredient.amount,
      ingredient.quantity,
      ingredient.unit,
      ingredient.notes
    ].filter(Boolean).join(" ").toLowerCase();

    const isLentil = /\b(lentils?|lentejas?)\b/.test(description);
    const isDry = /\b(dry|dried|uncooked|seco|seca|secos|secas|crudo|cruda|crudos|crudas)\b/.test(description);
    const isReady = /\b(canned|cooked|pre-cooked|precooked|enlatado|enlatada|enlatados|enlatadas|cocido|cocida|cocidos|cocidas)\b/.test(description);

    if (isLentil && isDry && !isReady) {
      const mentionsLentils = /\b(lentils?|lentejas?)\b/.test(instructions);
      const mentionsCooking = /\b(simmer|simmered|boil|boiled|cook|cooked|pressure.cook|cocinar|cocina|cocine|cocinen|hervir|hierve|hierva|cuece|cocer)\b/.test(instructions);
      const mentionsLiquid = /\b(water|broth|stock|liquid|agua|caldo|líquido|liquido)\b/.test(instructions);
      const mentionsTime = /\b\d+\s*(?:-\s*\d+\s*)?(?:minutes?|mins?|hours?|hrs?|minutos?|horas?)\b/.test(instructions);

      if (!mentionsLentils || !mentionsCooking || !mentionsLiquid || !mentionsTime) {
        errors.push(
          `Dried lentils require cooking method, liquid, and cooking time: ${ingredient.name}`
        );
      }
    }

    if (isLentil && !isDry && !isReady) {
      warnings.push(
        `Specify whether lentils are dried, canned, or precooked: ${ingredient.name}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
