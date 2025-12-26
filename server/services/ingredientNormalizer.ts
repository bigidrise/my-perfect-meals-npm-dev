// server/services/ingredientNormalizer.ts
// Normalizes AI-generated ingredients to the unified U.S. measurement contract
// Converts metric units, strips macros, validates format

import { Ingredient, LegacyIngredient, US_SOLID_UNITS } from '@shared/types';

const METRIC_TO_US: Record<string, { factor: number; unit: string }> = {
  'g': { factor: 0.035274, unit: 'oz' },
  'gram': { factor: 0.035274, unit: 'oz' },
  'grams': { factor: 0.035274, unit: 'oz' },
  'kg': { factor: 2.20462, unit: 'lb' },
  'kilogram': { factor: 2.20462, unit: 'lb' },
  'ml': { factor: 0.033814, unit: 'fl oz' },
  'milliliter': { factor: 0.033814, unit: 'fl oz' },
  'milliliters': { factor: 0.033814, unit: 'fl oz' },
  'l': { factor: 4.22675, unit: 'cup' },
  'liter': { factor: 4.22675, unit: 'cup' },
  'liters': { factor: 4.22675, unit: 'cup' },
};

const PROTEIN_INGREDIENTS = [
  'chicken', 'beef', 'steak', 'pork', 'fish', 'salmon', 'tuna', 'shrimp',
  'turkey', 'lamb', 'duck', 'bacon', 'sausage', 'ham', 'tilapia', 'cod',
  'halibut', 'ribeye', 'sirloin', 'filet', 'tenderloin', 'brisket',
  'thigh', 'breast', 'drumstick', 'wing', 'ground beef', 'ground turkey'
];

const DAIRY_INGREDIENTS = [
  'yogurt', 'milk', 'cheese', 'cream', 'butter', 'sour cream', 'cottage cheese'
];

function isProtein(name: string): boolean {
  const lower = name.toLowerCase();
  return PROTEIN_INGREDIENTS.some(p => lower.includes(p));
}

function isDairy(name: string): boolean {
  const lower = name.toLowerCase();
  return DAIRY_INGREDIENTS.some(d => lower.includes(d));
}

function parseAmount(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 2) {
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
    }
    return parseFloat(value) || 0;
  }
  return 0;
}

function formatAmount(num: number): string {
  if (num === 0) return '0';
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.33: '1/3',
    0.5: '1/2',
    0.67: '2/3',
    0.75: '3/4',
  };
  const whole = Math.floor(num);
  const decimal = num - whole;
  const roundedDecimal = Math.round(decimal * 100) / 100;
  
  for (const [key, frac] of Object.entries(fractions)) {
    if (Math.abs(roundedDecimal - parseFloat(key)) < 0.05) {
      return whole > 0 ? `${whole} ${frac}` : frac;
    }
  }
  
  if (decimal === 0) return whole.toString();
  return num.toFixed(1).replace(/\.0$/, '');
}

function convertUnit(amount: number, unit: string, ingredientName: string): { amount: string; unit: string } {
  const lowerUnit = unit.toLowerCase().trim();
  
  if (METRIC_TO_US[lowerUnit]) {
    const conversion = METRIC_TO_US[lowerUnit];
    let convertedAmount = amount * conversion.factor;
    let targetUnit = conversion.unit;
    
    if (isProtein(ingredientName)) {
      targetUnit = 'oz';
      if (lowerUnit === 'g' || lowerUnit === 'gram' || lowerUnit === 'grams') {
        convertedAmount = amount * 0.035274;
      }
      if (convertedAmount >= 16) {
        convertedAmount = convertedAmount / 16;
        targetUnit = 'lb';
      }
    } else if (isDairy(ingredientName) && convertedAmount > 8) {
      convertedAmount = convertedAmount / 8;
      targetUnit = 'cup';
    }
    
    return { amount: formatAmount(convertedAmount), unit: targetUnit };
  }
  
  if (lowerUnit === 'piece' || lowerUnit === 'pieces') {
    if (isProtein(ingredientName)) {
      return { amount: formatAmount(amount * 6), unit: 'oz' };
    }
    return { amount: formatAmount(amount), unit: 'each' };
  }
  
  const validUnits = ['oz', 'lb', 'cup', 'cups', 'tbsp', 'tsp', 'each', 'fl oz'];
  if (validUnits.includes(lowerUnit) || lowerUnit === 'tablespoon' || lowerUnit === 'teaspoon') {
    let normalizedUnit = lowerUnit;
    if (lowerUnit === 'cups') normalizedUnit = 'cup';
    if (lowerUnit === 'tablespoon' || lowerUnit === 'tablespoons') normalizedUnit = 'tbsp';
    if (lowerUnit === 'teaspoon' || lowerUnit === 'teaspoons') normalizedUnit = 'tsp';
    return { amount: formatAmount(amount), unit: normalizedUnit };
  }
  
  return { amount: formatAmount(amount), unit: lowerUnit };
}

export function normalizeIngredient(raw: any): Ingredient {
  const name = String(raw.name || raw.item || '').trim();
  const rawAmount = raw.amount ?? raw.quantity ?? 1;
  const rawUnit = String(raw.unit || 'each').trim();
  const prep = raw.preparationNote || raw.notes || undefined;
  
  const numericAmount = parseAmount(rawAmount);
  const converted = convertUnit(numericAmount, rawUnit, name);
  
  const result: Ingredient = {
    name,
    amount: converted.amount,
    unit: converted.unit,
  };
  
  if (prep && typeof prep === 'string' && prep.trim()) {
    result.preparationNote = prep.trim();
  }
  
  return result;
}

export function normalizeIngredients(rawIngredients: any[]): Ingredient[] {
  if (!Array.isArray(rawIngredients)) return [];
  return rawIngredients.map(normalizeIngredient).filter(i => i.name);
}

export function formatIngredientForDisplay(ingredient: Ingredient): string {
  const parts = [ingredient.amount, ingredient.unit, ingredient.name];
  if (ingredient.preparationNote) {
    parts.push(`(${ingredient.preparationNote})`);
  }
  return parts.join(' ');
}

export function ingredientsToStringArray(ingredients: Ingredient[]): string[] {
  return ingredients.map(formatIngredientForDisplay);
}
