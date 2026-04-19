/**
 * Builder Guardrail Configuration
 *
 * Defines which diet types are "coachable builders" (override dialog allowed)
 * vs which are "identity diets" (never override — handled by DietGuardIntercept).
 *
 * ARCHITECTURE RULE:
 *   Identity diets  → who you ARE  → hard constraint, no dialog
 *   Builder diets   → how you EAT  → coachable, show override dialog
 */

export type CoachableBuilder =
  | 'anti-inflammatory'
  | 'liver-support'
  | 'glp1'
  | 'diabetic'
  | 'beachbody'
  | 'performance'
  | 'general-nutrition'
  | 'procare';

export const COACHABLE_BUILDERS: ReadonlySet<string> = new Set<CoachableBuilder>([
  'anti-inflammatory',
  'liver-support',
  'glp1',
  'diabetic',
  'beachbody',
  'performance',
  'general-nutrition',
  'procare',
]);

export function isCoachableBuilder(dietType: string | null | undefined): boolean {
  if (!dietType) return false;
  return COACHABLE_BUILDERS.has(dietType);
}

/**
 * Per-builder soft-block lists.
 * Items here trigger the override dialog when a user explicitly names them.
 * These are COACHABLE conflicts — not hard identity blocks.
 *
 * Hard-blocked items (e.g. bacon, sausage on anti-inflammatory) are not listed here
 * because those are enforced silently at the server level with no override path.
 */
export const BUILDER_SOFT_BLOCKS: Record<CoachableBuilder, string[]> = {
  'anti-inflammatory': [
    'steak', 'beef', 'burger', 'hamburger', 'cheeseburger', 'lamb', 'mutton',
    'pork chop', 'pork loin', 'pork tenderloin', 'prime rib', 'rib eye', 'ribeye',
    'new york strip', 't-bone', 'ground beef', 'brisket', 'short ribs', 'chuck',
    'roast beef', 'pork roast', 'baby back ribs', 'spare ribs',
  ],
  'glp1': [
    'pasta', 'pizza', 'burger', 'hamburger', 'cheeseburger', 'fries', 'french fries',
    'fried chicken', 'fried fish', 'deep fried', 'nachos', 'cheesesteak', 'sub sandwich',
    'hoagie', 'battered', 'tempura', 'funnel cake', 'onion rings',
  ],
  'diabetic': [
    'white rice', 'white bread', 'pasta', 'pizza', 'juice', 'smoothie',
    'cake', 'cupcake', 'cookies', 'candy', 'ice cream', 'milkshake',
    'sugar cereal', 'granola bar', 'muffin', 'donut', 'pancake syrup',
    'french toast', 'waffle syrup',
  ],
  'beachbody': [
    'pizza', 'burger', 'hamburger', 'fries', 'french fries', 'cake', 'ice cream',
    'nachos', 'fried chicken', 'fried food', 'cheesesteak', 'donuts', 'cookies',
  ],
  'performance': [
    'pizza', 'burger', 'fries', 'cake', 'ice cream', 'nachos', 'fried food',
    'alcohol', 'beer', 'wine',
  ],
  'liver-support': [
    'steak', 'beef', 'burger', 'lamb', 'pork', 'fried food', 'french fries',
    'fried chicken', 'deep fried', 'heavy cream', 'full fat cheese',
  ],
  'general-nutrition': [],
  'procare': [],
};

/**
 * Detect whether user input contains an explicit food request
 * that conflicts with the active builder's soft-block list.
 *
 * Returns null if no conflict, or the first matching item string.
 */
export function detectBuilderConflict(
  input: string,
  dietType: string | null | undefined
): string | null {
  if (!dietType || !isCoachableBuilder(dietType)) return null;

  const softBlocks = BUILDER_SOFT_BLOCKS[dietType as CoachableBuilder];
  if (!softBlocks || softBlocks.length === 0) return null;

  const normalizedInput = input.toLowerCase();

  for (const item of softBlocks) {
    if (normalizedInput.includes(item.toLowerCase())) {
      return item;
    }
  }

  return null;
}

/**
 * Human-readable label for a builder diet type
 */
export function getBuilderLabel(dietType: string): string {
  const labels: Record<string, string> = {
    'anti-inflammatory': 'Anti-Inflammatory',
    'glp1': 'GLP-1',
    'diabetic': 'Diabetic',
    'beachbody': 'Beachbody',
    'performance': 'Performance',
    'liver-support': 'Liver Support',
    'general-nutrition': 'Nutrition',
    'procare': 'ProCare',
  };
  return labels[dietType] ?? dietType;
}
