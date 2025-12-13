// Master ingredient list for food preferences
export const masterIngredients = [
  // Proteins
  "chicken breast", "chicken thigh", "ground chicken", "turkey breast", "ground turkey",
  "beef sirloin", "ground beef", "pork tenderloin", "pork chops", "lamb",
  "salmon", "tuna", "cod", "shrimp", "crab", "lobster", "scallops",
  "eggs", "egg whites", "tofu", "tempeh", "seitan",
  "black beans", "kidney beans", "chickpeas", "lentils", "quinoa",
  
  // Vegetables
  "broccoli", "spinach", "kale", "arugula", "lettuce", "romaine",
  "carrots", "bell peppers", "onions", "garlic", "ginger",
  "tomatoes", "cucumbers", "zucchini", "eggplant", "mushrooms",
  "asparagus", "brussels sprouts", "cauliflower", "sweet potatoes",
  "regular potatoes", "celery", "cabbage", "bok choy",
  
  // Fruits
  "apples", "bananas", "oranges", "berries", "strawberries", "blueberries",
  "raspberries", "blackberries", "grapes", "pineapple", "mango",
  "avocado", "lemons", "limes", "peaches", "pears", "cherries",
  
  // Grains & Carbohydrates
  "brown rice", "white rice", "wild rice", "oats", "quinoa",
  "whole wheat bread", "sourdough bread", "pasta", "whole wheat pasta",
  "barley", "bulgur", "farro", "buckwheat",
  
  // Dairy & Alternatives
  "milk", "almond milk", "oat milk", "soy milk", "coconut milk",
  "greek yogurt", "regular yogurt", "cheese", "cottage cheese",
  "cream cheese", "butter", "coconut oil", "olive oil",
  
  // Nuts & Seeds
  "almonds", "walnuts", "pecans", "cashews", "peanuts", "pistachios",
  "chia seeds", "flax seeds", "pumpkin seeds", "sunflower seeds",
  "hemp hearts", "tahini", "almond butter", "peanut butter",
  
  // Herbs & Spices
  "basil", "oregano", "thyme", "rosemary", "cilantro", "parsley",
  "cumin", "paprika", "turmeric", "black pepper", "cayenne",
  "cinnamon", "nutmeg", "vanilla", "bay leaves",
  
  // Common Allergens
  "wheat", "gluten", "dairy", "eggs", "fish", "shellfish",
  "tree nuts", "peanuts", "soy", "sesame",
  
  // Other Common Foods
  "honey", "maple syrup", "coconut", "dark chocolate", "cocoa",
  "coffee", "tea", "wine", "beer", "vinegar", "mustard", "mayo"
];

// Synonym mappings for ingredient normalization
export const ingredientSynonyms: Record<string, string> = {
  "prawns": "shrimp",
  "garbanzo beans": "chickpeas",
  "ceci beans": "chickpeas",
  "ground meat": "ground beef",
  "minced meat": "ground beef",
  "chicken meat": "chicken breast",
  "fish fillet": "fish",
  "greek yoghurt": "greek yogurt",
  "yoghurt": "yogurt",
  "courgette": "zucchini",
  "aubergine": "eggplant",
  "capsicum": "bell peppers",
  "spring onions": "green onions",
  "scallions": "green onions",
  "rocket": "arugula",
  "cos lettuce": "romaine",
  "sweet corn": "corn",
  "maize": "corn",
  "coriander": "cilantro",
  "fresh herbs": "herbs",
  "mixed herbs": "herbs",
  "spices": "seasoning",
  "seasoning mix": "seasoning"
};

// Normalize ingredient name for comparison
export function normalizeIngredient(ingredient: string): string {
  const normalized = ingredient.toLowerCase().trim();
  return ingredientSynonyms[normalized] || normalized;
}

// Check if an ingredient should be avoided
export function isAvoided(ingredient: string, avoidedFoods: string[]): boolean {
  const normalizedIngredient = normalizeIngredient(ingredient);
  const normalizedAvoided = avoidedFoods.map(food => normalizeIngredient(food));
  
  return normalizedAvoided.some(avoided => {
    // Check for exact match
    if (normalizedIngredient === avoided) return true;
    
    // Check if ingredient contains the avoided food
    if (normalizedIngredient.includes(avoided)) return true;
    
    // Check if avoided food contains the ingredient (for broader matches)
    if (avoided.includes(normalizedIngredient)) return true;
    
    return false;
  });
}

// Filter ingredients for food picker with smart prioritization
export function searchIngredients(query: string, limit = 20): string[] {
  if (!query.trim()) return masterIngredients.slice(0, limit);
  
  const searchTerm = query.toLowerCase().trim();
  
  // Separate matches into categories for prioritization
  const startsWithMatches: string[] = [];
  const wordStartsWithMatches: string[] = [];
  const containsMatches: string[] = [];
  
  masterIngredients.forEach(ingredient => {
    const lowerIngredient = ingredient.toLowerCase();
    
    // Priority 1: Starts with search term (e.g., "apple" for "a")
    if (lowerIngredient.startsWith(searchTerm)) {
      startsWithMatches.push(ingredient);
    }
    // Priority 2: Any word starts with search term (e.g., "chicken breast" for "b")
    else if (lowerIngredient.split(' ').some(word => word.startsWith(searchTerm))) {
      wordStartsWithMatches.push(ingredient);
    }
    // Priority 3: Contains search term anywhere (e.g., "salmon" for "al")
    else if (lowerIngredient.includes(searchTerm)) {
      containsMatches.push(ingredient);
    }
  });
  
  // Combine in priority order
  const sortedMatches = [...startsWithMatches, ...wordStartsWithMatches, ...containsMatches];
  return sortedMatches.slice(0, limit);
}