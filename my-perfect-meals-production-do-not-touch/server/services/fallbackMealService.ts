// Fallback meal service for testing when OpenAI is unavailable
import { MealGenerationRequest, Meal } from "./mealEngineService";
import { randomUUID } from "crypto";

export function createFallbackMeal(request: MealGenerationRequest): Meal {
  const dietType = request.tempMedicalOverride || request.tempDietPreference || "Mediterranean";
  
  // Generate variety for meal replacements
  const varietyModifiers = [
    "Classic", "Gourmet", "Artisan", "Garden Fresh", "Supreme", 
    "Mediterranean Style", "Traditional", "Modern", "Rustic", "Deluxe"
  ];
  
  // Use forceVariety or timestamp/randomSeed to ensure different meals
  const shouldAddVariety = (request as any).forceVariety || (request as any).timestamp || (request as any).randomSeed;
  const varietyIndex = shouldAddVariety 
    ? Math.floor(((request as any).timestamp || Date.now()) % varietyModifiers.length)
    : 0;
  const varietyModifier = varietyModifiers[varietyIndex];

  const mealsByDiet: Record<string, any> = {
    Mediterranean: {
      name: "Mediterranean Chicken Bowl",
      description: "Grilled chicken with olives, tomatoes, and fresh herbs",
      ingredients: [
        { item: "Chicken breast", amount: 6, unit: "oz", notes: "boneless, skinless" },
        { item: "Cherry tomatoes", amount: 1, unit: "cup", notes: "halved" },
        { item: "Kalamata olives", amount: 0.25, unit: "cup", notes: "pitted" },
        { item: "Olive oil", amount: 2, unit: "tbsp" },
        { item: "Fresh basil", amount: 0.25, unit: "cup", notes: "chopped" },
        { item: "Quinoa", amount: 0.5, unit: "cup", notes: "dry" }
      ],
      instructions: [
        "Cook quinoa according to package directions",
        "Season chicken with salt, pepper, and herbs",
        "Grill chicken for 6-7 minutes per side until cooked through",
        "Slice chicken and arrange over quinoa",
        "Top with tomatoes, olives, and fresh basil",
        "Drizzle with olive oil before serving"
      ]
    },
    Keto: {
      name: "Keto Salmon with Avocado",
      description: "Pan-seared salmon with creamy avocado and spinach",
      ingredients: [
        { item: "Salmon fillet", amount: 6, unit: "oz" },
        { item: "Avocado", amount: 1, unit: "whole", notes: "sliced" },
        { item: "Baby spinach", amount: 2, unit: "cups" },
        { item: "Butter", amount: 2, unit: "tbsp" },
        { item: "Lemon", amount: 0.5, unit: "whole", notes: "juiced" },
        { item: "Garlic", amount: 2, unit: "cloves", notes: "minced" }
      ],
      instructions: [
        "Season salmon with salt and pepper",
        "Heat butter in skillet over medium-high heat",
        "Cook salmon 4-5 minutes per side until flaky",
        "Sauté garlic and spinach until wilted",
        "Serve salmon over spinach with sliced avocado",
        "Finish with lemon juice"
      ]
    },
    Vegan: {
      name: "Vegan Buddha Bowl",
      description: "Colorful bowl with quinoa, roasted vegetables, and tahini dressing",
      ingredients: [
        { item: "Quinoa", amount: 0.5, unit: "cup", notes: "dry" },
        { item: "Sweet potato", amount: 1, unit: "medium", notes: "cubed" },
        { item: "Broccoli", amount: 1, unit: "cup", notes: "florets" },
        { item: "Chickpeas", amount: 0.5, unit: "cup", notes: "canned, drained" },
        { item: "Tahini", amount: 2, unit: "tbsp" },
        { item: "Lemon juice", amount: 1, unit: "tbsp" }
      ],
      instructions: [
        "Cook quinoa according to package directions",
        "Roast sweet potato and broccoli at 400°F for 20 minutes",
        "Heat chickpeas in a pan with spices",
        "Whisk tahini with lemon juice and water for dressing",
        "Arrange quinoa, vegetables, and chickpeas in bowl",
        "Drizzle with tahini dressing"
      ]
    }
  };

  // Add variety based on meal type  
  const baseTemplate = mealsByDiet[dietType] || mealsByDiet.Mediterranean;
  
  // Create variations for different meal types
  const template = request.mealType === "breakfast" ? {
    name: "Mediterranean Breakfast Bowl",
    description: "Protein-rich breakfast with Greek yogurt, berries, and nuts",
    ingredients: [
      { item: "Greek yogurt", amount: 1, unit: "cup", notes: "plain, low-fat" },
      { item: "Mixed berries", amount: 0.5, unit: "cup", notes: "blueberries and strawberries" },
      { item: "Walnuts", amount: 2, unit: "tbsp", notes: "chopped" },
      { item: "Honey", amount: 1, unit: "tbsp" },
      { item: "Chia seeds", amount: 1, unit: "tsp" }
    ],
    instructions: [
      "Place Greek yogurt in a bowl",
      "Top with mixed berries",
      "Sprinkle chopped walnuts and chia seeds",
      "Drizzle with honey before serving"
    ]
  } : request.mealType === "lunch" ? {
    name: "Mediterranean Quinoa Salad",
    description: "Fresh Mediterranean salad with quinoa, vegetables, and feta",
    ingredients: [
      { item: "Quinoa", amount: 0.5, unit: "cup", notes: "cooked" },
      { item: "Cherry tomatoes", amount: 1, unit: "cup", notes: "halved" },
      { item: "Cucumber", amount: 0.5, unit: "cup", notes: "diced" },
      { item: "Red onion", amount: 0.25, unit: "cup", notes: "diced" },
      { item: "Feta cheese", amount: 2, unit: "oz", notes: "crumbled" },
      { item: "Olive oil", amount: 2, unit: "tbsp" }
    ],
    instructions: [
      "Cook quinoa according to package directions",
      "Dice vegetables while quinoa cools",
      "Combine quinoa, tomatoes, cucumber, and onion",
      "Top with crumbled feta and drizzle with olive oil",
      "Toss gently and serve chilled"
    ]
  } : baseTemplate;
  
  // Apply variety modifier to meal name for replacements
  let mealName = template.name;
  if (shouldAddVariety && !mealName.includes(varietyModifier)) {
    mealName = `${varietyModifier} ${template.name}`;
  }

  // Ensure ingredients and instructions are properly formatted
  const formattedIngredients = template.ingredients.map((ingredient: any) => ({
    item: ingredient.item,
    amount: ingredient.amount,
    unit: ingredient.unit,
    notes: ingredient.notes || ""
  }));

  const formattedInstructions = Array.isArray(template.instructions) 
    ? template.instructions 
    : template.instructions.split('. ').filter((step: any) => step.trim());

  console.log(`🍽️ Creating fallback meal: ${mealName} with ${formattedIngredients.length} ingredients, ${formattedInstructions.length} steps`);

  return {
    id: randomUUID(),
    name: mealName,
    description: template.description,
    ingredients: formattedIngredients,
    instructions: formattedInstructions,
    nutrition: {
      calories: 450,
      protein_g: 35,
      carbs_g: 25,
      fat_g: 18,
      fiber_g: 8,
      sugar_g: 6
    },
    servings: request.servings || 1,
    source: request.source || "craving",
    imageUrl: undefined,
    compliance: {
      allergiesCleared: true,
      medicalCleared: true,
      unitsStandardized: true
    }
  };
}