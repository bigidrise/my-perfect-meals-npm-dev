import { PORTION_DEFAULTS } from '../data/portion_guides';
import { detectPattern, SAFE_TEMP } from '../data/cook_patterns';
import { CANONICAL_TAGS } from '../data/fridge_mappings'; // reuse mapping from Fridge Rescue v2
import { findBestBlueprint, INGREDIENT_PROPERTIES, Blueprint } from '../data/instruction_blueprints';

export interface MealItem { name: string; amount?: string; category?: string }
export interface MealLike {
  id?: string;
  title: string;
  servings?: number;
  ingredients: MealItem[];
  instructions?: string[];
  tags?: string[];
}

const round = (n: number) => Math.round(n * 10) / 10;

function toTag(name: string): string | undefined {
  const key = name.toLowerCase().trim();
  const maps = CANONICAL_TAGS[key];
  if (!maps) return undefined;
  // prefer protein tag when ambiguous
  const protein = maps.find(m => (m as any).bucket === 'proteins');
  return (protein?.tag || maps[0].tag) as string;
}

function ensureAmount(item: MealItem, servings: number): MealItem {
  if (item.amount && item.amount.trim().length > 0) return item;
  const tag = toTag(item.name) || item.name.toLowerCase();

  // protein
  const p = (PORTION_DEFAULTS.protein as any)[tag];
  if (p) return { ...item, amount: `${round(p.amount * servings)} ${p.unit}` };

  // carb
  const c = (PORTION_DEFAULTS.carb as any)[tag];
  if (c) return { ...item, amount: `${round(c.amount * servings)} ${c.unit}` };

  // veg
  return { ...item, amount: `${round(PORTION_DEFAULTS.veg.generic.amount * servings)} ${PORTION_DEFAULTS.veg.generic.unit}` };
}

function buildSteps(pattern: string, proteinNames: string[], vegNames: string[], carbName?: string, fatName?: string, condimentName?: string): string[] {
  const proteinTag = toTag(proteinNames[0] || '') || '';
  const proteinSafe = (SAFE_TEMP as any)[proteinTag];

  switch (pattern) {
    case 'stir_fry':
      return [
        `Heat a large skillet over medium‑high. Add ${fatName || '1 tbsp oil'}.`,
        `Season ${proteinNames.join(' & ')} with salt/pepper. Sear 3–4 min/side until browned${proteinSafe ? ` (cook to ${proteinSafe}°F)` : ''}.`,
        `Add ${vegNames.join(', ')} and stir‑fry 4–5 min until crisp‑tender.`,
        condimentName ? `Toss with ${condimentName} for 30–60 sec.` : 'Adjust salt to taste.',
        carbName ? `Serve over cooked ${carbName}.` : 'Serve immediately.',
      ];
    case 'sheet_pan':
      return [
        'Heat oven to 425°F (220°C). Line a sheet pan.',
        `Toss ${proteinNames.join(' & ')} and ${vegNames.join(', ')} with ${fatName || '1–2 tbsp oil'}, salt, and pepper.`,
        `Roast 18–25 min until protein is done${proteinSafe ? ` (${proteinSafe}°F)` : ''} and veg is tender.`,
        carbName ? `Serve with ${carbName}.` : 'Serve hot.',
      ];
    case 'omelet':
      return [
        `Beat eggs with a pinch of salt/pepper.`,
        `Sauté ${vegNames.join(', ')} in ${fatName || '1 tsp oil'} 1–2 min.`,
        'Pour in eggs; when almost set, fold and finish. Serve hot.',
      ];
    case 'quesadilla':
      return [
        `Warm a skillet over medium.`,
        `Layer tortilla with ${proteinNames.join('/')} and ${vegNames[0] || 'veg'}; fold.`,
        'Cook 2–3 min/side until crisp and melty. Slice.',
      ];
    case 'bowl':
      return [
        `Brown ${proteinNames.join(' & ')} in a skillet; season with salt/pepper.`,
        `Assemble bowls with ${vegNames.join(', ')}${carbName ? ` and ${carbName}` : ''}.`,
        condimentName ? `Top with ${condimentName}.` : 'Serve immediately.',
      ];
    default:
      return [
        `Cook ${proteinNames.join(' & ')} until done${proteinSafe ? ` (${proteinSafe}°F)` : ''}.`,
        `Cook ${vegNames.join(', ')} to desired tenderness.`,
        carbName ? `Serve with ${carbName}.` : 'Serve hot.',
      ];
  }
}

// Blueprint rendering - converts parameterized steps to actual instructions
function renderBlueprint(meal: MealLike, blueprint: Blueprint, servings: number): string[] {
  const normalized = meal.ingredients.map(i => ensureAmount(i, servings));
  
  // Build ingredient map for token replacement
  const ingredientMap: Record<string, any> = {};
  
  // Categorize ingredients
  const proteins = normalized.filter(i => {
    const tag = toTag(i.name); 
    return tag && ['chicken','turkey','beef','salmon','tuna','shrimp','eggs','tofu'].includes(tag);
  });
  const carbs = normalized.filter(i => {
    const tag = toTag(i.name); 
    return tag && ['rice','quinoa','pasta','potato','tortilla','bread'].includes(tag);
  });
  const vegs = normalized.filter(i => {
    const tag = toTag(i.name) || ''; 
    return ['broccoli','spinach','kale','bell_pepper','tomato','zucchini','carrot','lettuce','cucumber','onion','garlic'].includes(tag) || i.category === 'veg';
  });
  const fats = normalized.filter(i => {
    const tag = toTag(i.name) || ''; 
    return ['olive_oil','avocado_oil','butter','avocado','cheese'].includes(tag) || i.category === 'fat';
  });
  const condiments = normalized.filter(i => {
    const tag = toTag(i.name) || ''; 
    return ['soy_sauce','salsa','tomato_sauce','pesto','cheese'].includes(tag) || i.category === 'condiment';
  });

  // Map ingredients to slots with debug logging
  if (proteins[0]) {
    const proteinKey = toTag(proteins[0].name) || proteins[0].name.toLowerCase().replace(/\s+/g, '_');
    ingredientMap.protein = {
      name: proteins[0].name,
      amount: proteins[0].amount,
      ...INGREDIENT_PROPERTIES[proteinKey]
    };
  }
  
  if (vegs[0]) {
    const vegKey = toTag(vegs[0].name) || vegs[0].name.toLowerCase().replace(/\s+/g, '_');
    ingredientMap.veg = {
      name: vegs[0].name,
      amount: vegs[0].amount,
      ...INGREDIENT_PROPERTIES[vegKey]
    };
  }
  
  if (carbs[0]) {
    ingredientMap.carb = {
      name: carbs[0].name,
      amount: carbs[0].amount
    };
    // Map grain as alias for carb in grain bowl recipes
    ingredientMap.grain = ingredientMap.carb;
  }
  
  if (fats[0]) {
    const fatKey = toTag(fats[0].name) || fats[0].name.toLowerCase().replace(/\s+/g, '_');
    ingredientMap.fat = {
      name: fats[0].name,
      amount: fats[0].amount,
      ...INGREDIENT_PROPERTIES[fatKey]
    };
  }
  
  if (condiments[0]) {
    ingredientMap.condiment = {
      name: condiments[0].name,
      amount: condiments[0].amount
    };
    // Map sauce as alias for condiment
    ingredientMap.sauce = ingredientMap.condiment;
  }

  // Render steps with comprehensive token replacement
  return blueprint.steps.map(step => {
    let rendered = step;
    
    // Handle conditional tokens first ${condiment?.name|Season with salt}
    rendered = rendered.replace(/\$\{([^?}]+)\?\.[^|]*\|([^}]+)\}/g, (match, ingredient, defaultText) => {
      const ing = ingredientMap[ingredient];
      return ing ? `${ing.amount || ''} ${ing.name}`.trim() : defaultText;
    });
    
    // Replace all ${ingredient.property} tokens systematically
    Object.keys(ingredientMap).forEach(ingredient => {
      const ing = ingredientMap[ingredient];
      if (ing) {
        // Replace amount tokens
        rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.amount\\}`, 'g'), ing.amount || '');
        // Replace name tokens  
        rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.name\\}`, 'g'), ing.name || '');
        // Replace temperature tokens
        if (ing.safe_temp_f) {
          rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.safe_temp_f\\}`, 'g'), ing.safe_temp_f.toString());
        }
        // Replace cooking time tokens
        if (ing.cook_time_min) {
          rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.cook_time_min\\}`, 'g'), ing.cook_time_min.toString());
        }
        if (ing.cook_time_max) {
          rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.cook_time_max\\}`, 'g'), ing.cook_time_max.toString());
        }
        // Replace sear time tokens
        if (ing.sear_time_min) {
          rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.sear_time_min\\}`, 'g'), ing.sear_time_min.toString());
        }
        if (ing.sear_time_max) {
          rendered = rendered.replace(new RegExp(`\\$\\{${ingredient}\\.sear_time_max\\}`, 'g'), ing.sear_time_max.toString());
        }
      }
    });
    
    // Clean up any remaining unreplaced tokens by removing them
    rendered = rendered.replace(/\$\{[^}]+\}/g, '');
    
    return rendered.trim();
  });
}

export function hydrateMeal(meal: MealLike): MealLike {
  const servings = Math.min(8, Math.max(1, meal.servings || 2));
  const normalized = meal.ingredients.map(i => ensureAmount(i, servings));

  // Try blueprint system first (new deterministic approach)
  const blueprint = findBestBlueprint(meal);
  if (blueprint) {
    const blueprintSteps = renderBlueprint(meal, blueprint, servings);
    return {
      ...meal,
      servings,
      ingredients: normalized,
      instructions: meal.instructions?.length ? meal.instructions : blueprintSteps,
      tags: meal.tags || [],
    };
  }

  // Fallback to pattern-based system (existing logic)
  const names = normalized.map(i => i.name.toLowerCase());
  const tags = (meal.tags || []).map(t => t.toLowerCase());

  // crude bucket by tag
  const proteins = normalized.filter(i => {
    const tag = toTag(i.name); return tag && ['chicken','turkey','beef','salmon','tuna','shrimp','eggs','tofu'].includes(tag);
  });
  const carbs = normalized.filter(i => {
    const tag = toTag(i.name); return tag && ['rice','quinoa','pasta','potato','tortilla','bread'].includes(tag);
  });
  const vegs = normalized.filter(i => {
    const tag = toTag(i.name) || ''; return ['broccoli','spinach','kale','bell_pepper','tomato','zucchini','carrot','lettuce','cucumber','onion','garlic'].includes(tag) || i.category === 'veg';
  });
  const fats = normalized.filter(i => {
    const tag = toTag(i.name) || ''; return ['olive_oil','avocado_oil','butter','avocado','cheese'].includes(tag) || i.category === 'fat';
  });
  const condiments = normalized.filter(i => {
    const tag = toTag(i.name) || ''; return ['soy_sauce','salsa','tomato_sauce','pesto','cheese'].includes(tag) || i.category === 'condiment';
  });

  const pattern = detectPattern(tags, names);
  const steps = buildSteps(
    pattern,
    proteins.map(p => p.name),
    (vegs.length ? vegs : normalized.filter(i => !proteins.includes(i) && !carbs.includes(i))).map(v => v.name),
    carbs[0]?.name,
    fats[0]?.amount ? `${fats[0]?.amount} ${fats[0]?.name}` : fats[0]?.name,
    condiments[0]?.name
  );

  return {
    ...meal,
    servings,
    ingredients: normalized,
    instructions: meal.instructions?.length ? meal.instructions : steps,
    tags: meal.tags || [],
  };
}