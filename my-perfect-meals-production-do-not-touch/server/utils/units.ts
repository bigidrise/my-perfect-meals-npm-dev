// server/utils/units.ts
// Unit normalization utilities

interface Ingredient {
  name: string;
  amount: string;
  unit?: string;
}

export function normalizeUnits(ingredient: Ingredient): Ingredient {
  // Simple unit normalization - can be expanded
  let { amount, unit } = ingredient;
  
  // Convert common abbreviations
  const unitMappings: Record<string, string> = {
    'tsp': 'teaspoon',
    'tbsp': 'tablespoon',
    'oz': 'ounce',
    'lb': 'pound',
    'lbs': 'pounds'
  };
  
  if (unit && unitMappings[unit.toLowerCase()]) {
    unit = unitMappings[unit.toLowerCase()];
  }
  
  return {
    ...ingredient,
    amount,
    unit
  };
}