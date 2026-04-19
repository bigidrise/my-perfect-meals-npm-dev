import type { Category } from './types';

const NON_DAIRY_MILK_RE = /\b(almond|oat|soy|coconut|cashew|pea)[\s-]*milk\b/;
const NON_DAIRY_BUTTER_RE = /\b(peanut|almond|cashew|sunflower|apple|pumpkin)[\s-]*butter\b/;

const DICT: Array<{k:RegExp,c:Category}> = [
  {k:/(tomato|lettuce|spinach|onion|garlic|pepper|broccoli|carrot|avocado|cilantro|parsley|banana|apple)/,c:'Produce'},
  {k:/(chicken|beef|pork|turkey|salmon|tuna|shrimp|egg|eggs|sausage)/,c:'Protein'},
  {k:/(rice|pasta|noodle|flour|sugar|salt|spice|oil|vinegar|canned|bean|beans|lentil|broth|stock|tomato paste|black beans|kidney beans)/,c:'Pantry'},
  {k:/(milk|cheese|yogurt|butter|cream|ghee|egg|eggs)/,c:'Dairy & Eggs'},
  {k:/\bhalf[\s&-]+and[\s&-]+half\b|half[\s-]*&[\s-]*half/,c:'Dairy & Eggs'},
  {k:/(frozen|peas|corn|berries)/,c:'Frozen'},
];

export function categorize(name: string): Category {
  const n = name.toLowerCase();
  if (NON_DAIRY_MILK_RE.test(n)) return 'Pantry';
  if (NON_DAIRY_BUTTER_RE.test(n)) return 'Pantry';
  for (const { k, c } of DICT) { if (k.test(n)) return c; }
  return 'Other';
}