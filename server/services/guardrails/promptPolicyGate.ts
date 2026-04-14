/**
 * PROMPT POLICY GATEKEEPER
 *
 * Single authority for deciding whether balanced-meal macro guidance
 * may be injected into an AI prompt.
 *
 * DEFAULT IS CONSERVATIVE:
 *   If the context is specialized, medical, or unrecognized → do NOT inject.
 *   Only explicit general/balanced nutrition contexts may receive guidance.
 *
 * CRITICAL: guidance text is framed as targets, never as "mandatory minimums".
 * The old "MANDATORY" / "MUST meet these minimum" framing is removed system-wide.
 */

import { canInjectBaselineMacros } from "./macroTruthContract";
import { BASELINE_MACROS } from "./baselineMacros";

export interface MacroPromptPolicyContext {
  builderType?: string;
  dietType?: string;
  mealType?: string;
  medicalMode?: boolean;
  isSingleIngredient?: boolean;
}

/**
 * Returns the balanced-meal guidance string if the context allows it,
 * or an empty string if it is blocked.
 *
 * Use this EVERYWHERE baseline macros were previously injected.
 * Replace BASELINE_MACROS_PROMPT with: getBaselineMacroPrompt(ctx)
 */
export function getBaselineMacroPrompt(ctx: MacroPromptPolicyContext): string {
  if (_isBlocked(ctx)) return "";

  return `BALANCED MEAL GUIDANCE (targets, not requirements):
For a well-rounded meal, aim for approximately:
- Protein: ${BASELINE_MACROS.protein}g (lean meats, fish, eggs, legumes, dairy)
- Starchy Carbs: ${BASELINE_MACROS.starchyCarbs}g (rice, potatoes, quinoa, bread, oats)
- Fibrous Carbs: ${BASELINE_MACROS.fibrousCarbs}g (vegetables, leafy greens, broccoli, peppers)
Honor the user's explicit request above all. These are guidelines for balance, not hard floors.`;
}

/**
 * Returns snack guidance string if the context allows it, or empty string if blocked.
 */
export function getBaselineMacroSnackPrompt(ctx: MacroPromptPolicyContext): string {
  if (_isBlocked(ctx)) return "";

  return `BALANCED SNACK GUIDANCE (targets, not requirements):
For a nourishing snack, consider:
- Some protein (10g+) for satiety
- Some fiber for digestive support
- Portions appropriate for a snack
These are guidelines only.`;
}

function _isBlocked(ctx: MacroPromptPolicyContext): boolean {
  const { builderType, dietType, mealType, medicalMode, isSingleIngredient } = ctx;

  if (medicalMode) return true;
  if (isSingleIngredient) return true;
  if (mealType === "snack") return true;

  if (dietType && !canInjectBaselineMacros(dietType)) return true;
  if (builderType && !canInjectBaselineMacros(builderType)) return true;

  const resolvedContext = builderType ?? dietType ?? "general";
  return !canInjectBaselineMacros(resolvedContext);
}
