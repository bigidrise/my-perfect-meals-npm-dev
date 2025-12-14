/**
 * Diabetic Diet Guardrail Rules
 * 
 * Medical-grade restrictions for diabetic users to prevent:
 * - Blood sugar spikes
 * - High glycemic index foods
 * - Excess carbohydrate load
 * - Hidden sugar exposure
 */

import { GuardrailRules } from "../types";

export const diabeticRules: GuardrailRules = {
  dietType: "diabetic",
  
  // ABSOLUTE AVOIDANCE LIST - Never appear in diabetic meals/snacks
  blockedIngredients: [
    // Sugars / Sweeteners
    "white sugar",
    "brown sugar",
    "sugar",
    "honey",
    "maple syrup",
    "agave",
    "agave nectar",
    "high-fructose corn syrup",
    "corn syrup",
    "molasses",
    "candy",
    "chocolate", // non-dark
    "milk chocolate",
    "sweetened yogurt",
    "flavored yogurt",
    "sugary granola",
    "granola bar",
    
    // High GI Starches
    "white rice",
    "jasmine rice",
    "regular pasta",
    "spaghetti",
    "penne",
    "fettuccine",
    "linguine",
    "macaroni",
    "potato",
    "potatoes",
    "mashed potatoes",
    "french fries",
    "fries",
    "baked potato",
    "hash browns",
    "tater tots",
    "flour tortilla",
    "flour tortillas",
    "pizza crust",
    "pizza dough",
    "pastry",
    "pastries",
    "bread",
    "white bread",
    "muffin",
    "muffins",
    "croissant",
    "bagel",
    "donut",
    "doughnut",
    "white flour",
    "all-purpose flour",
    "pancake",
    "pancakes",
    "waffle",
    "waffles",
    
    // Sweet Fruits (high GI)
    "banana",
    "bananas",
    "pineapple",
    "mango",
    "mangoes",
    "grapes",
    "grape",
    "watermelon",
    "dried fruit",
    "raisins",
    "dates",
    "fruit juice",
    "orange juice",
    "apple juice",
    
    // Sugary Condiments
    "bbq sauce",
    "barbecue sauce",
    "ketchup",
    "teriyaki sauce",
    "sweet chili sauce",
    "hoisin sauce",
    "caramel",
    "chocolate sauce",
    "jam",
    "jelly",
    "marmalade",
    
    // Sugary Beverages
    "soda",
    "cola",
    "sweet tea",
    "lemonade",
    "sports drink",
    "energy drink",
  ],
  
  // PREFERRED INGREDIENTS - Prioritize these
  preferredIngredients: [
    // Lean Proteins
    "chicken breast",
    "turkey breast",
    "turkey",
    "salmon",
    "cod",
    "tilapia",
    "shrimp",
    "eggs",
    "egg whites",
    "lean beef",
    "pork tenderloin",
    
    // Non-starchy Vegetables
    "broccoli",
    "spinach",
    "kale",
    "zucchini",
    "asparagus",
    "cauliflower",
    "green beans",
    "brussels sprouts",
    "cabbage",
    "bell pepper",
    "cucumber",
    "celery",
    "mushrooms",
    "eggplant",
    "leafy greens",
    "arugula",
    "lettuce",
    "tomato",
    "onion",
    "garlic",
    
    // Low-GI Carbs (limited portions)
    "quinoa",
    "farro",
    "steel-cut oats",
    "barley",
    "brown rice", // small portions only
    "cauliflower rice",
    "zucchini noodles",
    "spaghetti squash",
    "chickpea pasta",
    "lentil pasta",
    "low-carb tortilla",
    
    // Healthy Fats
    "olive oil",
    "avocado",
    "almonds",
    "walnuts",
    "pecans",
    "chia seeds",
    "flaxseed",
    "coconut oil",
    
    // Low-GI Fruits (best options)
    "berries",
    "blueberries",
    "strawberries",
    "raspberries",
    "blackberries",
    
    // Dairy (unsweetened)
    "greek yogurt",
    "plain greek yogurt",
    "cottage cheese",
    "low-fat cottage cheese",
    "unsweetened almond milk",
    
    // Diabetic-Friendly Sweeteners
    "stevia",
    "erythritol",
    "monk fruit",
    "dark chocolate", // 70%+ cacao
  ],
  
  // Substitutions for common problem ingredients
  substitutions: {
    "flour tortilla": "low-carb tortilla",
    "tortilla": "low-carb tortilla",
    "pasta": "zucchini noodles or chickpea pasta",
    "spaghetti": "zucchini noodles or spaghetti squash",
    "white rice": "cauliflower rice",
    "rice": "cauliflower rice or small portion brown rice",
    "potato": "cauliflower mash",
    "potatoes": "roasted cauliflower or vegetables",
    "mashed potatoes": "cauliflower mash",
    "bread": "low-carb bread or lettuce wrap",
    "sugar": "stevia or monk fruit sweetener",
    "honey": "sugar-free sweetener",
    "maple syrup": "sugar-free syrup",
    "ketchup": "sugar-free ketchup",
    "bbq sauce": "sugar-free bbq sauce",
    "teriyaki sauce": "sugar-free teriyaki",
    "yogurt": "plain unsweetened greek yogurt",
    "banana": "berries",
    "orange juice": "water with lemon",
  },
  
  // Metabolic/macro guidelines for diabetic meals
  macroGuidelines: {
    lowGlycemicImpact: true,
    proteinPriority: "moderate",
    fiberPriority: "high",
    carbLimit: "moderate-to-low",
    fatBalance: "moderate-healthy",
    evenMacroDistribution: true,
  },
  
  // Snack-specific rules
  snackRules: {
    lowCarb: true,
    highProteinOrFiber: true,
    lowSugar: true,
    minimalGlycemicLoad: true,
  },
};
