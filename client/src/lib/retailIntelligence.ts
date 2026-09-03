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

// Volume → tablespoons
function toTbsp(qty: number, unit: string): number | null {
  const cups = toCups(qty, unit);
  return cups !== null ? cups * 16 : null;
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

// Weight → grams (for produce count estimation)
const TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

function toG(qty: number, unit: string): number | null {
  const factor = TO_G[(unit || '').toLowerCase().trim()];
  return factor !== undefined ? qty * factor : null;
}

function isUnitless(unit: string): boolean {
  const u = (unit || '').toLowerCase().trim();
  return !u || u === 'unit' || u === 'units' || u === 'piece' || u === 'pieces'
    || u === 'whole' || u === 'each' || u === 'count';
}

function isVolumeUnit(unit: string): boolean {
  const u = (unit || '').toLowerCase().trim();
  return u in VOL_TO_CUPS;
}

// ── Retail rounding helpers ────────────────────────────────────────────────────

// Meat → round to nearest 0.5 lb, min 1 lb, prefix with "~"
function roundMeatLbs(lbs: number): string {
  const rounded = Math.max(1, Math.ceil(lbs * 2) / 2);
  return `~${rounded} lb`;
}

// Grains → cups to lbs, round UP to nearest 0.5 lb, min 0.5 lb
function grainCupsToLbs(cups: number, density: number): string {
  const lbs = cups * density;
  const rounded = Math.max(0.5, Math.ceil(lbs * 2) / 2);
  return `${rounded} lb`;
}

// ── Plant proteins ─────────────────────────────────────────────────────────────
const PLANT_PROTEIN_DISPLAY: Record<string, string> = {
  tofu: '1 block',
  tempeh: '1 package',
  seitan: '1 package',
  'textured vegetable protein': '1 package',
  tvp: '1 package',
  jackfruit: '1 can',
};

function getPlantProteinDisplay(n: string): string | null {
  if (n.includes('tofu')) return '1 block';
  if (n.includes('tempeh')) return '1 package';
  if (n.includes('seitan')) return '1 package';
  for (const [key, val] of Object.entries(PLANT_PROTEIN_DISPLAY)) {
    if (n === key) return val;
  }
  return null;
}

// ── Eggs → nearest dozen (always round UP) ────────────────────────────────────
function eggsToDozen(count: number): string {
  const dozens = Math.ceil(count / 12);
  return dozens === 1 ? '1 dozen' : `${dozens} dozen`;
}

// ── Fish fillet weight estimates (lbs per fillet) ──────────────────────────────
// small→0.25, medium→0.35, large→0.5 (per spec)
const FISH_LB_PER_FILLET: Array<[string[], number]> = [
  [['tilapia', 'cod', 'trout', 'bass', 'catfish', 'flounder', 'sole', 'perch', 'sardine'], 0.25],
  [['salmon', 'halibut', 'mahi', 'tuna', 'snapper', 'grouper', 'swordfish', 'branzino', 'sea bass'], 0.35],
];

function getFishFilletLbPerUnit(n: string): number | null {
  for (const [names, lb] of FISH_LB_PER_FILLET) {
    if (names.some(f => n.includes(f))) return lb;
  }
  if (n.includes('fish') || n.includes('fillet')) return 0.35;
  return null;
}

// ── Meat keyword check ─────────────────────────────────────────────────────────
const MEAT_TERMS = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham',
  'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mahi', 'trout', 'bass',
  'shrimp', 'crab', 'lobster', 'scallop', 'fish', 'steak', 'brisket',
  'sirloin', 'ribeye', 'tenderloin', 'roast', 'ground beef', 'ground turkey',
  'ground chicken', 'ground pork', 'snapper', 'grouper', 'branzino', 'catfish',
];

function isMeatItem(n: string): boolean {
  return MEAT_TERMS.some(t => n.includes(t));
}

// ── Grain density table (cups → lbs, category-based averages) ─────────────────
const GRAIN_LB_PER_CUP: Record<string, number> = {
  rice: 0.44, 'white rice': 0.44, 'brown rice': 0.45,
  'jasmine rice': 0.44, 'basmati rice': 0.44, 'wild rice': 0.40,
  pasta: 0.25, spaghetti: 0.25, penne: 0.25, fettuccine: 0.25,
  macaroni: 0.25, linguine: 0.25, orzo: 0.30, 'egg noodle': 0.25,
  noodle: 0.25,
  quinoa: 0.38, couscous: 0.35, bulgur: 0.38, farro: 0.42,
  barley: 0.40, 'steel cut oats': 0.27,
  oat: 0.22, oats: 0.22, oatmeal: 0.22, 'rolled oats': 0.22,
  flour: 0.28, 'all-purpose flour': 0.28, 'bread flour': 0.28,
  'whole wheat flour': 0.28, 'almond flour': 0.35,
};

function getGrainDensity(name: string): number | null {
  const n = norm(name);
  if (GRAIN_LB_PER_CUP[n] !== undefined) return GRAIN_LB_PER_CUP[n];
  const first = n.split(' ')[0];
  return GRAIN_LB_PER_CUP[first] ?? null;
}

// ── Bread → loaf ───────────────────────────────────────────────────────────────
function getBreadDisplay(n: string, unit: string): string | null {
  const isBread = (n.includes('bread') || n.includes('loaf')) &&
    !n.includes('breadcrumb') && !n.includes('crouton') && !n.includes('breadstick');
  if (!isBread) return null;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'slice' || u === 'slices' || isUnitless(u)) return '1 loaf';
  return null;
}

// ── Container items: seeds, tahini, nut butters in small amounts ───────────────
// Converts recipe-sized measures (tbsp, tsp) to what you actually purchase
const CONTAINER_DISPLAY: Array<{ keywords: string[]; display: string }> = [
  { keywords: ['tahini'],                           display: '1 container' },
  { keywords: ['pumpkin seed', 'pepita'],           display: '1 bag' },
  { keywords: ['sesame seed'],                      display: '1 container' },
  { keywords: ['hemp seed'],                        display: '1 bag' },
  { keywords: ['sunflower seed'],                   display: '1 bag' },
  { keywords: ['flax seed', 'flaxseed'],            display: '1 bag' },
  { keywords: ['chia seed', 'chia'],                display: '1 bag' },
];

function getContainerDisplay(n: string, unit: string): string | null {
  // Apply when recipe-measured in small cooking amounts or unitless
  const u = unit.toLowerCase().trim();
  const isSmall = !u || u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons'
    || u === 'tsp' || u === 'teaspoon' || u === 'teaspoons' || u === 'cup' || u === 'cups';
  if (!isSmall) return null;
  for (const { keywords, display } of CONTAINER_DISPLAY) {
    if (keywords.some(k => n.includes(k))) return display;
  }
  return null;
}

// ── Produce weight (g) → count/bag/bunch/head ─────────────────────────────────
// Handles items stored in grams from the nutrition engine.
// Reference weights represent typical retail purchase units.
const PRODUCE_WEIGHT_TABLE: Array<{
  keywords: string[];
  purchaseUnit: string;
  gramsPerUnit: number;
}> = [
  // Count produce
  { keywords: ['avocado'],                     purchaseUnit: 'each',      gramsPerUnit: 170 },
  { keywords: ['onion', 'yellow onion', 'white onion', 'sweet onion'], purchaseUnit: 'each', gramsPerUnit: 180 },
  { keywords: ['red onion'],                   purchaseUnit: 'each',      gramsPerUnit: 200 },
  { keywords: ['shallot'],                     purchaseUnit: 'each',      gramsPerUnit: 50 },
  { keywords: ['lemon'],                       purchaseUnit: 'each',      gramsPerUnit: 100 },
  { keywords: ['lime'],                        purchaseUnit: 'each',      gramsPerUnit: 70 },
  { keywords: ['orange'],                      purchaseUnit: 'each',      gramsPerUnit: 180 },
  { keywords: ['grapefruit'],                  purchaseUnit: 'each',      gramsPerUnit: 300 },
  { keywords: ['apple'],                       purchaseUnit: 'each',      gramsPerUnit: 180 },
  { keywords: ['banana'],                      purchaseUnit: 'each',      gramsPerUnit: 120 },
  { keywords: ['pear'],                        purchaseUnit: 'each',      gramsPerUnit: 180 },
  { keywords: ['peach'],                       purchaseUnit: 'each',      gramsPerUnit: 150 },
  { keywords: ['plum'],                        purchaseUnit: 'each',      gramsPerUnit: 70 },
  { keywords: ['mango'],                       purchaseUnit: 'each',      gramsPerUnit: 250 },
  { keywords: ['kiwi'],                        purchaseUnit: 'each',      gramsPerUnit: 75 },
  { keywords: ['russet potato'],               purchaseUnit: 'each',      gramsPerUnit: 280 },
  { keywords: ['gold potato', 'yukon'],        purchaseUnit: 'each',      gramsPerUnit: 170 },
  { keywords: ['sweet potato'],                purchaseUnit: 'each',      gramsPerUnit: 180 },
  { keywords: ['potato'],                      purchaseUnit: 'each',      gramsPerUnit: 210 },
  { keywords: ['yam'],                         purchaseUnit: 'each',      gramsPerUnit: 180 },
  { keywords: ['zucchini'],                    purchaseUnit: 'each',      gramsPerUnit: 200 },
  { keywords: ['cucumber'],                    purchaseUnit: 'each',      gramsPerUnit: 280 },
  { keywords: ['bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper'], purchaseUnit: 'each', gramsPerUnit: 150 },
  { keywords: ['tomato', 'roma tomato'],       purchaseUnit: 'each',      gramsPerUnit: 125 },
  { keywords: ['eggplant'],                    purchaseUnit: 'each',      gramsPerUnit: 450 },
  { keywords: ['beet'],                        purchaseUnit: 'each',      gramsPerUnit: 150 },
  { keywords: ['turnip'],                      purchaseUnit: 'each',      gramsPerUnit: 200 },
  { keywords: ['parsnip'],                     purchaseUnit: 'each',      gramsPerUnit: 120 },
  { keywords: ['jalapeño', 'jalapeno'],        purchaseUnit: 'each',      gramsPerUnit: 15 },
  { keywords: ['serrano'],                     purchaseUnit: 'each',      gramsPerUnit: 10 },
  { keywords: ['leek'],                        purchaseUnit: 'each',      gramsPerUnit: 150 },
  // Bag / bunch / head / container produce
  { keywords: ['cherry tomato', 'grape tomato'], purchaseUnit: 'container', gramsPerUnit: 283 },
  { keywords: ['baby spinach', 'spinach'],     purchaseUnit: 'bag',       gramsPerUnit: 142 },
  { keywords: ['arugula'],                     purchaseUnit: 'bag',       gramsPerUnit: 142 },
  { keywords: ['mixed greens', 'spring mix', 'salad greens', 'mesclun'], purchaseUnit: 'bag', gramsPerUnit: 142 },
  { keywords: ['broccoli florets'],            purchaseUnit: 'bag',       gramsPerUnit: 340 },
  { keywords: ['broccoli'],                    purchaseUnit: 'head',      gramsPerUnit: 454 },
  { keywords: ['cauliflower florets'],         purchaseUnit: 'bag',       gramsPerUnit: 340 },
  { keywords: ['cauliflower'],                 purchaseUnit: 'head',      gramsPerUnit: 600 },
  { keywords: ['cabbage', 'red cabbage', 'napa cabbage'], purchaseUnit: 'head', gramsPerUnit: 900 },
  { keywords: ['romaine'],                     purchaseUnit: 'head',      gramsPerUnit: 283 },
  { keywords: ['lettuce', 'butter lettuce', 'iceberg'], purchaseUnit: 'head', gramsPerUnit: 300 },
  { keywords: ['kale', 'curly kale', 'lacinato kale'], purchaseUnit: 'bunch', gramsPerUnit: 200 },
  { keywords: ['bok choy', 'baby bok choy'],   purchaseUnit: 'head',      gramsPerUnit: 300 },
  { keywords: ['brussels sprouts'],            purchaseUnit: 'bag',       gramsPerUnit: 283 },
  { keywords: ['asparagus'],                   purchaseUnit: 'bunch',     gramsPerUnit: 340 },
  { keywords: ['celery'],                      purchaseUnit: 'bunch',     gramsPerUnit: 400 },
  { keywords: ['carrots', 'carrot'],           purchaseUnit: 'bag',       gramsPerUnit: 454 },
  { keywords: ['baby carrots'],                purchaseUnit: 'bag',       gramsPerUnit: 283 },
  { keywords: ['mushrooms', 'cremini', 'button mushroom'], purchaseUnit: 'container', gramsPerUnit: 227 },
  { keywords: ['snap pea', 'snow pea'],        purchaseUnit: 'bag',       gramsPerUnit: 170 },
  // Frozen packaged items
  { keywords: ['hashbrowns', 'hash browns', 'shredded potatoes'], purchaseUnit: 'bag', gramsPerUnit: 454 },
  { keywords: ['edamame'],                     purchaseUnit: 'bag',       gramsPerUnit: 340 },
];

function getProduceWeightDisplay(n: string, grams: number): string | null {
  for (const entry of PRODUCE_WEIGHT_TABLE) {
    if (entry.keywords.some((k) => n === k || n.includes(k) || k.includes(n.split(' ')[0]))) {
      const count = Math.max(1, Math.ceil(grams / entry.gramsPerUnit));
      const u = entry.purchaseUnit;
      if (u === 'bag' || u === 'bunch' || u === 'container') {
        // These don't multiply — you just grab another bag/bunch
        return count <= 1 ? `1 ${u}` : `${count} ${u}s`;
      }
      if (u === 'head') {
        return count <= 1 ? '1 head' : `${count} heads`;
      }
      // count/each: just the number
      return String(count);
    }
  }
  return null;
}

// ── Leafy greens → retail bag / bunch ─────────────────────────────────────────
const LEAFY_GREEN_MAP: Array<{ keywords: string[]; display: string }> = [
  { keywords: ['baby spinach', 'spinach'],           display: '1 bag' },
  { keywords: ['baby kale', 'kale'],                 display: '1 bunch' },
  { keywords: ['arugula', 'rocket'],                 display: '1 bag' },
  { keywords: ['mixed greens', 'spring mix', 'salad greens', 'mesclun'], display: '1 bag' },
  { keywords: ['romaine'],                           display: '1 head' },
  { keywords: ['bok choy'],                          display: '1 head' },
  { keywords: ['swiss chard', 'chard', 'rainbow chard'], display: '1 bunch' },
  { keywords: ['collard greens', 'collard'],         display: '1 bunch' },
  { keywords: ['watercress'],                        display: '1 bag' },
];

function getLeafyGreenDisplay(n: string, unit: string): string | null {
  // Only convert cup-measured amounts — if already whole (e.g. "1 head romaine"), pass through
  if (!isVolumeUnit(unit)) return null;
  for (const { keywords, display } of LEAFY_GREEN_MAP) {
    if (keywords.some(k => n === k || n.startsWith(k) || n.endsWith(k))) return display;
  }
  return null;
}

// ── Canned beans & legumes → retail can count ─────────────────────────────────
const CANNED_LEGUME_TERMS = [
  'chickpea', 'garbanzo', 'black bean', 'kidney bean', 'pinto bean',
  'cannellini', 'white bean', 'navy bean', 'great northern bean',
  'lentil', 'split pea',
];

function getCannedLegumeDisplay(n: string, qty: number, unit: string): string | null {
  const isLegume = CANNED_LEGUME_TERMS.some(t => n === t || n.includes(t));
  if (!isLegume) return null;
  // 1 can ≈ 1.5 cups cooked/drained
  if (isVolumeUnit(unit)) {
    const cups = toCups(qty, unit) ?? 0;
    const cans = Math.max(1, Math.ceil(cups / 1.5));
    return cans === 1 ? '1 can' : `${cans} cans`;
  }
  // Already in cans or unitless
  if (isUnitless(unit) && qty > 0) return qty <= 1 ? '1 can' : `${Math.ceil(qty)} cans`;
  return null;
}

// ── Aromatics: garlic → 1 bulb, ginger → 1 piece ─────────────────────────────
function getAromaticDisplay(n: string, unit: string): string | null {
  // Garlic: any cooking unit → buy a bulb
  // Exclude "garlic powder", "garlic salt" (those are Pantry spices)
  if ((n === 'garlic' || n === 'garlic clove' || n === 'garlic cloves' ||
       n === 'minced garlic' || n === 'chopped garlic' || n === 'fresh garlic') &&
      !n.includes('powder') && !n.includes('salt')) {
    if (isVolumeUnit(unit) || isUnitless(unit)) return '1 bulb';
  }
  // Ginger: any volume unit → buy a small piece/knob
  if ((n === 'ginger' || n === 'fresh ginger' || n === 'ginger root' ||
       n === 'minced ginger' || n === 'grated ginger') &&
      !n.includes('powder') && !n.includes('ground')) {
    if (isVolumeUnit(unit) || isUnitless(unit)) return '1 piece';
  }
  return null;
}

// ── Produce vegetables → retail units ─────────────────────────────────────────
const BAG_VEGETABLES = [
  'carrot', 'sugar snap pea', 'snap pea', 'snow pea',
  'green bean', 'string bean', 'haricot vert',
];

const HEAD_VEGETABLES = ['broccoli', 'cauliflower'];

// Whole-count vegetables: cup amount → round-up to 1 whole unit
// (1 cup chopped cucumber ≈ 1 cucumber, 1 cup cherry tomatoes → container)
function getProduceDisplay(n: string, qty: number, unit: string): string | null {
  if (isVolumeUnit(unit)) {
    const cups = toCups(qty, unit) ?? 0;

    // Cherry / grape tomatoes → containers
    if (n.includes('cherry tomato') || n.includes('grape tomato')) {
      return cups <= 2 ? '1 container' : '1–2 containers';
    }

    // Cucumber: 1 cup chopped ≈ 1 cucumber
    if (n === 'cucumber' || n.includes('cucumber')) {
      return String(Math.max(1, Math.ceil(cups)));
    }

    // Bell peppers: 1 cup chopped ≈ 1 pepper
    if (n.includes('pepper') && (
      n.includes('bell') || n.includes('red') || n.includes('green') ||
      n.includes('yellow') || n.includes('orange')
    )) {
      return String(Math.max(1, Math.ceil(cups)));
    }

    // Bag vegetables: any cup-measured amount → 1 bag
    for (const v of BAG_VEGETABLES) {
      if (n === v || n.includes(v)) return '1 bag';
    }

    // Head vegetables: scale by cup amount
    for (const v of HEAD_VEGETABLES) {
      if (n === v || n.includes(v)) {
        return cups <= 2 ? '1 head' : '1–2 heads';
      }
    }

    // Edamame (shelled or in pod)
    if (n.includes('edamame') && !n.includes('tofu')) return '1 bag';
  }

  // Bell peppers counted unitless
  if (isUnitless(unit) && qty > 0) {
    if (n.includes('pepper') && (
      n.includes('bell') || n.includes('red') || n.includes('green') ||
      n.includes('yellow') || n.includes('orange')
    )) {
      return String(Math.ceil(qty));
    }
    // Cherry tomatoes counted unitless
    if (n.includes('cherry tomato') || n.includes('grape tomato')) {
      return qty <= 1 ? '1 container' : '1–2 containers';
    }
  }

  return null;
}

// ── Fresh herbs → 1 bunch ──────────────────────────────────────────────────────
const FRESH_HERB_NAMES = [
  'cilantro', 'parsley', 'basil', 'mint', 'dill', 'chive', 'chives',
  'tarragon', 'lemongrass', 'green onion', 'scallion',
];

function getFreshHerbDisplay(n: string, unit: string): string | null {
  // Skip explicitly dried herbs — they're pantry staples
  if (n.startsWith('dried ') || n.startsWith('dry ')) return null;
  const isHerb = FRESH_HERB_NAMES.some(h => n === h || n.startsWith(h) || n.endsWith(h));
  if (!isHerb) return null;
  // Green onions / scallions are always sold by the bunch regardless of unit
  const isGreenOnion = n.includes('green onion') || n.includes('scallion');
  if (isGreenOnion) return '1 bunch';
  // Other herbs: convert volume recipe amounts to "1 bunch"
  if (isVolumeUnit(unit)) return '1 bunch';
  return null;
}

// ── Citrus → whole fruit count ─────────────────────────────────────────────────
// Range-based: lime = 2–3 tbsp/fruit, lemon = 3–4 tbsp/fruit
const CITRUS_TBSP_RANGE: Record<string, { min: number; max: number }> = {
  lime: { min: 2, max: 3 },
  lemon: { min: 3, max: 4 },
  orange: { min: 4, max: 6 },
  grapefruit: { min: 6, max: 8 },
};

function getCitrusDisplay(n: string, qty: number, unit: string): string | null {
  // Only apply when measured by volume (juice or zest amount)
  if (!isVolumeUnit(unit)) return null;
  const tbsp = toTbsp(qty, unit);
  if (tbsp === null || tbsp <= 0) return null;

  for (const [citrus, range] of Object.entries(CITRUS_TBSP_RANGE)) {
    if (n.includes(citrus)) {
      // round up on both ends, min 1 fruit
      const minFruits = Math.max(1, Math.ceil(tbsp / range.max));
      const maxFruits = Math.max(1, Math.ceil(tbsp / range.min));
      // Lemon gets a shopping buffer: never show just "1" — always at least "1–2"
      if (citrus === 'lemon' && minFruits === 1 && maxFruits === 1) return '1–2';
      if (minFruits === maxFruits) return `${minFruits}`;
      return `${minFruits}–${maxFruits}`;
    }
  }
  return null;
}

// ── Avocado → whole count ──────────────────────────────────────────────────────
function getAvocadoDisplay(n: string, qty: number, unit: string): string | null {
  if (!n.includes('avocado')) return null;
  if (isUnitless(unit)) {
    const whole = Math.max(1, Math.ceil(qty));
    return String(whole);
  }
  // Volume (e.g. ½ cup mashed) → ~0.5 cup per avocado
  const cups = toCups(qty, unit);
  if (cups !== null && cups > 0) {
    return String(Math.max(1, Math.ceil(cups / 0.5)));
  }
  return null;
}

// ── Coconut milk → cans ────────────────────────────────────────────────────────
function getCoconutMilkDisplay(n: string, qty: number, unit: string): string | null {
  if (n !== 'coconut milk' && n !== 'canned coconut milk' && n !== 'full-fat coconut milk') return null;
  const cups = toCups(qty, unit);
  if (cups === null || cups <= 0) return null;
  return cups <= 1.5 ? '1 can' : '2 cans';
}

// ── Regular milk → tiered purchase sizes ──────────────────────────────────────
const NON_DAIRY_PREFIXES = ['almond', 'oat', 'soy', 'cashew', 'pea', 'rice', 'hemp', 'flax', 'coconut'];

function getMilkDisplay(n: string, qty: number, unit: string): string | null {
  if (!n.includes('milk')) return null;
  if (NON_DAIRY_PREFIXES.some(p => n.includes(p))) return null;
  const cups = toCups(qty, unit);
  if (cups === null || cups <= 0) return null;
  if (cups <= 2) return '1 pint';
  if (cups <= 4) return '1 quart';
  if (cups <= 8) return '½ gallon';
  return '1 gallon';
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
  'nutritional yeast', 'nooch',
]);

// ── Tier 2: Conditional — hide if small, show purchase unit if large ───────────
type Tier2Config = { thresholdMl: number; purchaseUnit: string };

const TIER_2_CONDITIONAL: Record<string, Tier2Config> = {
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
  'honey': { thresholdMl: 59, purchaseUnit: 'jar' },
  'maple syrup': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'pure maple syrup': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'agave': { thresholdMl: 59, purchaseUnit: 'bottle' },
  'agave nectar': { thresholdMl: 59, purchaseUnit: 'bottle' },
};

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Returns the quantity string to display for a shopping list item.
 * - null   → hide the quantity entirely
 * - string → show this string as the quantity
 */
export function getRetailQuantity(item: ShoppingListItem): string | null {
  const n = norm(item.name);
  const unit = (item.unit || '').toLowerCase().trim();
  const qty = item.quantity || 0;

  // ── Plant proteins (before meat — tempeh bacon has "bacon" in the name) ───
  const plantDisplay = getPlantProteinDisplay(n);
  if (plantDisplay) return plantDisplay;

  // ── Eggs ──────────────────────────────────────────────────────────────────
  const isEgg = (n === 'egg' || n === 'eggs' || n === 'egg white' || n === 'egg yolk')
    && !n.includes('eggplant');
  if (isEgg && isUnitless(unit) && qty > 0) {
    return eggsToDozen(qty);
  }

  // ── Meat & fish (weight-based or count-based for fillets) ─────────────────
  if (isMeatItem(n)) {
    const lbs = toLbs(qty, unit);
    if (lbs !== null && lbs > 0) {
      return roundMeatLbs(lbs);
    }
    // Fish fillets sold by count → estimate weight from fillet size
    if (isUnitless(unit) && qty > 0) {
      const lbPerFillet = getFishFilletLbPerUnit(n);
      if (lbPerFillet !== null) {
        return roundMeatLbs(qty * lbPerFillet);
      }
    }
  }

  // ── Bread → loaf ──────────────────────────────────────────────────────────
  const breadDisplay = getBreadDisplay(n, unit);
  if (breadDisplay) return breadDisplay;

  // ── Grains / pasta / oats (volume → lbs) ─────────────────────────────────
  const density = getGrainDensity(n);
  if (density !== null) {
    const cups = toCups(qty, unit);
    if (cups !== null && cups > 0) {
      return grainCupsToLbs(cups, density);
    }
    const lbs = toLbs(qty, unit);
    if (lbs !== null && lbs > 0) {
      const rounded = Math.max(0.5, Math.ceil(lbs * 2) / 2);
      return `${rounded} lb`;
    }
  }

  // ── Container items: seeds, tahini in cooking amounts → retail container ──
  const containerDisplay = getContainerDisplay(n, unit);
  if (containerDisplay) return containerDisplay;

  // ── Canned legumes: chickpeas, beans, lentils → retail can count ──────────
  const cannedLegumeDisplay = getCannedLegumeDisplay(n, qty, unit);
  if (cannedLegumeDisplay) return cannedLegumeDisplay;

  // ── Aromatics: garlic → bulb, ginger → piece ─────────────────────────────
  const aromaticDisplay = getAromaticDisplay(n, unit);
  if (aromaticDisplay) return aromaticDisplay;

  // ── Fresh herbs → 1 bunch ─────────────────────────────────────────────────
  const herbDisplay = getFreshHerbDisplay(n, unit);
  if (herbDisplay) return herbDisplay;

  // ── Leafy greens (cup-measured) → retail bag / bunch ─────────────────────
  const leafyDisplay = getLeafyGreenDisplay(n, unit);
  if (leafyDisplay) return leafyDisplay;

  // ── Citrus → whole fruit count ────────────────────────────────────────────
  const citrusDisplay = getCitrusDisplay(n, qty, unit);
  if (citrusDisplay) return citrusDisplay;

  // ── Produce vegetables → retail counts / bags / heads ────────────────────
  const produceDisplay = getProduceDisplay(n, qty, unit);
  if (produceDisplay) return produceDisplay;

  // ── Avocado → whole count ─────────────────────────────────────────────────
  const avocadoDisplay = getAvocadoDisplay(n, qty, unit);
  if (avocadoDisplay) return avocadoDisplay;

  // ── Coconut milk → cans ───────────────────────────────────────────────────
  const coconutMilkDisplay = getCoconutMilkDisplay(n, qty, unit);
  if (coconutMilkDisplay) return coconutMilkDisplay;

  // ── Regular milk → tiered purchase size ───────────────────────────────────
  const milkDisplay = getMilkDisplay(n, qty, unit);
  if (milkDisplay) return milkDisplay;

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
    return null;
  }

  // ── Produce weight (g) → count/bag/bunch/head ─────────────────────────────
  // Items stored in grams from the nutrition engine (e.g. "43 g spinach",
  // "71 g zucchini"). The weight table converts to human shopping units.
  const grams = toG(qty, unit);
  if (grams !== null && grams > 0) {
    const weightDisplay = getProduceWeightDisplay(n, grams);
    if (weightDisplay) return weightDisplay;
  }
  // Also handle mL-stored produce (nutrition engine sometimes uses mL for
  // volume of leafy greens, hashbrowns, etc.)
  const mlAsGrams = unit.toLowerCase() === 'ml' || unit.toLowerCase() === 'milliliter' || unit.toLowerCase() === 'milliliters'
    ? qty  // ~1 g/mL approximation for plant matter
    : null;
  if (mlAsGrams !== null && mlAsGrams > 0) {
    const weightDisplay = getProduceWeightDisplay(n, mlAsGrams);
    if (weightDisplay) return weightDisplay;
  }

  // ── Category-based fallbacks ──────────────────────────────────────────────
  // When no specific rule matched, use the item's category to pick a sane
  // default rather than showing raw nutrition units.
  const cat = item.category;
  if (cat === 'Frozen') return '1 bag';
  if (cat === 'Bakery') {
    if (n.includes('tortilla') || n.includes('wrap') || n.includes('pita')) return '1 pack';
    if (n.includes('roll') || n.includes('bun') || n.includes('muffin')) return '1 pack';
    return '1 loaf';
  }
  if (cat === 'Produce') {
    // Unknown produce not in the weight table — default to 1
    return '1';
  }
  if (cat === 'Grains & Packaged') {
    // Unknown grains/packaged items not caught by grain density table
    if (n.includes('can') || n.includes('bean') || n.includes('lentil') || n.includes('chickpea')) return '1 can';
    return '1 bag';
  }
  if (cat === 'Pantry') {
    // Unknown pantry items not caught by tier1/tier2
    if (n.includes('can') || n.includes('bean') || n.includes('tomato') || n.includes('broth')) return '1 can';
    if (n.includes('nut') || n.includes('seed') || n.includes('dried')) return '1 bag';
    return null; // pantry staples: show name only
  }

  // No recognized retail unit — show name only, no confusing raw numbers
  return null;
}
