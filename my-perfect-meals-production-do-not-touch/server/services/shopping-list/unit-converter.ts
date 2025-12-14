// Helper function to categorize ingredients
function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('pork') || lowerName.includes('fish') || lowerName.includes('tofu') || lowerName.includes('tempeh')) {
    return 'protein';
  }
  if (lowerName.includes('broccoli') || lowerName.includes('spinach') || lowerName.includes('kale') || lowerName.includes('carrots') || lowerName.includes('onions') || lowerName.includes('garlic') || lowerName.includes('peppers') || lowerName.includes('tomato') || lowerName.includes('potato') || lowerName.includes('sweet potato') || lowerName.includes('avocado')) {
    return 'vegetable';
  }
  if (lowerName.includes('apple') || lowerName.includes('banana') || lowerName.includes('orange') || lowerName.includes('berries') || lowerName.includes('grapes')) {
    return 'fruit';
  }
  if (lowerName.includes('rice') || lowerName.includes('pasta') || lowerName.includes('bread') || lowerName.includes('oats') || lowerName.includes('quinoa')) {
    return 'grain';
  }
  if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('yogurt') || lowerName.includes('butter')) {
    return 'dairy';
  }
  if (lowerName.includes('egg')) {
    return 'egg';
  }
  if (lowerName.includes('oil') || lowerName.includes('vinegar') || lowerName.includes('salt') || lowerName.includes('pepper') || lowerName.includes('sugar') || lowerName.includes('flour')) {
    return 'pantry';
  }
  return 'other';
}

export function convertToPreferred(name: string, quantity: number, unit: string): { quantity: number; unit: string } {
  // Force lowercase units for consistency
  unit = unit.toLowerCase();

  const category = categorizeIngredient(name);

  // Optional: Convert tomato slices to cups
  if (name.toLowerCase().includes('tomato') && unit === 'slice') {
    quantity = quantity * 0.1; // ~0.1 cup per slice
    unit = 'cup';
  }

  switch (category) {
    case 'protein':
      // Convert common protein units to preferred units (e.g., ounces to pounds)
      if (unit === 'oz') {
        quantity = quantity / 16;
        unit = 'lb';
      } else if (unit === 'g') {
        quantity = quantity / 453.592;
        unit = 'lb';
      }
      break;
    case 'vegetable':
    case 'fruit':
      // Convert common fruit/vegetable units to preferred units (e.g., pieces to cups)
      if (unit === 'piece' || unit === 'unit') {
        // Approximation: 1 piece = 1 cup for many fruits/veg
        quantity = quantity;
        unit = 'cup';
      } else if (unit === 'oz') {
        quantity = quantity / 8; // Approximation: 1 cup = 8 oz
        unit = 'cup';
      } else if (unit === 'g') {
        quantity = quantity / 240; // Approximation: 1 cup = 240 g
        unit = 'cup';
      }
      break;
    case 'grain':
      // Convert common grain units to preferred units (e.g., grams to cups)
      if (unit === 'g') {
        quantity = quantity / 160; // Approximation: 1 cup = 160g
        unit = 'cup';
      } else if (unit === 'oz') {
        quantity = quantity / 8; // Approximation: 1 cup = 8 oz
        unit = 'cup';
      }
      break;
    case 'dairy':
      // Convert common dairy units to preferred units (e.g., grams to cups)
      if (unit === 'g') {
        quantity = quantity / 240; // Approximation: 1 cup = 240g
        unit = 'cup';
      } else if (unit === 'oz') {
        quantity = quantity / 8; // Approximation: 1 cup = 8 oz
        unit = 'cup';
      }
      break;
    case 'pantry':
      // Convert common pantry units to preferred units (e.g., grams to cups or ml)
      if (unit === 'g') {
        // Assume common pantry staples like flour, sugar
        if (name.toLowerCase().includes('flour') || name.toLowerCase().includes('sugar')) {
          quantity = quantity / 125; // Approximation: 1 cup = 125g for flour/sugar
          unit = 'cup';
        } else {
          quantity = quantity / 28.35; // Approximation: 1 oz = 28.35g for other pantry items
          unit = 'oz';
        }
      } else if (unit === 'ml') {
        quantity = quantity / 240; // Approximation: 1 cup = 240ml
        unit = 'cup';
      } else if (unit === 'tsp') {
        quantity = quantity / 3; // 3 tsp = 1 tbsp
        unit = 'tbsp';
      } else if (unit === 'tbsp') {
        quantity = quantity / 16; // 16 tbsp = 1 cup
        unit = 'cup';
      }
      break;
    default:
      // For 'other' category or unhandled units, keep as is or apply simple conversions
      if (unit === 'piece' || unit === 'unit') {
        unit = 'item'; // Standardize to 'item'
      }
      break;
  }

  // Further refinement for specific units if needed
  if (unit === 'clove' && name.toLowerCase().includes('garlic')) {
    quantity = quantity * 0.05; // Approx 0.05 cup per clove
    unit = 'cup';
  }

  // Return the converted quantity and unit
  return { quantity, unit };
}