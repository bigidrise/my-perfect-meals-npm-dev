import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import meal data
import { AI_PREMADE_BREAKFAST_MEALS } from '../client/src/data/aiPremadeBreakfast';
import {
  AI_PREMADE_LUNCH_LEAN_PLATES,
  AI_PREMADE_LUNCH_BOWLS,
  AI_PREMADE_LUNCH_WRAPS,
  AI_PREMADE_LUNCH_SALADS,
  AI_PREMADE_LUNCH_HOT_MEALS
} from '../client/src/data/aiPremadeLunch';
import {
  DINNER_LEAN_PROTEIN_PLATES,
  DINNER_PROTEIN_CARB_BOWLS,
  DINNER_WRAPS_TACOS,
  DINNER_SALADS,
  DINNER_SOUPS_STEWS
} from '../client/src/data/aiPremadeDinner';

// Helper to format meal object
function formatMeal(meal: any, indent = '  '): string {
  const lines: string[] = [];
  lines.push(`${indent}{`);
  lines.push(`${indent}  id: "${meal.id}",`);
  lines.push(`${indent}  name: "${meal.name}",`);
  lines.push(`${indent}  category: "${meal.category}",`);
  lines.push(`${indent}  mealType: "${meal.mealType}",`);
  
  if (meal.defaultCookingMethod) {
    lines.push(`${indent}  defaultCookingMethod: "${meal.defaultCookingMethod}",`);
  }
  
  lines.push(`${indent}  ingredients: [`);
  meal.ingredients.forEach((ing: any, i: number) => {
    const isLast = i === meal.ingredients.length - 1;
    lines.push(`${indent}    { item: "${ing.item}", quantity: ${ing.quantity}, unit: "${ing.unit}" }${isLast ? '' : ','}`);
  });
  lines.push(`${indent}  ],`);
  
  if (meal.notes) {
    lines.push(`${indent}  notes: "${meal.notes}",`);
  }
  
  lines.push(`${indent}}`);
  return lines.join('\n');
}

// Process breakfast
console.log('📖 Processing breakfast...');
const breakfastMeals = [...AI_PREMADE_BREAKFAST_MEALS];
breakfastMeals.sort((a, b) => a.name.localeCompare(b.name));

const breakfastPath = path.join(__dirname, '../client/src/data/aiPremadeBreakfast.ts');
let breakfastContent = fs.readFileSync(breakfastPath, 'utf-8');

const sortedBreakfast = breakfastMeals.map(meal => formatMeal(meal)).join(',\n');
const breakfastRegex = /(export const AI_PREMADE_BREAKFAST_MEALS: AiPremadeMeal\[\] = \[)[\s\S]*?(\];)/;
breakfastContent = breakfastContent.replace(breakfastRegex, `$1\n${sortedBreakfast}\n$2`);

fs.writeFileSync(breakfastPath, breakfastContent, 'utf-8');
console.log(`✅ Sorted breakfast (${breakfastMeals.length} meals)`);

// Process lunch
console.log('📖 Processing lunch...');
const lunchPath = path.join(__dirname, '../client/src/data/aiPremadeLunch.ts');
let lunchContent = fs.readFileSync(lunchPath, 'utf-8');

const lunchCats = [
  { name: 'AI_PREMADE_LUNCH_LEAN_PLATES', data: AI_PREMADE_LUNCH_LEAN_PLATES },
  { name: 'AI_PREMADE_LUNCH_BOWLS', data: AI_PREMADE_LUNCH_BOWLS },
  { name: 'AI_PREMADE_LUNCH_WRAPS', data: AI_PREMADE_LUNCH_WRAPS },
  { name: 'AI_PREMADE_LUNCH_SALADS', data: AI_PREMADE_LUNCH_SALADS },
  { name: 'AI_PREMADE_LUNCH_HOT_MEALS', data: AI_PREMADE_LUNCH_HOT_MEALS },
];

for (const cat of lunchCats) {
  const meals = [...cat.data];
  meals.sort((a, b) => a.name.localeCompare(b.name));
  
  const sortedMeals = meals.map(meal => formatMeal(meal)).join(',\n');
  const regex = new RegExp(`(export const ${cat.name}: AiPremadeMeal\\[\\] = \\[)[\\s\\S]*?(\\];)`, 'm');
  lunchContent = lunchContent.replace(regex, `$1\n${sortedMeals}\n$2`);
  console.log(`✅ Sorted ${cat.name} (${meals.length} meals)`);
}

fs.writeFileSync(lunchPath, lunchContent, 'utf-8');

// Process dinner
console.log('📖 Processing dinner...');
const dinnerPath = path.join(__dirname, '../client/src/data/aiPremadeDinner.ts');
let dinnerContent = fs.readFileSync(dinnerPath, 'utf-8');

const dinnerCats = [
  { name: 'DINNER_LEAN_PROTEIN_PLATES', data: DINNER_LEAN_PROTEIN_PLATES },
  { name: 'DINNER_PROTEIN_CARB_BOWLS', data: DINNER_PROTEIN_CARB_BOWLS },
  { name: 'DINNER_WRAPS_TACOS', data: DINNER_WRAPS_TACOS },
  { name: 'DINNER_SALADS', data: DINNER_SALADS },
  { name: 'DINNER_SOUPS_STEWS', data: DINNER_SOUPS_STEWS },
];

for (const cat of dinnerCats) {
  const meals = [...cat.data];
  meals.sort((a, b) => a.name.localeCompare(b.name));
  
  const sortedMeals = meals.map(meal => formatMeal(meal)).join(',\n');
  const regex = new RegExp(`(const ${cat.name}: Meal\\[\\] = \\[)[\\s\\S]*?(\\];)`, 'm');
  dinnerContent = dinnerContent.replace(regex, `$1\n${sortedMeals}\n$2`);
  console.log(`✅ Sorted ${cat.name} (${meals.length} meals)`);
}

fs.writeFileSync(dinnerPath, dinnerContent, 'utf-8');

console.log('\n✅ All meals alphabetized!');
