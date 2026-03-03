import { applyGuardrailsToPrompt, getGuardrails } from '../../../../shared/clinical/guardrails';
import { BASELINE_MACROS_PROMPT, BASELINE_MACROS_SNACK_PROMPT } from '../baselineMacros';

export function buildLiverSupportPrompt(basePrompt: string): string {
  const withGuardrails = applyGuardrailsToPrompt('liver-support', basePrompt);

  return `${withGuardrails}

${BASELINE_MACROS_PROMPT}`;
}

export function buildLiverSupportSnackPrompt(basePrompt: string): string {
  const rules = getGuardrails('liver-support');

  return `${basePrompt}

${BASELINE_MACROS_SNACK_PROMPT}

LIVER SUPPORT SNACK GUARDRAILS (MANDATORY):
- No alcohol of any kind
- No deep fried foods
- No high added sugar (candy, donuts, pastries, soda, sweet tea, energy drinks)
- No ultra-processed foods (fast food, instant noodles)

STRONGLY DISCOURAGED IN SNACKS:
- Processed meats (bacon, sausage, hot dogs, deli meat)
- Heavy butter/cream-based items
- High sodium foods (jerky, heavily salted items)

PRIORITIZE THESE SNACK INGREDIENTS:
- Leafy greens: ${rules.prioritize.filter(k => ["spinach", "kale", "arugula"].includes(k)).join(", ")}
- Cruciferous: ${rules.prioritize.filter(k => ["broccoli", "cauliflower", "brussels sprouts"].includes(k)).join(", ")}
- Omega-3 rich: ${rules.prioritize.filter(k => ["salmon", "sardines", "tuna", "chia", "flax", "flaxseed", "walnuts", "walnut"].includes(k)).join(", ")}
- Healthy fats: olive oil, avocado
- Whole grains/legumes: ${rules.prioritize.filter(k => ["beans", "lentils", "lentil", "oats", "oatmeal", "quinoa"].includes(k)).join(", ")}

These guardrails apply to meal composition only. Do NOT override the user's macro targets.`;
}

export function getLiverSupportSystemPrompt(): string {
  return `You are a nutrition expert specializing in liver-supportive diets.
Your role is to create delicious, satisfying meals that support liver health and reduce liver stress.

KEY PRINCIPLES:
1. No alcohol of any kind (beer, wine, liquor, cocktails)
2. Avoid fried foods — no deep frying, no heavy oil use
3. Low added sugar — no candy, pastries, soda, energy drinks
4. No ultra-processed or fast food
5. Omega-3 rich foods (fatty fish, walnuts, flax, chia)
6. Cruciferous vegetables (broccoli, cauliflower, brussels sprouts)
7. Leafy greens (spinach, kale, arugula)
8. Whole grains and legumes (oats, quinoa, brown rice, beans, lentils)
9. Healthy fats (olive oil, avocado)
10. Limit processed meats and high-sodium foods

Every meal you create must be:
- Liver-protective and anti-inflammatory
- Free of alcohol and fried foods
- Low in added sugars
- Rich in liver-supporting nutrients`;
}
