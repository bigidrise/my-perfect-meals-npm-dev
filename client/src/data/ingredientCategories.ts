import { SHARED_PANTRY_STAPLES } from '@shared/pantryStaples';

export type IngredientCategory = 'Produce' | 'Meat' | 'Plant Proteins' | 'Dairy & Eggs' | 'Pantry' | 'Frozen' | 'Bakery' | 'Other';

export const PLANT_PROTEIN_KEYWORDS: string[] = [
  'tofu', 'extra firm tofu', 'firm tofu', 'silken tofu', 'soft tofu',
  'tempeh', 'seitan', 'edamame',
  'nutritional yeast', 'nooch',
  'tvp', 'textured vegetable protein',
  'jackfruit', 'young jackfruit',
  'beyond meat', 'impossible burger', 'impossible meat',
  'veggie burger', 'veggie patty', 'black bean burger', 'lentil burger',
  'meatless', 'plant-based protein', 'plant based protein',
  'pea protein', 'soy protein',
];

export const MEAT_KEYWORDS: string[] = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham',
  'steak', 'ground beef', 'ground turkey', 'ground pork', 'ground chicken',
  'chicken breast', 'chicken thigh', 'chicken wing', 'chicken drumstick',
  'ribeye', 'sirloin', 'tenderloin', 'brisket', 'roast', 'chop',
  'pork chop', 'lamb chop', 'veal', 'duck', 'goose', 'venison', 'bison',
  'prosciutto', 'salami', 'pepperoni', 'chorizo', 'bratwurst', 'hot dog',
  'meatball', 'meat', 'poultry', 'deli meat', 'lunch meat',
  'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'mahi', 'trout', 'bass',
  'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster',
  'fish', 'seafood', 'anchovy', 'sardine', 'mackerel', 'catfish', 'snapper'
];

export const PRODUCE_KEYWORDS: string[] = [
  'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit', 'tangerine',
  'strawberry', 'blueberry', 'raspberry', 'blackberry', 'grape', 'cherry',
  'peach', 'plum', 'pear', 'mango', 'pineapple', 'watermelon', 'cantaloupe',
  'honeydew', 'kiwi', 'papaya', 'coconut', 'avocado', 'tomato', 'tomatoes',
  'lettuce', 'spinach', 'kale', 'arugula', 'romaine', 'cabbage', 'chard',
  'collard', 'mustard green', 'bok choy', 'watercress',
  'broccoli', 'cauliflower', 'brussels sprout', 'asparagus', 'artichoke',
  'carrot', 'celery', 'cucumber', 'zucchini', 'squash', 'eggplant',
  'bell pepper', 'jalapeno', 'habanero', 'serrano', 'poblano',
  'onion', 'garlic', 'shallot', 'leek', 'scallion', 'green onion', 'chive',
  'potato', 'sweet potato', 'yam', 'beet', 'turnip', 'parsnip', 'radish',
  'mushroom', 'corn', 'pea', 'green bean', 'snap pea', 'snow pea',
  'bean sprout', 'sprout', 'microgreen',
  'herb', 'basil', 'cilantro', 'parsley', 'mint', 'dill', 'thyme',
  'rosemary', 'sage', 'oregano', 'ginger', 'lemongrass', 'fennel',
  'endive', 'radicchio',
  'berries', 'fruit', 'vegetable', 'veggie', 'salad', 'greens', 'fresh'
];

export const DAIRY_KEYWORDS: string[] = [
  'milk', 'cream', 'half and half', 'heavy cream', 'whipping cream',
  'butter', 'margarine', 'ghee',
  'cheese', 'cheddar', 'mozzarella', 'parmesan', 'swiss', 'provolone',
  'brie', 'camembert', 'gouda', 'feta', 'goat cheese', 'blue cheese',
  'ricotta', 'cottage cheese', 'cream cheese', 'mascarpone',
  'yogurt', 'greek yogurt', 'sour cream', 'creme fraiche',
  'egg', 'eggs', 'egg white', 'egg yolk',
  'ice cream', 'gelato', 'frozen yogurt',
  'whey', 'casein', 'lactose'
];

export const FROZEN_KEYWORDS: string[] = [
  'frozen', 'ice', 'popsicle', 'frozen vegetable', 'frozen fruit',
  'frozen pizza', 'frozen dinner', 'frozen meal', 'frozen fish',
  'frozen shrimp', 'frozen chicken', 'frozen beef',
  'ice cream', 'gelato', 'sorbet', 'frozen yogurt'
];

export const BAKERY_KEYWORDS: string[] = [
  'bread', 'loaf', 'baguette', 'ciabatta', 'sourdough', 'rye bread',
  'whole wheat bread', 'white bread', 'multigrain bread',
  'roll', 'bun', 'bagel', 'english muffin', 'croissant', 'danish',
  'muffin', 'scone', 'biscuit', 'cornbread',
  'tortilla', 'pita', 'naan', 'flatbread', 'wrap',
  'cake', 'cupcake', 'pie', 'tart', 'pastry', 'donut', 'doughnut',
  'cookie', 'brownie', 'cracker'
];

export const PANTRY_KEYWORDS: string[] = [
  ...SHARED_PANTRY_STAPLES,
  // Packaged goods — go in Pantry category but NOT staples (quantity matters)
  'rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'wild rice',
  'pasta', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'linguine', 'orzo',
  'noodle', 'ramen', 'udon', 'rice noodle', 'egg noodle',
  'quinoa', 'couscous', 'bulgur', 'farro', 'barley', 'oat', 'oatmeal', 'grain',
  'flour', 'all-purpose flour', 'bread flour', 'whole wheat flour', 'almond flour',
  'bean', 'black bean', 'kidney bean', 'pinto bean', 'cannellini', 'chickpea',
  'lentil', 'split pea',
  'nut', 'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'hazelnut',
  'seed', 'sunflower seed', 'pumpkin seed', 'chia seed', 'flax seed', 'sesame seed',
  'peanut butter', 'almond butter', 'tahini', 'nut butter',
  'canned', 'diced tomato', 'tomato paste', 'tomato sauce', 'crushed tomato',
  'broth', 'stock', 'chicken broth', 'beef broth', 'vegetable broth', 'bone broth',
  'salsa', 'pesto', 'hummus', 'guacamole',
  'vanilla', 'cocoa', 'chocolate chip', 'chocolate', 'coffee', 'tea',
  'cereal', 'granola', 'dried fruit', 'raisin', 'cranberry dried', 'date',
  'coconut milk', 'almond milk', 'oat milk', 'soy milk', 'plant milk'
];

// Re-export the shared list as PANTRY_STAPLES for backward compatibility
export const PANTRY_STAPLES: string[] = SHARED_PANTRY_STAPLES;
