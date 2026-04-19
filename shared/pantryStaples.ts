/**
 * Unified pantry staples list — single source of truth for both client and server.
 * Items here are displayed WITHOUT quantity on the grocery list.
 * Underlying data (quantity, unit) is preserved for future delivery integrations.
 *
 * Rule: if a normal household almost certainly already owns it in a container,
 * it's a pantry staple. Quantity is irrelevant — you use what you have or grab any size.
 */
export const SHARED_PANTRY_STAPLES: string[] = [
  // ── Salts ──────────────────────────────────────────────────────────────────
  'salt', 'sea salt', 'kosher salt', 'table salt', 'himalayan salt', 'pink salt',
  'fleur de sel', 'celtic salt', 'salt & pepper', 'salt and pepper',

  // ── Dry peppers & heat ─────────────────────────────────────────────────────
  'black pepper', 'white pepper', 'pepper', 'cayenne', 'cayenne pepper',
  'red pepper flakes', 'red pepper flake', 'chili flakes', 'crushed red pepper',

  // ── Spices ─────────────────────────────────────────────────────────────────
  'garlic powder', 'onion powder', 'paprika', 'smoked paprika', 'sweet paprika',
  'chili powder', 'cumin', 'turmeric', 'curry powder', 'garam masala',
  'ginger powder', 'ground ginger', 'cinnamon', 'nutmeg', 'allspice',
  'clove', 'cloves', 'cardamom', 'coriander', 'ground coriander',
  'fennel seed', 'fennel seeds', 'mustard powder', 'dry mustard',
  'celery salt', 'seasoning salt', 'lemon pepper', 'old bay',
  'everything bagel seasoning', "za'atar", 'five spice', 'chinese five spice',
  'harissa powder', 'sumac', 'za\'atar',

  // ── Dried herbs ────────────────────────────────────────────────────────────
  'oregano', 'dried oregano', 'thyme', 'dried thyme', 'basil', 'dried basil',
  'italian seasoning', 'bay leaf', 'bay leaves', 'rosemary', 'dried rosemary',
  'sage', 'dried sage', 'dill', 'dill weed', 'dried dill', 'marjoram',
  'tarragon', 'herbs de provence', 'mixed herbs', 'parsley flakes',
  'dried parsley', 'dried cilantro', 'dried chives', 'herbes de provence',

  // ── Cooking oils & fats ────────────────────────────────────────────────────
  'olive oil', 'extra virgin olive oil', 'evoo',
  'vegetable oil', 'canola oil', 'sunflower oil', 'safflower oil',
  'coconut oil', 'sesame oil', 'toasted sesame oil',
  'avocado oil', 'grapeseed oil', 'peanut oil',
  'cooking spray', 'nonstick spray', 'pam',

  // ── Vinegars ───────────────────────────────────────────────────────────────
  'vinegar', 'white vinegar', 'distilled vinegar', 'distilled white vinegar',
  'apple cider vinegar', 'balsamic vinegar', 'balsamic',
  'red wine vinegar', 'white wine vinegar', 'rice vinegar', 'rice wine vinegar',
  'sherry vinegar', 'champagne vinegar', 'malt vinegar',

  // ── Sweeteners ─────────────────────────────────────────────────────────────
  'sugar', 'white sugar', 'granulated sugar', 'cane sugar',
  'brown sugar', 'dark brown sugar', 'light brown sugar',
  'powdered sugar', 'confectioners sugar', "confectioner's sugar",
  'honey', 'maple syrup', 'pure maple syrup',
  'agave', 'agave nectar', 'agave syrup',
  'stevia', 'sweetener', 'artificial sweetener',
  'corn syrup', 'light corn syrup',

  // ── Condiments & sauces ────────────────────────────────────────────────────
  'ketchup', 'catsup',
  'mustard', 'dijon mustard', 'yellow mustard', 'whole grain mustard',
  'mayonnaise', 'mayo', 'light mayo',
  'hot sauce', 'sriracha', 'tabasco', 'franks red hot',
  'chili sauce', 'sweet chili sauce',
  'soy sauce', 'tamari', 'low sodium soy sauce', 'coconut aminos',
  'fish sauce', 'worcestershire', 'worcestershire sauce',
  'hoisin sauce', 'oyster sauce', 'teriyaki sauce',
  'bbq sauce', 'barbecue sauce',
  'relish', 'sweet relish', 'dill relish',

  // ── Baking staples ─────────────────────────────────────────────────────────
  'baking powder', 'baking soda', 'bicarbonate of soda',
  'cornstarch', 'corn starch', 'arrowroot',
  'cream of tartar',
  'vanilla', 'vanilla extract', 'pure vanilla extract',
  'almond extract', 'peppermint extract',
  'cocoa powder', 'cocoa', 'unsweetened cocoa', 'dutch process cocoa',
];
