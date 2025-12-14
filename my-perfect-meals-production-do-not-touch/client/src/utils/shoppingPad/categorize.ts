import type { Category } from './types';
const DICT: Array<{k:RegExp,c:Category}> = [
  {k:/(tomato|lettuce|spinach|onion|garlic|pepper|broccoli|carrot|avocado|cilantro|parsley|banana|apple)/,c:'Produce'},
  {k:/(chicken|beef|pork|turkey|salmon|tuna|shrimp|egg|eggs|sausage)/,c:'Protein'},
  {k:/(rice|pasta|noodle|flour|sugar|salt|spice|oil|vinegar|canned|bean|beans|lentil|broth|stock|tomato paste|black beans|kidney beans)/,c:'Pantry'},
  {k:/(milk|cheese|yogurt|butter|cream)/,c:'Dairy'},
  {k:/(frozen|peas|corn|berries)/,c:'Frozen'},
];
export function categorize(name: string): Category{
  const n=name.toLowerCase(); for(const {k,c} of DICT){ if(k.test(n)) return c; } return 'Other';
}