/**
 * Dietary Restriction Validator
 *
 * Post-generation validation for vegan, vegetarian, and pescatarian diets.
 * Uses RESTRICTION_EXPANSION as the single source of truth for forbidden ingredient
 * lists, and applies plant-milk and nut-butter masking before scanning so that
 * compliant ingredients never trigger false positives.
 *
 * Confidence scoring:
 *   high   — every ingredient was identified and none are forbidden
 *   medium — minor ambiguity (e.g. a generic "broth" with no qualifier)
 *   low    — opaque/unverifiable ingredient names present (e.g. "protein blend")
 *
 * violationSeverity:
 *   critical — direct animal product for this diet (honey for vegan, chicken for vegetarian)
 *   moderate — ambiguous derivative that MIGHT be non-compliant
 *   low      — possible cross-processing / labelling concern
 */

import type { ValidationResult } from '../types';
import {
  RESTRICTION_EXPANSION,
  maskPlantMilks,
  maskNutButters,
} from '../../allergyGuardrails';

export type DietaryMode = 'vegan' | 'vegetarian' | 'pescatarian' | 'carnivore';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ViolationSeverity = 'critical' | 'moderate' | 'low';

export interface DietaryViolation {
  ingredient: string;
  reason: string;
  severity: ViolationSeverity;
}

export interface DietaryValidationResult extends ValidationResult {
  confidence: ConfidenceLevel;
  dietaryViolations: DietaryViolation[];
}

interface MealToValidate {
  name: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
  description?: string;
}

/**
 * Opaque / unverifiable ingredient patterns — trigger confidence downgrade but not hard block.
 * These are ingredient names too vague to confirm as compliant.
 */
const OPAQUE_PATTERNS = [
  /\bprotein\s+(blend|mix|powder)\b/i,
  /\bnatural\s+(flavor|flavoring|sweetener)\b/i,
  /\bcreamy\s+base\b/i,
  /\bhouse\s+stock\b/i,
  /\bmystery\s+\w+/i,
  /\bsecret\s+sauce\b/i,
  /\bblend\b/i,
  /\bproprietary\s+mix\b/i,
];

/**
 * Ingredient normalization — maps common surface forms to the canonical
 * form that appears in RESTRICTION_EXPANSION so the validator never
 * misses an alias.
 */
const INGREDIENT_ALIASES: Record<string, string[]> = {
  'greek yogurt':        ['yogurt'],
  'whey isolate':        ['whey'],
  'whey protein':        ['whey'],
  'casein protein':      ['casein'],
  'honey drizzle':       ['honey'],
  'honey glaze':         ['honey'],
  'raw honey':           ['honey'],
  'manuka honey':        ['honey'],
  'egg white':           ['egg whites', 'egg'],
  'egg yolk':            ['egg yolks', 'egg'],
  'large egg':           ['egg', 'eggs'],
  'unsalted butter':     ['butter'],
  'salted butter':       ['butter'],
  'clarified butter':    ['butter', 'ghee'],
  'heavy whipping cream':['heavy cream', 'cream'],
  'half & half':         ['half and half'],
  'parmesan cheese':     ['parmesan', 'cheese'],
  'whole milk':          ['milk'],
  'skim milk':           ['milk'],
  '2% milk':             ['milk'],
  'reduced-fat milk':    ['milk'],
  'low-fat yogurt':      ['yogurt'],
  'collagen peptides':   ['gelatin'],
  'beef collagen':       ['beef', 'gelatin'],
  'chicken collagen':    ['chicken', 'gelatin'],
  'chicken broth':       ['chicken stock'],
  'chicken stock':       ['chicken stock'],
  'beef broth':          ['beef stock'],
  'bone broth':          ['bone broth'],
  'fish stock':          ['fish sauce'],
  'worcestershire sauce':['fish sauce', 'anchovies'],
  'anchovy paste':       ['anchovies'],
  'lard':                ['lard'],
  'schmaltz':            ['lard'],
  'duck fat':            ['lard'],
  'tallow':              ['tallow'],
  'suet':                ['suet'],
};

/**
 * Normalize a single ingredient name — expand known aliases and lowercase.
 */
function normalizeIngredientName(raw: string): string[] {
  const lower = raw.toLowerCase().trim();
  // Return the ingredient itself plus any alias expansions
  const extra = INGREDIENT_ALIASES[lower] ?? [];
  return [lower, ...extra];
}

/**
 * Determine violation severity based on the forbidden term and diet.
 */
function getSeverity(term: string, diet: DietaryMode): ViolationSeverity {
  const critical: Record<DietaryMode, string[]> = {
    vegan: [
      'meat','beef','steak','pork','bacon','ham','lamb','veal','chicken','turkey',
      'duck','poultry','fish','salmon','tuna','shellfish','shrimp','crab','lobster',
      'egg','eggs','dairy','milk','cheese','butter','cream','yogurt','honey','gelatin',
      'lard','whey','casein','bone broth','chicken stock','beef stock',
    ],
    vegetarian: [
      'meat','beef','steak','pork','bacon','ham','lamb','veal','chicken','turkey',
      'duck','poultry','fish','salmon','tuna','shellfish','shrimp','crab','lobster',
      'gelatin','lard','bone broth','chicken stock','beef stock','anchovies',
    ],
    pescatarian: [
      'meat','beef','steak','pork','bacon','ham','lamb','veal',
      'chicken','turkey','duck','poultry','lard',
    ],
    carnivore: [
      // Plants are the violation — any vegetable, fruit, grain, legume, or plant oil
      'spinach','kale','lettuce','arugula','broccoli','cauliflower','zucchini','squash',
      'cucumber','celery','carrot','onion','garlic','shallot','bell pepper','tomato',
      'mushroom','asparagus','green beans','peas','corn','eggplant','cabbage','okra',
      'apple','banana','orange','mango','berries','avocado','coconut','lemon','lime',
      'bread','pasta','rice','oats','wheat','corn','quinoa','tortilla','noodles',
      'beans','lentils','chickpeas','soy','tofu','tempeh','edamame','hummus',
      'olive oil','vegetable oil','canola oil','coconut oil','avocado oil',
      'sugar','honey','maple syrup','agave',
    ],
  };

  if (critical[diet].includes(term.toLowerCase())) return 'critical';
  return 'moderate';
}

/**
 * Check if an ingredient name is too vague to validate confidently.
 */
function isOpaque(name: string): boolean {
  return OPAQUE_PATTERNS.some(p => p.test(name));
}

/**
 * Core post-generation validator for vegan / vegetarian / pescatarian diets.
 *
 * Steps:
 *   1. Mask plant milks and nut butters to prevent false positives
 *   2. Normalize ingredient names through alias table
 *   3. Check normalized names against RESTRICTION_EXPANSION[diet]
 *   4. Check meal name and instructions for obvious red-flag terms
 *   5. Assess confidence — opaque ingredients downgrade to 'low'
 */
export function validateDietaryRestriction(
  meal: MealToValidate,
  diet: DietaryMode,
): DietaryValidationResult {
  const forbidden = RESTRICTION_EXPANSION[diet] ?? [];
  const dietaryViolations: DietaryViolation[] = [];
  const blockedIngredients: string[] = [];
  let hasOpaqueIngredient = false;

  for (const ingredient of meal.ingredients) {
    const raw = ingredient.name || '';
    if (!raw.trim()) continue;

    // Step 1: mask plant milks and nut butters in the name to avoid false positives
    const masked = maskNutButters(maskPlantMilks(raw));

    // Step 2: check for opaque/unverifiable ingredient names
    if (isOpaque(raw)) {
      hasOpaqueIngredient = true;
    }

    // Step 3: expand via alias table then scan against forbidden list
    const candidates = normalizeIngredientName(masked);
    let violated = false;

    for (const candidate of candidates) {
      // Mask again in case alias itself introduced a plant-milk token
      const cleanCandidate = maskNutButters(maskPlantMilks(candidate));

      for (const term of forbidden) {
        const termLower = term.toLowerCase();
        // Word-boundary safe scan — avoid "egg" matching "eggplant"
        const wordBoundaryPattern = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordBoundaryPattern.test(cleanCandidate)) {
          if (!violated) {
            const severity = getSeverity(termLower, diet);
            dietaryViolations.push({
              ingredient: raw,
              reason: `"${raw}" contains forbidden ${diet} ingredient: "${term}"`,
              severity,
            });
            blockedIngredients.push(raw);
            violated = true;
          }
          break;
        }
      }
      if (violated) break;
    }
  }

  // Step 4: check meal name for red-flag terms (quick scan of critical terms only)
  const criticalTerms = RESTRICTION_EXPANSION[diet]?.slice(0, 20) ?? [];
  const nameLower = maskNutButters(maskPlantMilks(meal.name.toLowerCase()));
  for (const term of criticalTerms) {
    const termLower = term.toLowerCase();
    const pattern = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(nameLower)) {
      const alreadyCaptured = dietaryViolations.some(v =>
        v.reason.includes(`"${term}"`)
      );
      if (!alreadyCaptured) {
        dietaryViolations.push({
          ingredient: meal.name,
          reason: `Meal name "${meal.name}" contains forbidden term: "${term}"`,
          severity: getSeverity(termLower, diet),
        });
        blockedIngredients.push(meal.name);
      }
    }
  }

  // Step 5: determine confidence
  let confidence: ConfidenceLevel = 'high';
  if (hasOpaqueIngredient) {
    confidence = 'low';
  } else if (dietaryViolations.some(v => v.severity === 'moderate')) {
    confidence = 'medium';
  }

  const violations = dietaryViolations.map(v => v.reason);
  const isValid = dietaryViolations.length === 0;

  return {
    isValid,
    violations,
    blockedIngredients,
    confidence,
    dietaryViolations,
  };
}
