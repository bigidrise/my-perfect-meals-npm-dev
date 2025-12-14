// Unit conversion utility for converting AI-generated measurements to user-friendly cooking units

interface UnitConversion {
  grams?: number;
  ml?: number;
  cups?: number;
  tbsp?: number;
  tsp?: number;
  to: string;
}

const unitConversions: Record<string, UnitConversion> = {
  // Grains & Starches
  "quinoa": { grams: 150, to: "1/2 cup" },
  "cooked quinoa": { grams: 150, to: "1/2 cup" },
  "rice": { grams: 100, to: "1/2 cup" },
  "brown rice": { grams: 100, to: "1/2 cup" },
  "oats": { grams: 80, to: "1/2 cup" },
  "pasta": { grams: 100, to: "1 cup" },
  "couscous": { grams: 80, to: "1/2 cup" },
  
  // Proteins
  "cooked chicken breast": { grams: 150, to: "1/2 cup diced" },
  "chicken breast": { grams: 150, to: "5 oz breast" },
  "grilled chicken breast": { grams: 150, to: "5 oz breast" },
  "ground turkey": { grams: 100, to: "1/3 cup" },
  "salmon": { grams: 150, to: "5 oz fillet" },
  "salmon fillet": { grams: 150, to: "5 oz fillet" },
  "tuna": { grams: 120, to: "1/3 cup" },
  "canned tuna": { grams: 120, to: "1/3 cup" },
  "canned tuna (drained)": { grams: 120, to: "1/3 cup" },
  "eggs": { grams: 50, to: "1 large egg" },
  "tofu": { grams: 100, to: "1/2 cup cubed" },
  "black beans": { grams: 100, to: "1/2 cup" },
  "chickpeas": { grams: 100, to: "1/2 cup" },
  
  // Vegetables
  "baby spinach": { grams: 50, to: "1 cup (loose)" },
  "spinach": { grams: 50, to: "1 cup (loose)" },
  "cherry tomatoes": { grams: 100, to: "1/2 cup" },
  "tomatoes": { grams: 100, to: "1/2 cup diced" },
  "bell pepper": { grams: 100, to: "1 medium pepper" },
  "onion": { grams: 100, to: "1/2 medium onion" },
  "garlic": { grams: 5, to: "1 clove" },
  "carrots": { grams: 100, to: "1 medium carrot" },
  "broccoli": { grams: 100, to: "1 cup florets" },
  "mushrooms": { grams: 100, to: "1 cup sliced" },
  "cucumber": { grams: 100, to: "1/2 medium cucumber" },
  
  // Fruits
  "banana": { grams: 120, to: "1 medium banana" },
  "apple": { grams: 150, to: "1 medium apple" },
  "strawberries": { grams: 100, to: "2/3 cup" },
  "blueberries": { grams: 100, to: "2/3 cup" },
  "avocado": { grams: 150, to: "1 medium avocado" },
  
  // Nuts & Seeds
  "almonds": { grams: 20, to: "2 tbsp" },
  "walnuts": { grams: 20, to: "2 tbsp" },
  "cashews": { grams: 20, to: "2 tbsp" },
  "sunflower seeds": { grams: 15, to: "1 tbsp" },
  "chia seeds": { grams: 10, to: "1 tbsp" },
  "flaxseeds": { grams: 10, to: "1 tbsp" },
  
  // Dairy
  "greek yogurt": { grams: 100, to: "1/2 cup" },
  "cottage cheese": { grams: 100, to: "1/2 cup" },
  "cheese": { grams: 30, to: "1 oz" },
  "cheddar cheese": { grams: 30, to: "1 oz" },
  "feta cheese": { grams: 30, to: "2 tbsp crumbled" },
  "parmesan cheese": { grams: 25, to: "2 tbsp grated" },
  "parmesan": { grams: 25, to: "2 tbsp grated" },
  
  // Pantry Items
  "dark chocolate chips": { grams: 30, to: "2 tbsp" },
  "chocolate chips": { grams: 30, to: "2 tbsp" },
  "coconut flakes": { grams: 15, to: "2 tbsp" },
  
  // Liquids
  "water": { ml: 250, to: "1 cup" },
  "milk": { ml: 250, to: "1 cup" },
  "broth": { ml: 250, to: "1 cup" },
  "vegetable broth": { ml: 250, to: "1 cup" },
  "chicken broth": { ml: 250, to: "1 cup" },
  "coconut milk": { ml: 250, to: "1 cup" },
  
  // Oils & Condiments
  "olive oil": { tbsp: 1, to: "1 tbsp" },
  "coconut oil": { tbsp: 1, to: "1 tbsp" },
  "sesame oil": { tsp: 1, to: "1 tsp" },
  "balsamic vinegar": { tbsp: 1, to: "1 tbsp" },
  "apple cider vinegar": { tbsp: 1, to: "1 tbsp" },
  "lemon juice": { tbsp: 1, to: "1 tbsp" },
  "lime juice": { tbsp: 1, to: "1 tbsp" },
  "soy sauce": { tbsp: 1, to: "1 tbsp" },
  
  // Spices & Seasonings
  "honey": { tsp: 1, to: "1 tsp" },
  "maple syrup": { tbsp: 1, to: "1 tbsp" },
  "salt": { tsp: 1, to: "1 tsp" },
  "black pepper": { tsp: 1, to: "1 tsp" },
  "garlic powder": { tsp: 1, to: "1 tsp" },
  "onion powder": { tsp: 1, to: "1 tsp" },
  "paprika": { tsp: 1, to: "1 tsp" },
  "cumin": { tsp: 1, to: "1 tsp" },
  "oregano": { tsp: 1, to: "1 tsp" },
  "basil": { tsp: 1, to: "1 tsp" },
  "thyme": { tsp: 1, to: "1 tsp" },
  "rosemary": { tsp: 1, to: "1 tsp" },
  "cinnamon": { tsp: 1, to: "1 tsp" },
  "vanilla extract": { tsp: 1, to: "1 tsp" },
};

/**
 * Convert metric measurements to user-friendly cooking units (for arrays of ingredient objects)
 */
export function convertToUserFriendlyUnits(ingredients: Array<{name: string, amount: number, unit: string, notes: string}>): Array<{name: string, amount: number, unit: string, notes: string}>;
export function convertToUserFriendlyUnits(ingredientText: string): string;
export function convertToUserFriendlyUnits(input: any): any {
  // Handle array of ingredient objects
  if (Array.isArray(input)) {
    return input.map(ingredient => {
      if (ingredient.unit === 'g' || ingredient.unit === 'grams') {
        const convertedText = convertMetricToUnits(`${ingredient.amount}g ${ingredient.name}`);
        // Parse the converted text back to structured format
        const match = convertedText.match(/^([\d\/\.\s]+)\s*([a-zA-Z]+)\s+(.+)$/);
        if (match) {
          const [, amountStr, unit, name] = match;
          const amount = amountStr.includes('/') ? 
            amountStr.split('/').reduce((a, b) => parseFloat(a.trim()) / parseFloat(b.trim())) : 
            parseFloat(amountStr.trim());
          return {
            name: name.trim(),
            amount: Math.round(amount * 1000) / 1000, // Round to avoid precision issues
            unit: unit.toLowerCase(),
            notes: ingredient.notes || ''
          };
        }
      }
      // Return original if no conversion needed
      return ingredient;
    });
  }
  
  // Handle single string (existing functionality)
  return convertMetricToUnits(input);
}

/**
 * Convert metric measurements to user-friendly cooking units (internal function)
 */
function convertMetricToUnits(ingredientText: string): string {
  // Clean up the ingredient text
  let cleanText = ingredientText.trim();
  
  // Extract quantity and unit using regex
  const metricPattern = /^(\d+(?:\.\d+)?)\s*(g|ml|grams?|milliliters?)\s+(.+)$/i;
  const match = cleanText.match(metricPattern);
  
  if (!match) {
    return ingredientText; // Return original if no metric pattern found
  }
  
  const [, quantityStr, unit, ingredient] = match;
  const quantity = parseFloat(quantityStr);
  const normalizedUnit = unit.toLowerCase().replace(/s$/, ''); // Remove plural 's'
  const normalizedIngredient = ingredient.toLowerCase().trim();
  
  // Look for exact match first
  if (unitConversions[normalizedIngredient]) {
    const conversion = unitConversions[normalizedIngredient];
    
    // Check if the quantity matches the conversion base
    if ((normalizedUnit === 'g' || normalizedUnit === 'gram') && conversion.grams) {
      const ratio = quantity / conversion.grams;
      if (ratio <= 1.2 && ratio >= 0.8) { // Within 20% tolerance
        return conversion.to;
      }
    } else if ((normalizedUnit === 'ml' || normalizedUnit === 'milliliter') && conversion.ml) {
      const ratio = quantity / conversion.ml;
      if (ratio <= 1.2 && ratio >= 0.8) { // Within 20% tolerance
        return conversion.to;
      }
    }
  }
  
  // Look for partial matches (ingredient contains key ingredient)
  for (const [key, conversion] of Object.entries(unitConversions)) {
    if (normalizedIngredient.includes(key) || key.includes(normalizedIngredient)) {
      if ((normalizedUnit === 'g' || normalizedUnit === 'gram') && conversion.grams) {
        const ratio = quantity / conversion.grams;
        if (ratio <= 1.2 && ratio >= 0.8) { // Within 20% tolerance
          return conversion.to;
        }
      } else if ((normalizedUnit === 'ml' || normalizedUnit === 'milliliter') && conversion.ml) {
        const ratio = quantity / conversion.ml;
        if (ratio <= 1.2 && ratio >= 0.8) { // Within 20% tolerance
          return conversion.to;
        }
      }
    }
  }
  
  // Fallback: round the metric measurements for readability
  if (normalizedUnit === 'g' || normalizedUnit === 'gram') {
    const roundedQuantity = Math.round(quantity / 5) * 5; // Round to nearest 5g
    return `${roundedQuantity}g ${ingredient}`;
  } else if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter') {
    const roundedQuantity = Math.round(quantity / 25) * 25; // Round to nearest 25ml
    return `${roundedQuantity}ml ${ingredient}`;
  }
  
  return ingredientText; // Return original if no conversion possible
}

/**
 * Process an entire ingredients list and convert measurements
 */
export function convertIngredientsToUserFriendly(ingredients: string[]): string[] {
  return ingredients.map(ingredient => convertToUserFriendlyUnits(ingredient));
}

/**
 * Convert structured ingredients from AI response to user-friendly format
 */
export function convertStructuredIngredients(ingredients: any[]): any[] {
  return ingredients.map(ingredient => {
    if (!ingredient.name || !ingredient.amount || !ingredient.unit) {
      return ingredient; // Return as-is if missing data
    }
    
    const normalizedName = ingredient.name.toLowerCase().trim();
    const amount = parseFloat(ingredient.amount);
    const unit = ingredient.unit.toLowerCase();
    
    // Look for exact match first
    if (unitConversions[normalizedName]) {
      const conversion = unitConversions[normalizedName];
      
      // Check if the quantity matches the conversion base
      if ((unit === 'g' || unit === 'grams') && conversion.grams) {
        const ratio = amount / conversion.grams;
        if (ratio <= 1.5 && ratio >= 0.5) { // Within reasonable tolerance
          return {
            ...ingredient,
            amount: conversion.to.split(' ')[0] === '1' ? 1 : parseFloat(conversion.to.split(' ')[0]) || 1,
            unit: conversion.to.replace(/^\d+(\.\d+)?\s*/, '') || conversion.to,
            displayText: conversion.to
          };
        }
      } else if ((unit === 'ml' || unit === 'milliliters') && conversion.ml) {
        const ratio = amount / conversion.ml;
        if (ratio <= 1.5 && ratio >= 0.5) { // Within reasonable tolerance
          return {
            ...ingredient,
            amount: conversion.to.split(' ')[0] === '1' ? 1 : parseFloat(conversion.to.split(' ')[0]) || 1,
            unit: conversion.to.replace(/^\d+(\.\d+)?\s*/, '') || conversion.to,
            displayText: conversion.to
          };
        }
      }
    }
    
    // Look for partial matches (ingredient contains key ingredient)
    for (const [key, conversion] of Object.entries(unitConversions)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        if ((unit === 'g' || unit === 'grams') && conversion.grams) {
          const ratio = amount / conversion.grams;
          if (ratio <= 1.5 && ratio >= 0.5) { // Within reasonable tolerance
            return {
              ...ingredient,
              amount: conversion.to.split(' ')[0] === '1' ? 1 : parseFloat(conversion.to.split(' ')[0]) || 1,
              unit: conversion.to.replace(/^\d+(\.\d+)?\s*/, '') || conversion.to,
              displayText: conversion.to
            };
          }
        } else if ((unit === 'ml' || unit === 'milliliters') && conversion.ml) {
          const ratio = amount / conversion.ml;
          if (ratio <= 1.5 && ratio >= 0.5) { // Within reasonable tolerance
            return {
              ...ingredient,
              amount: conversion.to.split(' ')[0] === '1' ? 1 : parseFloat(conversion.to.split(' ')[0]) || 1,
              unit: conversion.to.replace(/^\d+(\.\d+)?\s*/, '') || conversion.to,
              displayText: conversion.to
            };
          }
        }
      }
    }
    
    // Fallback: round metric measurements for readability
    if (unit === 'g' || unit === 'grams') {
      const roundedAmount = Math.round(amount / 5) * 5; // Round to nearest 5g
      return {
        ...ingredient,
        amount: roundedAmount,
        unit: 'g'
      };
    } else if (unit === 'ml' || unit === 'milliliters') {
      const roundedAmount = Math.round(amount / 25) * 25; // Round to nearest 25ml
      return {
        ...ingredient,
        amount: roundedAmount,
        unit: 'ml'
      };
    }
    
    return ingredient; // Return original if no conversion possible
  });
}