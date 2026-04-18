/**
 * Diabetic Diet Prompt Builder
 *
 * Constructs AI prompt conditioning for diabetic-safe meal generation.
 * Applied when dietType === "diabetic".
 * Now glucose-aware: rules adapt based on current blood sugar state.
 */

import { diabeticRules } from "../rules/diabeticRules";

export type GlucoseState = "low" | "low-normal" | "in-range" | "elevated" | "high-risk";

export interface DiabeticPromptInput {
  glucoseState?: GlucoseState;
  glucoseGuidance?: string;
  preferredCarbs?: string[];       // resolved range-specific list from user settings
  mealType?: string;
}

export function buildDiabeticPromptConditions(input: DiabeticPromptInput = {}): string {
  const { glucoseState, glucoseGuidance, preferredCarbs } = input;
  const isLow = glucoseState === "low" || glucoseState === "low-normal";
  const isHigh = glucoseState === "elevated" || glucoseState === "high-risk";

  const preferredList = preferredCarbs && preferredCarbs.length > 0
    ? preferredCarbs.join(", ")
    : diabeticRules.preferredIngredients.slice(0, 20).join(", ");

  // Static blocked list (always enforced except during hypoglycemia)
  const blockedList = diabeticRules.blockedIngredients.slice(0, 30).join(", ");

  if (isLow) {
    // LOW GLUCOSE BYPASS — clinically appropriate fast-acting carbs are ALLOWED
    return `
DIABETIC MEAL — LOW GLUCOSE SUPPORT:
The user's blood glucose is currently LOW (below normal range).
${glucoseGuidance ? `\nCLINICAL GUIDANCE: ${glucoseGuidance}\n` : ""}

PRIORITY FOR THIS MEAL:
- Include fast-acting carbohydrates to help raise blood sugar safely (30–45g carbs)
- Bananas, fruit juice, orange juice, and moderate-GI fruits ARE APPROPRIATE right now
- Pair fast carbs with protein to prevent overcorrection
- Avoid heavy fats or very high fiber that slow glucose absorption

STILL AVOID:
- Pure sugar, candy, cookies, soda, energy drinks
- Fried foods, processed junk

${preferredCarbs && preferredCarbs.length > 0 ? `USER'S PREFERRED LOW-RANGE CARBS (prioritize these): ${preferredList}` : ""}

This is a MEDICAL REQUIREMENT for hypoglycemia support. Fast-acting carbs are required, not optional.
`.trim();
  }

  if (isHigh) {
    // HIGH/ELEVATED GLUCOSE — strictest rules
    return `
CRITICAL DIABETIC DIETARY REQUIREMENTS — ELEVATED GLUCOSE:
${glucoseGuidance ? `\nCLINICAL GUIDANCE: ${glucoseGuidance}\n` : ""}

GLYCEMIC CONTROL IS THE TOP PRIORITY:
- Keep carbohydrates VERY LOW (${glucoseState === "high-risk" ? "under 15g" : "15–25g"} total)
- Emphasize protein and non-starchy vegetables
- Avoid ALL high-GI foods and sweet fruits

ABSOLUTELY FORBIDDEN:
${blockedList}
Also avoid: bananas, pineapple, mango, grapes, watermelon, all sugars, honey, maple syrup, white flour products, sweet sauces

MANDATORY SUBSTITUTIONS:
- Cauliflower rice instead of any rice
- Zucchini noodles or chickpea pasta instead of pasta
- Lettuce wraps instead of tortillas
- Sugar-free sauces only

${preferredCarbs && preferredCarbs.length > 0 ? `USER'S PREFERRED HIGH-RANGE CARBS (prioritize these low-GI options): ${preferredList}` : `PREFERRED INGREDIENTS: ${diabeticRules.preferredIngredients.slice(0, 20).join(", ")}`}

MACRO BALANCE:
- High protein, high fiber, very low carb
- Non-starchy vegetables as the main bulk

This is a MEDICAL REQUIREMENT. Any violation could harm the user's health.
`.trim();
  }

  // IN-RANGE / DEFAULT — standard diabetic-safe meal
  return `
CRITICAL DIABETIC DIETARY REQUIREMENTS:
This meal is for a person with diabetes. You MUST follow these strict medical guidelines.
${glucoseGuidance ? `\nCLINICAL GUIDANCE: ${glucoseGuidance}\n` : ""}

GLYCEMIC CONTROL PRIORITY:
- Create meals with LOW GLYCEMIC IMPACT
- Avoid blood sugar spikes at all costs
- Focus on slow-releasing carbohydrates
- Prioritize fiber-rich ingredients

ABSOLUTELY FORBIDDEN (Never use these):
${blockedList}
Also avoid: all sugars, honey, maple syrup, high-GI starches, white flour products, sugary sauces, sweet fruits like bananas/grapes/pineapple/mango/watermelon

MANDATORY SUBSTITUTIONS:
- Cauliflower rice instead of white rice
- Zucchini noodles or chickpea pasta instead of regular pasta
- Low-carb tortillas instead of flour tortillas
- Cauliflower mash instead of potatoes
- Sugar-free sauces and sweeteners
- Berries instead of high-sugar fruits

${preferredCarbs && preferredCarbs.length > 0 ? `USER'S PREFERRED IN-RANGE CARBS (prioritize these): ${preferredList}` : `PREFERRED INGREDIENTS: ${diabeticRules.preferredIngredients.slice(0, 20).join(", ")}`}

MACRO BALANCE FOR DIABETICS:
- Moderate protein (lean meats, fish, eggs)
- High fiber (non-starchy vegetables, legumes)
- Controlled carbohydrates (20–35g, low-GI sources only)
- Moderate healthy fats (olive oil, avocado, nuts)

This is a MEDICAL REQUIREMENT. Any violation could harm the user's health.
Generate only diabetic-safe meals with complete nutrition information.
`.trim();
}

export function buildDiabeticSnackPromptConditions(input: DiabeticPromptInput = {}): string {
  const { glucoseState, glucoseGuidance } = input;
  const isLow = glucoseState === "low" || glucoseState === "low-normal";

  if (isLow) {
    return `
DIABETIC SNACK — LOW GLUCOSE SUPPORT:
${glucoseGuidance ? `CLINICAL GUIDANCE: ${glucoseGuidance}\n` : ""}
Snack should include 15–20g fast-acting carbohydrates to help stabilize blood sugar.
Appropriate options: fruit, small portion of juice, crackers with peanut butter, banana with protein.
Pair carbs with protein to prevent overcorrection spike.
`.trim();
  }

  return `
CRITICAL DIABETIC SNACK REQUIREMENTS:
This snack is for a person with diabetes. Strict medical guidelines apply.
${glucoseGuidance ? `\nCLINICAL GUIDANCE: ${glucoseGuidance}\n` : ""}

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
