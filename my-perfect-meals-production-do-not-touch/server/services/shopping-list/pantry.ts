// server/services/shopping-list/pantry.ts
export const PANTRY_KEYWORDS = [
  // salts, peppers, oils, common spices
  'salt', 'sea salt', 'kosher salt', 'black pepper', 'pepper',
  'olive oil', 'avocado oil', 'cooking spray', 'vegetable oil',
  'garlic powder', 'onion powder', 'paprika', 'chili powder',
  'cumin', 'oregano', 'basil', 'italian seasoning', 'cinnamon',
  'ginger', 'turmeric', 'curry powder', 'red pepper flakes',
  'soy sauce', 'hot sauce', 'vinegar', 'balsamic vinegar', 'apple cider vinegar',
  'mustard', 'ketchup', 'mayonnaise',
  'salt & pepper',
];

export function isPantryItem(name: string): boolean {
  const n = name.trim().toLowerCase();
  return PANTRY_KEYWORDS.some(k => n.includes(k));
}
