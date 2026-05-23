/**
 * groceryShoppingUnit.ts
 *
 * Converts nutrition-math quantities (grams, mL) into human-readable
 * grocery shopping language.
 *
 * Internal system: "43 g spinach", "480 mL hashbrowns", "397 g chicken"
 * Shopping output: "1 bag",        "1 bag",             "1 lb"
 *
 * Two systems, two different jobs:
 *   - Nutrition system: precision (grams, mL) — keep as-is internally
 *   - Shopping system:  approximation (bags, cans, lb) — this file
 */

import type { IngredientCategory } from '@/data/ingredientCategories';

// ── Produce: sold by count (grab one or two) ─────────────────────────────────
const COUNT_PRODUCE = new Set([
  'avocado', 'avocados',
  'lemon', 'lemons', 'lime', 'limes',
  'orange', 'oranges', 'grapefruit', 'tangerine',
  'apple', 'apples', 'pear', 'pears',
  'banana', 'bananas',
  'mango', 'mangos', 'mangoes',
  'peach', 'peaches', 'plum', 'plums', 'nectarine', 'nectarines',
  'kiwi', 'kiwis', 'pomegranate',
  'onion', 'onions', 'red onion', 'yellow onion', 'white onion',
  'shallot', 'shallots',
  'garlic',
  'potato', 'potatoes', 'russet potato', 'gold potato', 'yukon gold',
  'sweet potato', 'sweet potatoes', 'yam', 'yams',
  'beet', 'beets', 'turnip', 'turnips', 'parsnip', 'parsnips',
  'zucchini', 'zucchinis', 'squash', 'butternut squash', 'acorn squash',
  'cucumber', 'cucumbers',
  'bell pepper', 'bell peppers',
  'jalapeño', 'jalapeños', 'jalapeno', 'jalapenos',
  'habanero', 'serrano', 'poblano', 'chili pepper',
  'tomato', 'roma tomato', 'roma tomatoes', 'beefsteak tomato',
  'eggplant', 'artichoke', 'artichokes',
  'ear of corn', 'corn cob',
  'fennel', 'fennel bulb',
  'head of garlic',
  'head of cabbage', 'head of lettuce', 'head of cauliflower', 'head of broccoli',
]);

// ── Produce: sold by bunch ────────────────────────────────────────────────────
const BUNCH_PRODUCE = new Set([
  'parsley', 'fresh parsley', 'flat leaf parsley', 'curly parsley',
  'cilantro', 'fresh cilantro',
  'basil', 'fresh basil',
  'mint', 'fresh mint',
  'dill', 'fresh dill',
  'thyme', 'fresh thyme',
  'rosemary', 'fresh rosemary',
  'sage', 'fresh sage',
  'tarragon', 'chive', 'chives',
  'kale', 'curly kale', 'lacinato kale', 'dinosaur kale',
  'swiss chard', 'rainbow chard', 'chard',
  'collard greens', 'mustard greens', 'beet greens', 'turnip greens',
  'green onion', 'green onions', 'scallion', 'scallions',
  'asparagus',
  'broccoli rabe', 'broccolini', 'broccolette',
  'celery',
  'leek', 'leeks',
  'radish', 'radishes',
  'watercress', 'endive', 'radicchio',
  'bok choy', 'baby bok choy',
]);

// ── Produce: sold by bag / clamshell ─────────────────────────────────────────
const BAG_PRODUCE = new Set([
  'spinach', 'baby spinach',
  'arugula', 'mixed greens', 'salad greens', 'spring mix', 'mesclun',
  'romaine', 'romaine lettuce',
  'lettuce', 'butter lettuce', 'iceberg lettuce',
  'microgreens',
  'broccoli', 'broccoli florets',
  'cauliflower', 'cauliflower florets', 'cauliflower rice',
  'cabbage', 'red cabbage', 'green cabbage', 'napa cabbage', 'shredded cabbage',
  'brussels sprouts',
  'carrots', 'baby carrots', 'shredded carrots',
  'snap peas', 'sugar snap peas', 'snow peas',
  'hashbrowns', 'hash browns', 'shredded potatoes',
  'frozen peas', 'frozen corn', 'frozen broccoli', 'frozen spinach',
  'frozen edamame', 'edamame',
  'bean sprouts',
]);

// ── Produce: sold by container / pint ─────────────────────────────────────────
const CONTAINER_PRODUCE = new Set([
  'cherry tomatoes', 'grape tomatoes',
  'strawberries', 'blueberries', 'raspberries', 'blackberries',
  'mushrooms', 'cremini mushrooms', 'button mushrooms', 'shiitake mushrooms',
  'sliced mushrooms',
  'mixed berries',
]);

// ── Pantry: sold by can ───────────────────────────────────────────────────────
const CAN_PANTRY = new Set([
  'black beans', 'pinto beans', 'kidney beans', 'navy beans',
  'cannellini beans', 'great northern beans', 'white beans',
  'chickpeas', 'garbanzo beans', 'garbanzo',
  'black-eyed peas', 'black eyed peas',
  'lentils',
  'diced tomatoes', 'crushed tomatoes', 'whole tomatoes', 'fire roasted tomatoes',
  'tomato paste', 'tomato sauce', 'tomato puree',
  'coconut milk', 'coconut cream', 'lite coconut milk',
  'tuna', 'canned tuna', 'albacore tuna',
  'salmon', 'canned salmon',
  'sardines', 'anchovies',
  'corn', 'canned corn', 'cream style corn',
  'canned green beans', 'canned peas',
  'artichoke hearts',
  'olives', 'black olives', 'kalamata olives',
  'roasted red peppers',
  'pumpkin puree', 'pumpkin',
  'chicken broth', 'beef broth', 'vegetable broth', 'broth', 'stock',
  'bone broth',
]);

// ── Pantry: sold by carton (liquids) ─────────────────────────────────────────
const CARTON_PANTRY = new Set([
  'almond milk', 'oat milk', 'soy milk', 'coconut milk beverage',
  'rice milk', 'cashew milk', 'pea milk',
  'chicken stock', 'beef stock', 'vegetable stock',
]);

// ── Dairy helpers ─────────────────────────────────────────────────────────────
function toShoppingUnitDairy(name: string, quantity: number): string {
  const n = name.toLowerCase();

  if (n.includes('egg white')) return '1 carton';
  if (n.includes('egg')) {
    const count = Math.max(1, Math.round(quantity));
    return count <= 8 ? '1 dozen' : `${Math.ceil(count / 12)} dozen`;
  }
  if (n.includes('milk') || n.includes('half and half')) return '1 carton';
  if (n.includes('heavy cream') || n.includes('whipping cream')) return '1 pint';
  if (n.includes('butter') || n.includes('ghee')) return '1 stick';
  if (
    n.includes('yogurt') || n.includes('sour cream') ||
    n.includes('cottage cheese') || n.includes('ricotta') ||
    n.includes('creme fraiche')
  ) return '1 container';
  if (
    n.includes('cream cheese') || n.includes('mascarpone') ||
    n.includes('goat cheese')
  ) return '1 package';
  if (
    n.includes('parmesan') || n.includes('cheddar') || n.includes('mozzarella') ||
    n.includes('swiss') || n.includes('provolone') || n.includes('gouda') ||
    n.includes('feta') || n.includes('brie') || n.includes('blue cheese') ||
    n.includes('cheese')
  ) return '1 package';
  if (n.includes('ice cream') || n.includes('gelato')) return '1 pint';

  return '1 container';
}

// ── Meat: grams → lb/oz ───────────────────────────────────────────────────────
function gramsToShoppingWeight(grams: number): string {
  const oz = grams / 28.35;
  if (oz < 6) return '¼ lb';
  if (oz < 10) return '½ lb';
  if (oz < 20) return '1 lb';
  if (oz < 28) return '1½ lb';
  if (oz < 36) return '2 lb';
  return `${Math.round(oz / 16)} lb`;
}

function toShoppingUnitMeat(name: string, quantity: number, unit: string): string {
  const u = unit.toLowerCase().trim();
  let grams = quantity;
  if (u === 'oz') grams = quantity * 28.35;
  else if (u === 'lb' || u === 'lbs') grams = quantity * 453.6;
  else if (u === 'cup' || u === 'cups') grams = quantity * 240;
  // mL treated as grams (close enough for meat)
  if (grams < 1) return '1 lb';
  return gramsToShoppingWeight(grams);
}

// ── Grains & Packaged ─────────────────────────────────────────────────────────
function toShoppingUnitGrains(name: string): string {
  const n = name.toLowerCase();
  if (CAN_PANTRY.has(n)) return '1 can';
  if (n.includes('bean') || n.includes('lentil') || n.includes('chickpea') || n.includes('pea')) return '1 can';
  if (n.includes('pasta') || n.includes('spaghetti') || n.includes('penne') ||
      n.includes('linguine') || n.includes('fettuccine') || n.includes('noodle')) return '1 box';
  if (n.includes('tortilla') || n.includes('wrap')) return '1 pack';
  if (n.includes('flour')) return '1 bag';
  if (n.includes('oat') || n.includes('oatmeal') || n.includes('granola')) return '1 container';
  if (n.includes('cereal')) return '1 box';
  if (n.includes('bread')) return '1 loaf';
  // rice, quinoa, couscous, bulgur, farro, etc.
  return '1 bag';
}

// ── Pantry ────────────────────────────────────────────────────────────────────
function toShoppingUnitPantry(name: string): string {
  const n = name.toLowerCase();
  if (CAN_PANTRY.has(n)) return '1 can';
  if (CARTON_PANTRY.has(n)) return '1 carton';
  if (n.includes('almond milk') || n.includes('oat milk') || n.includes('soy milk')) return '1 carton';
  if (n.includes('coconut milk') || n.includes('coconut cream')) return '1 can';
  if (n.includes('peanut butter') || n.includes('almond butter') ||
      n.includes('nut butter') || n.includes('tahini')) return '1 jar';
  if (n.includes('salsa') || n.includes('pesto') || n.includes('hummus')) return '1 jar';
  if (n.includes('nut') || n.includes('almond') || n.includes('walnut') ||
      n.includes('pecan') || n.includes('cashew') || n.includes('pistachio')) return '1 bag';
  if (n.includes('seed') || n.includes('chia') || n.includes('flax') ||
      n.includes('hemp') || n.includes('sunflower') || n.includes('pumpkin seed')) return '1 bag';
  if (n.includes('dried fruit') || n.includes('raisin') || n.includes('cranberry') ||
      n.includes('date') || n.includes('apricot')) return '1 bag';
  if (n.includes('tomato paste') || n.includes('tomato sauce') ||
      n.includes('diced tomato') || n.includes('crushed tomato')) return '1 can';
  if (n.includes('broth') || n.includes('stock')) return '1 carton';
  if (n.includes('chocolate') || n.includes('cocoa')) return '1 package';
  if (n.includes('protein powder') || n.includes('whey') || n.includes('collagen')) return '1 container';
  // oils, vinegars, condiments, spices — show name only
  return null as unknown as string;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns a human-friendly shopping unit string (e.g. "1 bag", "1 lb", "1 can")
 * or null if quantity/unit should not be shown (spices, oils, condiments).
 *
 * This is ONLY for display in shopping/export contexts.
 * The internal quantity/unit fields remain unchanged for nutrition math.
 */
export function toShoppingUnit(
  name: string,
  quantity: number | null | undefined,
  unit: string | null | undefined,
  category: IngredientCategory | null | undefined,
): string | null {
  const n = name.trim().toLowerCase();
  const u = (unit ?? '').toLowerCase().trim();
  const q = quantity ?? 0;

  // ── Spices / pantry staples — no quantity shown ───────────────────────────
  // Pantry items that are oils, spices, vinegars, condiments
  const isPantryNoQty =
    category === 'Pantry' &&
    (
      u === 'tsp' || u === 'tbsp' || u === 'teaspoon' || u === 'tablespoon' ||
      u === 'ml' || u === 'milliliter' || u === 'milliliters' ||
      n.includes('oil') || n.includes('vinegar') || n.includes('sauce') ||
      n.includes('powder') || n.includes('pepper') || n.includes('salt') ||
      n.includes('seasoning') || n.includes('spice') || n.includes('extract') ||
      n.includes('syrup') && !n.includes('maple syrup')
    );

  if (isPantryNoQty) return null;

  // ── Meat ──────────────────────────────────────────────────────────────────
  if (category === 'Meat') {
    return toShoppingUnitMeat(n, q, u);
  }

  // ── Produce ───────────────────────────────────────────────────────────────
  if (category === 'Produce') {
    if (CONTAINER_PRODUCE.has(n)) return '1 container';
    if (BUNCH_PRODUCE.has(n)) return '1 bunch';
    if (BAG_PRODUCE.has(n)) return '1 bag';
    if (COUNT_PRODUCE.has(n)) return '1';
    // Unknown produce: default to 1 (they'll figure it out at the store)
    return '1';
  }

  // ── Dairy & Eggs ─────────────────────────────────────────────────────────
  if (category === 'Dairy & Eggs') {
    return toShoppingUnitDairy(n, q);
  }

  // ── Grains & Packaged ─────────────────────────────────────────────────────
  if (category === 'Grains & Packaged') {
    return toShoppingUnitGrains(n);
  }

  // ── Pantry ────────────────────────────────────────────────────────────────
  if (category === 'Pantry') {
    const result = toShoppingUnitPantry(n);
    if (result) return result;
    return null; // spices, oils, condiments — name only
  }

  // ── Plant Proteins ────────────────────────────────────────────────────────
  if (category === 'Plant Proteins') {
    if (n.includes('tofu') || n.includes('tempeh')) return '1 package';
    if (n.includes('edamame')) return '1 bag';
    if (n.includes('seitan')) return '1 package';
    return '1 package';
  }

  // ── Frozen ────────────────────────────────────────────────────────────────
  if (category === 'Frozen') return '1 bag';

  // ── Bakery ────────────────────────────────────────────────────────────────
  if (category === 'Bakery') {
    if (n.includes('tortilla') || n.includes('wrap') || n.includes('pita')) return '1 pack';
    if (n.includes('bread') || n.includes('loaf') || n.includes('baguette') ||
        n.includes('sourdough') || n.includes('bagel')) return '1 loaf';
    if (n.includes('roll') || n.includes('bun') || n.includes('muffin')) return '1 pack';
    return '1';
  }

  // ── Other / unknown ───────────────────────────────────────────────────────
  // If the stored unit is already human (cup, tbsp, oz, lb), show it simply
  if (['oz', 'lb', 'lbs'].includes(u) && q > 0) {
    if (u === 'oz') return `${Math.round(q)} oz`;
    if (u === 'lb' || u === 'lbs') return `${q} lb`;
  }
  if (['cup', 'cups'].includes(u) && q > 0) {
    return q === 1 ? '1 cup' : `${q} cups`;
  }

  return null;
}
