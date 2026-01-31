/**
 * Diabetic Diet Prompt Builder
 * 
 * Constructs AI prompt conditioning for diabetic-safe meal generation.
 * Applied when dietType === "diabetic"
 */

import { diabeticRules } from "../rules/diabeticRules";
import { BASELINE_MACROS_PROMPT, BASELINE_MACROS_SNACK_PROMPT } from '../baselineMacros';

export function buildDiabeticPromptConditions(): string {
  const blockedList = diabeticRules.blockedIngredients.slice(0, 30).join(", ");
  const preferredList = diabeticRules.preferredIngredients.slice(0, 20).join(", ");
  
  return `
CRITICAL DIABETIC DIETARY REQUIREMENTS:
This meal is for a person with diabetes. You MUST follow these strict medical guidelines:

GLYCEMIC CONTROL PRIORITY:
- Create meals with LOW GLYCEMIC IMPACT
- Avoid blood sugar spikes at all costs
- Focus on slow-releasing carbohydrates
- Prioritize fiber-rich ingredients

ABSOLUTELY FORBIDDEN (Never use these):
${blockedList}
Also avoid: all sugars, honey, maple syrup, high-GI starches, white flour products, sugary sauces, sweet fruits like bananas/grapes/pineapple/mango/watermelon

MANDATORY SUBSTITUTIONS:
- Use cauliflower rice instead of white rice
- Use zucchini noodles or chickpea pasta instead of regular pasta
- Use low-carb tortillas instead of flour tortillas
- Use cauliflower mash instead of potatoes
- Use sugar-free sauces and sweeteners
- Use berries instead of high-sugar fruits

PREFERRED INGREDIENTS (Prioritize these):
${preferredList}

${BASELINE_MACROS_PROMPT}

MACRO BALANCE FOR DIABETICS:
- Moderate protein (lean meats, fish, eggs)
- High fiber (non-starchy vegetables, legumes)
- Controlled carbohydrates (low-GI sources only)
- Moderate healthy fats (olive oil, avocado, nuts)
- Even distribution across the day

SNACK REQUIREMENTS (if generating snacks):
- Must be low-carb
- High protein OR high fiber
- Very low sugar
- Minimal glycemic load
- Examples: Greek yogurt with berries, nuts, cheese, vegetables with hummus

This is a MEDICAL REQUIREMENT. Any violation could harm the user's health.
Generate only diabetic-safe meals with complete nutrition information.
`.trim();
}

export function buildDiabeticSnackPromptConditions(): string {
  return `
CRITICAL DIABETIC SNACK REQUIREMENTS:
This snack is for a person with diabetes. Strict medical guidelines apply:

${BASELINE_MACROS_SNACK_PROMPT}

SNACK MUST BE:
- LOW CARB (under 15g net carbs preferred)
- HIGH PROTEIN or HIGH FIBER
- VERY LOW SUGAR (under 5g)
- MINIMAL GLYCEMIC LOAD

ABSOLUTELY FORBIDDEN IN SNACKS:
- Any form of sugar, honey, maple syrup
- Cookies, cakes, pastries, candy
- Regular crackers, chips, pretzels
- Sweet fruits (bananas, grapes, mango, pineapple)
- Fruit juice, sweetened beverages
- Granola bars, sweetened yogurt

DIABETIC-SAFE SNACK IDEAS:
- Greek yogurt (plain) with fresh berries
- Handful of almonds or walnuts
- Cheese with celery sticks
- Hard-boiled eggs
- Vegetables with hummus or guacamole
- Dark chocolate (70%+ cacao, small portion)
- Almond flour-based protein bites
- Cottage cheese with cucumber

CRAVING TRANSLATIONS:
- "Something sweet" → berries with cinnamon Greek yogurt
- "Chocolate craving" → dark chocolate squares with almonds
- "Cookie craving" → almond flour protein cookie
- "Crunchy snack" → raw vegetables, nuts, or low-carb crackers

This is a MEDICAL REQUIREMENT for blood sugar control.
`.trim();
}
