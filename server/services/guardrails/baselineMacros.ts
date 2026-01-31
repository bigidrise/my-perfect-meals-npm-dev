/**
 * Baseline Macros Configuration
 * 
 * Standard macro targets applied to all meal generators (except specialty diets like GLP-1, BeachBody, Performance).
 * Users can request more, but this is the default foundation for balanced meals.
 */

export const BASELINE_MACROS = {
  protein: 25,        // 25g protein per meal
  starchyCarbs: 25,   // 25g starchy carbs per meal
  fibrousCarbs: 50,   // 50g fibrous carbs per meal
};

export const BASELINE_MACROS_PROMPT = `
BASELINE MACRO REQUIREMENTS (MANDATORY):
Every meal must meet these minimum targets:
- Protein: ${BASELINE_MACROS.protein}g (lean meats, fish, eggs, legumes, dairy)
- Starchy Carbs: ${BASELINE_MACROS.starchyCarbs}g (rice, potatoes, quinoa, bread, oats, pasta)
- Fibrous Carbs: ${BASELINE_MACROS.fibrousCarbs}g (vegetables, leafy greens, broccoli, peppers, tomatoes)

This ensures balanced, nutritious meals. If the user requests MORE protein or carbs, honor that request. These are the baseline minimums.
`.trim();

export const BASELINE_MACROS_SNACK_PROMPT = `
BASELINE MACRO REQUIREMENTS FOR SNACKS:
Snacks should provide balanced nutrition at reduced portions:
- Protein: 10g minimum
- Starchy Carbs: 10g minimum
- Fibrous Carbs: 15g minimum

These are baseline minimums for snacks. User may request adjustments.
`.trim();
