/**
 * Retail Intelligence Layer
 *
 * Display-only transformation: converts recipe measurements → how humans actually shop.
 * The underlying data (exact quantity, exact unit) is NEVER modified.
 *
 * Pipeline order (per spec):
 * 1. Aggregate → 2. Normalize units → 3. Merge → 4. Classify → 5. Retail convert → 6. Render
 * This file handles step 5.
 */
import type { ShoppingListItem } from '@/stores/shoppingListStore';
import { formatQuantity } from '@/lib/formatQuantity';

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(name: string): string {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Volume → ml
const VOL_TO_ML: Record<string, number> = {
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  cup: 236.588, cups: 236.588,
  'fl oz': 29.574, 'fluid oz': 29.574,
  oz: 29.574,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
};

function toMl(qty: number, unit: string): number | null {
  const ml = VOL_TO_ML[(unit || '').toLowerCase().trim()];
  return ml !== undefined ? qty * ml : null;
}

// Volume → cups
const VOL_TO_CUPS: Record<string, number> = {
  tsp: 1 / 48, teaspoon: 1 / 48, teaspoons: 1 / 48,
  tbsp: 1 / 16, tablespoon: 1 / 16, tablespoons: 1 / 16,
  cup: 1, cups: 1,
  'fl oz': 1 / 8, 'fluid oz': 1 / 8,
  oz: 1 / 8,
  ml: 1 / 236.588, l: 4.227, liter: 4.227, liters: 4.227,
};

function toCups(qty: number, unit: string): number | null {
  const factor = VOL_TO_CUPS[(unit || '').toLowerCase().trim()];
  return factor !== undefined ? qty * factor : null;
}

// Weight → lbs
const TO_LBS: Record<string, number> = {
  lb: 1, lbs: 1, pound: 1, pounds: 1,
  oz: 1 / 16, ounce: 1 / 16, ounces: 1 / 16,
  g: 1 / 453.592, gram: 1 / 453.592, grams: 1 / 453.592,
  kg: 2.20462, kilogram: 2.20462, kilograms: 2.20462,
};

function toLbs(qty: number, unit: string): number | null {
  const factor = TO_LBS[(unit || '').toLowerCase().trim()];
  return factor !== undefined ? qty * factor : null;
}

function isUnitless(unit: string): boolean {
  const u = (unit || '').toLowerCase().trim();
  return !u || u === 'unit' || u === 'units' || u === 'piece' || u === 'pieces' || u === 'whole';
}

// ── Tier 1: Always hide quantity ───────────────────────────────────────────────
// Dry spices, dried herbs, salt, pepper — you grab the jar. Amount is irrelevant.
const TIER_1_ALWAYS_HIDE = new Set([
  'salt', 'sea salt', 'kosher salt', 'table salt', 'himalayan salt', 'pink salt',
  'fleur de sel', 'celtic salt', 'salt & pepper', 'salt and pepper',
  'black pepper', 'white pepper', 'pepper', 'cayenne', 'cayenne pepper',
  'red pepper flakes', 'red pepper flake', 'chili flakes', 'crushed red pepper',
  'garlic powder', 'onion powder', 'paprika', 'smoked paprika', 'sweet paprika',
  'chili powder', 'cumin', 'turmeric', 'curry powder', 'garam masala',
  'ginger powder', 'ground ginger', 'cinnamon', 'nutmeg', 'allspice',
  'clove', 'cloves', 'cardamom', 'coriander', 'ground coriander',
  'fennel seed', 'fennel seeds', 'mustard powder', 'dry mustard',
  'celery salt', 'seasoning salt', 'lemon pepper', 'old bay',
  'everything bagel seasoning', "za'atar", 'five spice', 'chinese five spice',
  'harissa powder', 'sumac',
  'oregano', 'dried oregano', 'thyme', 'dried thyme', 'basil', 'dried basil',
  'italian seasoning', 'bay leaf', 'bay leaves', 'rosemary', 'dried rosemary',
  'sage', 'dried sage', 'dill', 'dill weed', 'dried dill', 'marjoram',
  'tarragon', 'herbs de provence', 'mixed herbs', 'parsley flakes', 'dried parsley',
  'baking powder', 'baking soda', 'bicarbonate of soda',
  'cornstarch', 'corn starch', 'arrowroot', 'cream of tartar',
  'vanilla', 'vanilla extract', 'pure vanilla extract',
  'almond extract', 'peppermint extract',
  'cocoa powder', 'cocoa', 'unsweetened cocoa',
  'cooking spray', 'nonstick spray',
]);

// ── Tier 2: Conditional — hide if small, show purchase unit if large ───────────
type Tier2Config = { thresholdMl: number; purchaseUnit: string };

const TIER_2_CONDITIONAL: Record<string, Tier2Config> = {
  // Oils — threshold: ¼ cup (59ml)
  'olive oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'extra virgin olive oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'evoo': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'vegetable oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'canola oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'coconut oil': { thresholdMl: 59, purchaseUnit: 'jar' },
  'sesame oil': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'toasted sesame oil': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'avocado oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'sunflower oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'grapeseed oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'peanut oil': { thresholdMl: 59, purchaseUnit: 'bottle' },
  // Vinegars — threshold: 3 tbsp (44ml)
  'vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'white vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'distilled vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'apple cider vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'balsamic vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'balsamic': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'red wine vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'white wine vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'rice vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'rice wine vinegar': { thresholdMl: 44, purchaseUnit: 'bottle' },
  // Sauces & condiments — threshold: 2 tbsp (30ml)
  'soy sauce': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'tamari': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'coconut aminos': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'fish sauce': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'worcestershire': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'worcestershire sauce': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'hot sauce': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'sriracha': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'hoisin sauce': { thresholdMl: 30, purchaseUnit: 'jar' },
  'oyster sauce': { thresholdMl: 30, purchaseUnit: 'jar' },
  'teriyaki sauce': { thresholdMl: 30, purchaseUnit: 'bottle' },
  'ketchup': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'mustard': { thresholdMl: 30, purchaseUnit: 'jar' },
  'dijon mustard': { thresholdMl: 30, purchaseUnit: 'jar' },
  'yellow mustard': { thresholdMl: 30, purchaseUnit: 'jar' },
  'whole grain mustard': { thresholdMl: 30, purchaseUnit: 'jar' },
  'mayonnaise': { thresholdMl: 30, purchaseUnit: 'jar' },
  'mayo': { thresholdMl: 30, purchaseUnit: 'jar' },
  'bbq sauce': { thresholdMl: 44, purchaseUnit: 'bottle' },
  'barbecue sauce': { thresholdMl: 44, purchaseUnit: 'bottle' },
  // Sweeteners — threshold: ¼ cup (59ml equivalent by volume for liquids)
  'honey': { thresholdMl: 59, purchaseUnit: 'jar' },
  'maple syrup': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'pure maple syrup': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'agave': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'agave nectar': { thresholdMl: 59, purchaseUnit: 'bottle' },
};

// ── Grain density table (cups → lbs, category-based averages) ─────────────────
const GRAIN_LB_PER_CUP: Record<string, number> = {
  // Rice — ~0.44 lb/cup
  rice: 0.44, 'white rice': 0.44, 'brown rice': 0.45,
  'jasmine rice': 0.44, 'basmati rice': 0.44, 'wild rice': 0.40,
  // Pasta — ~0.25 lb/cup
  pasta: 0.25, spaghetti: 0.25, penne: 0.25, fettuccine: 0.25,
  macaroni: 0.25, linguine: 0.25, orzo: 0.30, 'egg noodle': 0.25,
  noodle: 0.25,
  // Grains — ~0.35–0.45 lb/cup
  quinoa: 0.38, couscous: 0.35, bulgur: 0.38, farro: 0.42,
  barley: 0.40, 'steel cut oats': 0.27,
  // Oats — ~0.22 lb/cup
  oat: 0.22, oats: 0.22, oatmeal: 0.22, 'rolled oats': 0.22,
  // Flour — ~0.28–0.30 lb/cup
  flour: 0.28, 'all-purpose flour': 0.28, 'bread flour': 0.28,
  'whole wheat flour': 0.28, 'almond flour': 0.35,
};

function getGrainDensity(name: string): number | null {
  const n = norm(name);
  if (GRAIN_LB_PER_CUP[n] !== undefined) return GRAIN_LB_PER_CUP[n];
  // Try first word (e.g. "rice" from "brown rice")
  const first = n.split(' ')[0];
  return GRAIN_LB_PER_CUP[first] ?? null;
}

// ── Meat keyword check ─────────────────────────────────────────────────────────
const MEAT_TERMS = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham',
  'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mahi', 'trout', 'bass',
  'shrimp', 'crab', 'lobster', 'scallop', 'fish', 'steak', 'brisket',
  'sirloin', 'ribeye', 'tenderloin', 'roast', 'ground beef', 'ground turkey',
  'ground chicken', 'ground pork',
];

function isMeatItem(n: string): boolean {
  return MEAT_TERMS.some(t => n.includes(t));
}

// ── Retail rounding helpers ────────────────────────────────────────────────────

// Eggs → nearest dozen (always round UP)
function eggsToDozen(count: number): string {
  const dozens = Math.ceil(count / 12);
  return dozens === 1 ? '1 dozen' : `${dozens} dozen`;
}

// Meat → round to nearest 0.5 lb, min 1 lb, prefix with "~"
function roundMeatLbs(lbs: number): string {
  const rounded = Math.max(1, Math.ceil(lbs * 2) / 2);
  // Show as whole number if it is one
  const display = rounded % 1 === 0 ? rounded.toString() : rounded.toString();
  return `~${display} lb`;
}

// Grains → cups to lbs, round UP to nearest 0.5 lb, min 0.5 lb
function grainCupsToLbs(cups: number, density: number): string {
  const lbs = cups * density;
  const rounded = Math.max(0.5, Math.ceil(lbs * 2) / 2);
  const display = rounded % 1 === 0 ? rounded.toString() : rounded.toString();
  return `${display} lb`;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns the quantity string to display for a shopping list item.
 * - null   → hide the quantity entirely (pantry staple with no notable amount)
 * - string → show this string as the quantity
 */
export function getRetailQuantity(item: ShoppingListItem): string | null {
  const n = norm(item.name);
  const unit = (item.unit || '').toLowerCase().trim();
  const qty = item.quantity || 0;

  // ── Eggs (check before meat since eggs are in dairy keywords) ─────────────
  const isEgg = (n === 'egg' || n === 'eggs' || n === 'egg white' || n === 'egg yolk')
    && !n.includes('eggplant');
  if (isEgg && isUnitless(unit) && qty > 0) {
    return eggsToDozen(qty);
  }

  // ── Meat & fish (weight-based) ────────────────────────────────────────────
  if (isMeatItem(n)) {
    const lbs = toLbs(qty, unit);
    if (lbs !== null && lbs > 0) {
      return roundMeatLbs(lbs);
    }
  }

  // ── Grains / pasta / oats (volume → lbs) ─────────────────────────────────
  const density = getGrainDensity(n);
  if (density !== null) {
    const cups = toCups(qty, unit);
    if (cups !== null && cups > 0) {
      return grainCupsToLbs(cups, density);
    }
    // If already in weight units, just round to 0.5 lb
    const lbs = toLbs(qty, unit);
    if (lbs !== null && lbs > 0) {
      const rounded = Math.max(0.5, Math.ceil(lbs * 2) / 2);
      return `${rounded} lb`;
    }
  }

  // ── Tier 1: Always hidden spices/herbs/baking staples ────────────────────
  if (TIER_1_ALWAYS_HIDE.has(n)) {
    return null;
  }

  // ── Tier 2: Conditional oils/sauces/sweeteners ───────────────────────────
  if (item.isPantryStaple) {
    const tier2 = TIER_2_CONDITIONAL[n];
    if (tier2) {
      const ml = toMl(qty, unit);
      if (ml !== null && ml >= tier2.thresholdMl) {
        return `1 ${tier2.purchaseUnit}`;
      }
    }
    // All other pantry staples: hide quantity
    return null;
  }

  // ── Regular items: use standard formatter ─────────────────────────────────
  return formatQuantity(qty, unit) || null;
}
