#!/usr/bin/env node
/**
 * Safely alphabetize all meal data files
 * This script imports the actual data and re-exports it sorted
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format meal object
function formatMeal(meal, indent = '  ') {
  const lines = [];
  lines.push(`${indent}{`);
  lines.push(`${indent}  id: "${meal.id}",`);
  lines.push(`${indent}  name: "${meal.name}",`);
  lines.push(`${indent}  category: "${meal.category}",`);
  lines.push(`${indent}  mealType: "${meal.mealType}",`);
  
  if (meal.defaultCookingMethod) {
    lines.push(`${indent}  defaultCookingMethod: "${meal.defaultCookingMethod}",`);
  }
  
  lines.push(`${indent}  ingredients: [`);
  meal.ingredients.forEach((ing, i) => {
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

// Read and parse breakfast file
console.log('📖 Reading breakfast file...');
const breakfastPath = path.join(__dirname, '../client/src/data/aiPremadeBreakfast.ts');
let breakfastContent = fs.readFileSync(breakfastPath, 'utf-8');

// Import the module dynamically to get actual data
const breakfastModule = await import('../client/src/data/aiPremadeBreakfast.ts');
const breakfastMeals = [...breakfastModule.AI_PREMADE_BREAKFAST_MEALS];

// Sort by name
breakfastMeals.sort((a, b) => a.name.localeCompare(b.name));

// Generate sorted breakfast meals
const sortedBreakfastMeals = breakfastMeals.map(meal => formatMeal(meal)).join(',\n');

// Extract the header (everything before the array)
const headerMatch = breakfastContent.match(/([\s\S]*export const AI_PREMADE_BREAKFAST_MEALS: AiPremadeMeal\[\] = \[)/);
const footerMatch = breakfastContent.match(/(\];[\s\S]*$)/);

if (headerMatch && footerMatch) {
  const newContent = headerMatch[1] + '\n' + sortedBreakfastMeals + '\n' + footerMatch[1];
  fs.writeFileSync(breakfastPath, newContent, 'utf-8');
  console.log('✅ Sorted aiPremadeBreakfast.ts (' + breakfastMeals.length + ' meals)');
}

// Read and parse lunch file
console.log('📖 Reading lunch file...');
const lunchPath = path.join(__dirname, '../client/src/data/aiPremadeLunch.ts');
let lunchContent = fs.readFileSync(lunchPath, 'utf-8');

const lunchModule = await import('../client/src/data/aiPremadeLunch.ts');

// Sort each lunch category
const lunchCategories = [
  { name: 'AI_PREMADE_LUNCH_LEAN_PLATES', data: lunchModule.AI_PREMADE_LUNCH_LEAN_PLATES },
  { name: 'AI_PREMADE_LUNCH_BOWLS', data: lunchModule.AI_PREMADE_LUNCH_BOWLS },
  { name: 'AI_PREMADE_LUNCH_WRAPS', data: lunchModule.AI_PREMADE_LUNCH_WRAPS },
  { name: 'AI_PREMADE_LUNCH_SALADS', data: lunchModule.AI_PREMADE_LUNCH_SALADS },
  { name: 'AI_PREMADE_LUNCH_HOT_MEALS', data: lunchModule.AI_PREMADE_LUNCH_HOT_MEALS },
];

for (const cat of lunchCategories) {
  const meals = [...cat.data];
  meals.sort((a, b) => a.name.localeCompare(b.name));
  
  const sortedMeals = meals.map(meal => formatMeal(meal)).join(',\n');
  const regex = new RegExp(`(export const ${cat.name}: AiPremadeMeal\\[\\] = \\[)[\\s\\S]*?(\\];)`, 'm');
  lunchContent = lunchContent.replace(regex, `$1\n${sortedMeals}\n$2`);
  console.log(`✅ Sorted ${cat.name} (${meals.length} meals)`);
}

fs.writeFileSync(lunchPath, lunchContent, 'utf-8');

// Read and parse dinner file  
console.log('📖 Reading dinner file...');
const dinnerPath = path.join(__dirname, '../client/src/data/aiPremadeDinner.ts');
let dinnerContent = fs.readFileSync(dinnerPath, 'utf-8');

const dinnerModule = await import('../client/src/data/aiPremadeDinner.ts');

const dinnerCategories = [
  { name: 'DINNER_LEAN_PROTEIN_PLATES', data: dinnerModule.DINNER_LEAN_PROTEIN_PLATES },
  { name: 'DINNER_PROTEIN_CARB_BOWLS', data: dinnerModule.DINNER_PROTEIN_CARB_BOWLS },
  { name: 'DINNER_WRAPS_TACOS', data: dinnerModule.DINNER_WRAPS_TACOS },
  { name: 'DINNER_SALADS', data: dinnerModule.DINNER_SALADS },
  { name: 'DINNER_SOUPS_STEWS', data: dinnerModule.DINNER_SOUPS_STEWS },
];

for (const cat of dinnerCategories) {
  const meals = [...cat.data];
  meals.sort((a, b) => a.name.localeCompare(b.name));
  
  const sortedMeals = meals.map(meal => formatMeal(meal)).join(',\n');
  const regex = new RegExp(`(const ${cat.name}: Meal\\[\\] = \\[)[\\s\\S]*?(\\];)`, 'm');
  dinnerContent = dinnerContent.replace(regex, `$1\n${sortedMeals}\n$2`);
  console.log(`✅ Sorted ${cat.name} (${meals.length} meals)`);
}

fs.writeFileSync(dinnerPath, dinnerContent, 'utf-8');

console.log('\n✅ All meal files alphabetized successfully!');
console.log('📝 Note: Snacks are already auto-sorted via .sort() in the file');
