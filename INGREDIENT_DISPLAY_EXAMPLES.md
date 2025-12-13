# Ingredient Macro Display Examples

This document shows how ingredients are now displayed with macronutrient content.

## How It Works

The system converts ingredient amounts to macronutrient content based on a comprehensive nutrition database.

### Format
```
[amount] [unit] [ingredient name] ([macro value]g [macro type])
```

## Examples

### Protein Sources
- **Input:** `4 oz chicken breast`
- **Output:** `4 oz chicken breast (35g protein)`

- **Input:** `6 oz salmon`
- **Output:** `6 oz salmon (34g protein)`

- **Input:** `8 oz ground turkey`
- **Output:** `8 oz ground turkey (63g protein)`

### Carb Sources
- **Input:** `8 oz yams`
- **Output:** `8 oz yams (63g carbs)`

- **Input:** `1 cup brown rice`
- **Output:** `1 cup brown rice (39g carbs)`

- **Input:** `6 oz sweet potato`
- **Output:** `6 oz sweet potato (34g carbs)`

### Fat Sources  
- **Input:** `1 tbsp olive oil`
- **Output:** `1 tbsp olive oil (14g fat)`

- **Input:** `2 oz avocado`
- **Output:** `2 oz avocado (8g fat)`

## Technical Details

### Nutrition Database
Located in `client/src/data/ingredients.nutrition.ts`
- All values are per 100g
- Includes proteins, starches, vegetables, fruits, and fats
- Easily expandable for new ingredients

### Conversion Logic
Located in `client/src/utils/unitConversions.ts`
- Converts various units (oz, lb, cups, tbsp, g) to grams
- Looks up ingredient nutrition data
- Calculates macros based on amount
- Determines primary macro to display (protein, carbs, or fat)
- Formats output string

### Components Updated
All meal card components now show macronutrient content:
- `MealCardFull.tsx`
- `MealCardDynamic.tsx`
- `EnhancedMealCard.tsx`
- `WeeklyMealCard.tsx`
- `CookingInstructionsModal.tsx`
- `TemplateMealCard.tsx`

## Benefits for Users

1. **Meal Prep**: Know exactly what macros each portion provides
2. **Shopping**: Buy the right amounts to hit macro targets
3. **Cooking**: Understand the nutritional value while preparing meals
4. **Tracking**: Easier to log meals with macro information visible
