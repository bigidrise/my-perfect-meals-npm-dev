// Temporary stub for macroNormalize
// This module provides utility functions for normalizing macro data

interface MacroData {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

interface NormalizedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * Normalizes macro data by ensuring all values are numbers and providing defaults for missing values
 */
export function normalizeMacros(macros: Partial<MacroData>): NormalizedMacros {
  return {
    calories: Number(macros.calories) || 0,
    protein: Number(macros.protein) || 0,
    carbs: Number(macros.carbs) || 0,
    fat: Number(macros.fat) || 0,
    fiber: Number(macros.fiber) || 0,
  };
}

/**
 * Rounds macro values to specified decimal places
 */
export function roundMacros(macros: MacroData, decimals: number = 1): NormalizedMacros {
  const factor = Math.pow(10, decimals);
  return {
    calories: Math.round((macros.calories || 0) * factor) / factor,
    protein: Math.round((macros.protein || 0) * factor) / factor,
    carbs: Math.round((macros.carbs || 0) * factor) / factor,
    fat: Math.round((macros.fat || 0) * factor) / factor,
    fiber: Math.round((macros.fiber || 0) * factor) / factor,
  };
}

/**
 * Validates that macro values are within reasonable ranges
 */
export function validateMacros(macros: MacroData): boolean {
  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = macros;
  
  // Basic validation: all values should be non-negative and within reasonable limits
  const isValid = 
    calories >= 0 && calories <= 10000 &&
    protein >= 0 && protein <= 1000 &&
    carbs >= 0 && carbs <= 1000 &&
    fat >= 0 && fat <= 1000;
    
  return isValid;
}
