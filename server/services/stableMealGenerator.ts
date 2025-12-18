// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL  
// Feature: Glycemic Meal Generation Integration | Locked: 20250108-1925 | Status: ALL GENERATORS CONNECTED
// User Warning: "I'm gonna be pissed off" if this gets messed up later
// Complete integration of glycemic filtering across ALL meal generators with preferred carb substitution

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { z } from "zod";
import OpenAI from "openai";
import pLimit from "p-limit";
import { convertToUserFriendlyUnits } from "../utils/unitConverter";
import { generateMealFromPrompt } from "./universalMealGenerator";
import { getGlycemicSettings } from "./glycemicSettingsService";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

async function instructBatch(items: Skeleton[]): Promise<Record<string,string[]>> {
  try {
    const sys = "You write short, precise cooking instructions ONLY. Return JSON { instructions: [{ name, steps[] }] }. Steps are imperative, max 8, no fluff.";
    const user = `Generate instructions for these meals: ${items.map(s => `${s.name}: ${s.ingredients.map(i => i.name).join(', ')}`).join('; ')}`;
    
    const response = await getOpenAI().chat.completions.create({
      model: MODEL_INSTRUCTIONS,
      temperature: TEMPERATURE,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in response");
    
    const parsed = InstructionsSchema.parse(JSON.parse(content));
    const result: Record<string, string[]> = {};
    
    for (const item of parsed.instructions) {
      result[item.name] = item.steps;
    }
    
    return result;
  } catch (error) {
    console.error("Instruction generation failed:", error);
    // Return fallback instructions
    const result: Record<string, string[]> = {};
    for (const item of items) {
      result[item.name] = [
        "Prepare all ingredients",
        "Follow basic cooking methods for each ingredient", 
        "Combine and serve"
      ];
    }
    return result;
  }
}

// ---- MAIN GENERATOR ----
export async function generateWeeklyMeals(req: WeeklyMealReq): Promise<FinalMeal[]> {
  console.log("🎯 Starting stable meal generation with catalog system");
  
  // Get glycemic settings for user
  const glycemicSettings = await getGlycemicSettings(req.userId).catch(() => null);
  if (glycemicSettings) {
    console.log(`🩸 Loaded glycemic settings: glucose=${glycemicSettings.bloodGlucose}, carbs=${glycemicSettings.preferredCarbs?.length || 0}`);
  }
  
  // Build slots based on request
  const days = Math.min(req.days || 7, MAX_DAYS);
  const slots = buildSlots(days, req.mealTypes);
  console.log(`📅 Generated ${slots.length} meal slots for ${days} days`);
  
  // Load catalog and pick meals
  const catalog = loadCatalog();
  console.log(`📚 Loaded ${catalog.length} meal templates from catalog`);
  
  const picked = pickFromCatalog(req, catalog, slots, glycemicSettings);
  console.log(`✅ Selected ${picked.length} meals from catalog`);
  
  // Generate nutrition and instructions
  const results: FinalMeal[] = [];
  
  // Process in batches for instructions
  for (let i = 0; i < picked.length; i += BATCH_SIZE) {
    const batch = picked.slice(i, i + BATCH_SIZE);
    
    // Get instructions for batch
    const instructions = await limit(() => instructBatch(batch));
    
    // Process each meal in the batch
    for (const skeleton of batch) {
      const nutrition = await computeNutrition(skeleton.ingredients);
      const medicalBadges = medicalBadgesFor(skeleton, req.medicalFlags);
      
      const meal: FinalMeal = {
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: skeleton.name,
        description: `A delicious ${skeleton.mealType} featuring ${skeleton.ingredients.slice(0, 3).map(i => i.name).join(', ')}`,
        mealType: skeleton.mealType,
        ingredients: convertToUserFriendlyUnits(skeleton.ingredients.map(ing => ({
          name: ing.name,
          amount: ing.grams,
          unit: 'g',
          notes: ''
        }))),
        instructions: instructions[skeleton.name] || [
          "Prepare all ingredients",
          "Cook according to standard methods",
          "Season and serve"
        ],
        nutrition,
        medicalBadges,
        flags: skeleton.tags,
        servingSize: "1 serving",
        imageUrl: null, // No images for speed
        createdAt: new Date()
      };
      
      results.push(meal);
    }
  }
  
  console.log(`🍽️ Generated ${results.length} complete meals with instructions and nutrition`);
  return results;
}

// ---- CRAVING CREATOR (single meal) ----
export async function generateCravingMeal(targetMealType: MealType, craving?: string, userPrefs?: Partial<WeeklyMealReq>): Promise<FinalMeal> {
  console.log(`🎯 Generating single ${targetMealType} meal for craving creator`);
  if (craving) console.log(`🎯 Craving: ${craving}`);
  
  // Get glycemic settings for user if userId provided
  let glycemicSettings = null;
  if (userPrefs?.userId) {
    glycemicSettings = await getGlycemicSettings(userPrefs.userId).catch(() => null);
    if (glycemicSettings) {
      console.log(`🩸 Loaded glycemic settings: glucose=${glycemicSettings.bloodGlucose}, carbs=${glycemicSettings.preferredCarbs?.length || 0}`);
    }
  }
  
  const catalog = loadCatalog();
  // First, correct any meal type mismatches in the catalog
  const correctedCatalog = catalog.map(meal => correctMealType(meal));
  
  let filtered = correctedCatalog.filter(s => {
    const validation = validateMealTypeRobust({ 
      name: s.name, 
      mealType: targetMealType,
      ingredients: s.ingredients.map(ing => ({ name: ing.name })),
      tags: s.tags 
    });
    
    if (!validation.isValid) {
      console.log(`🚫 Filtered out ${s.name}: ${validation.reasons?.join(', ')}`);
      return false;
    }
    
    return s.mealType === targetMealType &&
      (!userPrefs?.allergies || !violatesAllergy(s.ingredients, userPrefs.allergies)) &&
      (!userPrefs?.dietaryRestrictions || !violatesDiet(s.ingredients, userPrefs.dietaryRestrictions));
  });

  // Apply glycemic filtering if settings exist
  if (glycemicSettings && glycemicSettings.preferredCarbs && glycemicSettings.preferredCarbs.length > 0) {
    const preferredCarbs = glycemicSettings.preferredCarbs.map((c: string) => c.toLowerCase());
    const glycemicFiltered = filtered.filter(s => 
      s.ingredients.some(ing => 
        preferredCarbs.some((carb: string) => 
          ing.name.toLowerCase().includes(carb)
        )
      )
    );
    if (glycemicFiltered.length > 0) {
      filtered = glycemicFiltered;
      console.log(`🩸 Applied glycemic filtering: ${filtered.length} meals match preferred low-GI carbs`);
    }
  }

  // Special handling for kid-friendly meals
  if (userPrefs?.kidFriendly || (craving && typeof craving === 'string' && craving.includes('kid-friendly'))) {
    console.log("🧒 Filtering for kid-friendly meals");
    
    // Direct craving match for kids
    if (craving && typeof craving === 'string' && craving.toLowerCase().includes('mac')) {
      const macAndCheese = catalog.find(s => s.name.toLowerCase().includes('mac and cheese'));
      if (macAndCheese) {
        console.log("🧒 Direct match found: Mac and Cheese");
        filtered = [macAndCheese];
      }
    } else if (craving && typeof craving === 'string' && craving.toLowerCase().includes('nugget')) {
      const nuggets = catalog.find(s => s.name.toLowerCase().includes('chicken nuggets'));
      if (nuggets) {
        console.log("🧒 Direct match found: Chicken Nuggets");
        filtered = [nuggets];
      }
    } else if (craving && typeof craving === 'string' && (craving.toLowerCase().includes('grilled cheese') || (craving.toLowerCase().includes('grilled') && craving.toLowerCase().includes('cheese')))) {
      const grilledCheese = catalog.find(s => s.name.toLowerCase().includes('grilled cheese'));
      if (grilledCheese) {
        console.log("🧒 ✅ Direct match found: Grilled Cheese Sandwich");
        
        // Create the meal directly from the matched item
        const selected = grilledCheese;
        const isKidMeal = userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'));
        
        // Create nutrition estimate
        const nutrition = {
          calories: Math.round(selected.ingredients.reduce((sum, ing) => sum + ing.grams * 2.5, 0)),
          protein: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('cheese') || 
            ing.name.toLowerCase().includes('meat') || 
            ing.name.toLowerCase().includes('chicken') ||
            ing.name.toLowerCase().includes('egg')
          ).reduce((sum, ing) => sum + ing.grams * 0.2, 0)),
          carbs: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('bread') || 
            ing.name.toLowerCase().includes('rice') ||
            ing.name.toLowerCase().includes('pasta')
          ).reduce((sum, ing) => sum + ing.grams * 0.7, 0)),
          fat: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('oil') || 
            ing.name.toLowerCase().includes('butter') ||
            ing.name.toLowerCase().includes('cheese')
          ).reduce((sum, ing) => sum + ing.grams * 0.3, 0))
        };
        
        // Generate image for meal
        let imageUrl = null;
        try {
          const { generateImage } = await import("./imageService");
          imageUrl = await generateImage({
            name: selected.name,
            description: `child-friendly cartoon-style version, colorful plate, fun design, appealing to kids`,
            type: 'meal',
            style: 'kid-friendly',
            ingredients: selected.ingredients.map(ing => ing.name),
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
          });
          console.log(`📸 Generated kid-friendly image for ${selected.name}`);
        } catch (error) {
          console.log(`❌ Image generation failed for ${selected.name}:`, error);
        }
        
        return {
          id: `craving-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: selected.name,
          description: `A kid-friendly lunch that children will love! Made with ${selected.ingredients.slice(0, 3).map(ing => ing.name).join(', ')}. Fun, tasty, and nutritious.`,
          mealType: selected.mealType,
          ingredients: selected.ingredients.map(ing => ({
            name: ing.name,
            amount: ing.grams,
            unit: 'g',
            notes: ''
          })),
          instructions: [
            "Heat a non-stick pan over medium heat.",
            "Butter one side of each bread slice.",
            "Place one slice butter-side down in the pan.",
            "Add cheese slices on top of the bread in the pan.",
            "Top with the second slice of bread, butter-side up.",
            "Cook for 2-3 minutes until golden brown.",
            "Flip carefully and cook the other side for 2-3 minutes.",
            "Remove from heat, let cool for 1 minute, and cut in half.",
            "Serve immediately while cheese is melted."
          ],
          nutrition,
          medicalBadges: [],
          flags: selected.tags,
          servingSize: "1 serving",
          imageUrl: imageUrl,
          createdAt: new Date()
        };
      } else {
        console.log("🧒 No grilled cheese found in catalog, using fallback logic");
      }
    } else if (craving && craving.toLowerCase().includes('pizza')) {
      const pizza = catalog.find(s => s.name.toLowerCase().includes('pizza'));
      if (pizza) {
        console.log("🧒 Direct match found: Mini Pizza");
        filtered = [pizza];
      }
    } else {
      // Filter for kid-friendly meals first
      const kidFriendlyFiltered = filtered.filter(s => 
        s.tags.includes('kid_friendly') || 
        s.tags.includes('comfort_food') ||
        ['Mac and Cheese', 'Chicken Nuggets', 'Grilled Cheese', 'Pizza', 'Pasta', 'Pancakes', 'French Toast', 'Peanut Butter'].some(kidMeal => 
          s.name.toLowerCase().includes(kidMeal.toLowerCase())
        )
      );
      
      if (kidFriendlyFiltered.length > 0) {
        filtered = kidFriendlyFiltered;
        console.log(`🧒 Found ${filtered.length} kid-friendly meals`);
      }
    }
  }
  
  // CRAVING MATCHING LOGIC - Filter by craving if provided
  // For kids meals, also process craving matching to find the right kid-friendly meal
  if (craving && (!userPrefs?.kidFriendly || filtered.length > 1)) {
    const cravingLower = craving.toLowerCase().trim();
    console.log(`🔍 Filtering for craving: "${cravingLower}"`);
    console.log(`🔍 Available meals before craving filter: ${filtered.map(s => s.name)}`);
    
    // Enhanced craving matching for common food categories
    const cravingMappings: Record<string, string[]> = {
      'fish': ['salmon', 'tuna', 'cod', 'tilapia', 'trout', 'bass', 'halibut'],
      'seafood': ['salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia'],
      'chicken': ['chicken'],
      'beef': ['beef', 'steak'],
      'turkey': ['turkey'],
      'pasta': ['pasta', 'spaghetti', 'linguine', 'penne'],
      'salad': ['salad', 'lettuce', 'greens'],
      'rice': ['rice'],
      'soup': ['soup', 'broth'],
      'pizza': ['pizza'],
      'sandwich': ['sandwich', 'wrap'],
      // Desserts and sweets
      'ice cream': ['ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'vanilla', 'chocolate', 'strawberry'],
      'chocolate': ['chocolate', 'cocoa', 'brownie', 'truffle', 'fudge', 'mousse'],
      'cake': ['cake', 'cupcake', 'frosting', 'sponge', 'layer cake'],
      'cookie': ['cookie', 'biscuit', 'shortbread', 'oatmeal cookie', 'chocolate chip'],
      'pie': ['pie', 'tart', 'apple pie', 'pumpkin pie', 'cherry pie'],
      'dessert': ['dessert', 'sweet', 'pudding', 'custard', 'cream', 'ice cream', 'cake', 'cookie'],
      'sweet': ['sweet', 'dessert', 'chocolate', 'vanilla', 'caramel', 'sugar', 'honey'],
      'candy': ['candy', 'gummy', 'lollipop', 'caramel', 'toffee', 'mint'],
      // Breakfast items
      'pancakes': ['pancake', 'syrup', 'maple', 'blueberry pancake'],
      'waffles': ['waffle', 'syrup', 'belgian waffle'],
      'french toast': ['french toast', 'toast', 'syrup', 'cinnamon'],
      'cereal': ['cereal', 'oats', 'granola', 'muesli'],
      'smoothie': ['smoothie', 'banana', 'berry', 'protein shake'],
      // Comfort foods
      'mac and cheese': ['mac and cheese', 'macaroni', 'cheese sauce'],
      'burger': ['burger', 'hamburger', 'cheeseburger', 'patty'],
      'fries': ['fries', 'french fries', 'potato', 'sweet potato'],
      'french fries': ['fries', 'french fries', 'potato', 'sweet potato'],
      'hot dog': ['hot dog', 'sausage', 'frankfurter'],
      // Kids favorites
      'cheese sticks': ['cheese', 'mozzarella', 'string cheese', 'cheese stick'],
      'chicken nuggets': ['chicken', 'nugget', 'tender', 'strip'],
      'grilled cheese': ['grilled cheese', 'cheese sandwich', 'melted cheese']
    };
    
    // First try direct ingredient/name matches
    let cravingFiltered = filtered.filter(s => 
      s.ingredients.some(ing => ing.name.toLowerCase().includes(cravingLower)) ||
      s.name.toLowerCase().includes(cravingLower)
    );
    
    // If no direct matches, try category mappings
    if (cravingFiltered.length === 0 && cravingMappings[cravingLower]) {
      const keywords = cravingMappings[cravingLower];
      cravingFiltered = filtered.filter(s => {
        const mealText = `${s.name} ${s.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
        return keywords.some(keyword => mealText.includes(keyword));
      });
      console.log(`🔍 Using category mapping for "${cravingLower}": ${keywords.join(', ')}`);
    }
    
    // If still no matches, try partial word matches but be more conservative
    if (cravingFiltered.length === 0) {
      const cravingWords = cravingLower.split(' ').filter(w => w.length > 2);
      
      // Skip GPT-4 for generic healthy meal requests - these should use catalog
      const isGenericHealthyRequest = cravingLower.match(/^healthy\s+(breakfast|lunch|dinner|snack)\s+meal$/);
      
      // For complex requests (3+ words) or specific dish names, skip partial matching and go to GPT-4
      // BUT allow generic healthy meal requests to use catalog
      if (!isGenericHealthyRequest && 
          (cravingWords.length >= 3 || 
           ['burrito', 'bowl', 'wrap', 'curry', 'stir fry', 'casserole', 'soup'].some(dish => cravingLower.includes(dish)))) {
        console.log(`🔍 Complex craving detected "${cravingLower}" - skipping partial matches, using GPT-4`);
      } else {
        // For generic healthy requests, ignore the "healthy" and "meal" words
        const filterWords = isGenericHealthyRequest ? 
          cravingWords.filter(w => !['healthy', 'meal'].includes(w)) : 
          cravingWords;
          
        cravingFiltered = filtered.filter(s => {
          const mealText = `${s.name} ${s.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
          // If no meaningful words left after filtering, return any meal of the correct type
          return filterWords.length === 0 || filterWords.some(word => mealText.includes(word));
        });
        console.log(`🔍 Trying partial word matches: ${filterWords.join(', ')}`);
      }
    }
    
    if (cravingFiltered.length > 0) {
      filtered = cravingFiltered;
      console.log(`🎯 Found ${filtered.length} matches for craving "${cravingLower}": ${filtered.map(s => s.name)}`);
    } else {
      console.log(`⚠️ No matches found for craving "${cravingLower}" in catalog, falling back to GPT-4 generation`);
      // Use Universal AI Meal Generator as fallback
      return await generateMealFromPrompt(craving, targetMealType, userPrefs);
    }
  }
  
  if (filtered.length === 0) {
    // For kids meals, use kid-friendly fallbacks only
    if (userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'))) {
      const kidFallbacks = ["Mac and Cheese", "Chicken Nuggets", "Grilled Cheese Sandwich", "Mini Pizza", "Pancakes"];
      const fallbackMeals = catalog.filter(s => 
        kidFallbacks.some(kidMeal => s.name.toLowerCase().includes(kidMeal.toLowerCase()))
      );
      if (fallbackMeals.length > 0) {
        filtered = fallbackMeals;
        console.log("🧒 Using kid-friendly fallback meals");
      }
    } else {
      // Fallback to any meal type if no matches found
      filtered = catalog.filter(s => 
        (!userPrefs?.allergies || !violatesAllergy(s.ingredients, userPrefs.allergies)) &&
        (!userPrefs?.dietaryRestrictions || !violatesDiet(s.ingredients, userPrefs.dietaryRestrictions))
      );
    }
    
    if (filtered.length === 0) {
      throw new Error(`No suitable meals found in catalog for preferences`);
    }
  }
  
  const selected = filtered[Math.floor(Math.random() * filtered.length)];
  console.log(`🎯 Selected meal: ${selected.name} from ${filtered.length} options`);
  const nutrition = await computeNutrition(selected.ingredients);
  const medicalBadges = medicalBadgesFor(selected, userPrefs?.medicalFlags || []);
  
  // Generate instructions for single meal
  const instructionsMap = await instructBatch([selected]);
  
  // Create more descriptive meal description
  const mainIngredients = selected.ingredients.slice(0, 3).map(i => i.name).join(', ');
  const isKidMeal = userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'));
  const description = isKidMeal 
    ? `A kid-friendly ${targetMealType} that children will love! Made with ${mainIngredients}. Fun, tasty, and nutritious.`
    : `A delicious ${targetMealType} featuring ${mainIngredients}. ${selected.tags.includes('high_protein') ? 'High in protein and ' : ''}Perfect for satisfying your cravings while maintaining your health goals.`;
  
  // Generate image for meal with kid-friendly styling
  let imageUrl = null;
  try {
    const { generateImage } = await import("./imageService");
    imageUrl = await generateImage({
      name: selected.name,
      description: isKidMeal ? `child-friendly cartoon-style version, colorful plate, fun design, appealing to kids` : description,
      type: 'meal',
      style: isKidMeal ? 'kid-friendly' : 'homemade',
      ingredients: selected.ingredients.map(ing => ing.name),
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
    });
    console.log(`📸 Generated ${isKidMeal ? 'kid-friendly ' : ''}image for ${selected.name}`);
  } catch (error) {
    console.log(`❌ Image generation failed for ${selected.name}:`, error);
  }
  
  return {
    id: `craving-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: selected.name,
    description: description,
    mealType: selected.mealType,
    ingredients: convertToUserFriendlyUnits(selected.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.grams,
      unit: 'g',
      notes: ''
    }))),
    instructions: instructionsMap[selected.name] || [
      "Prepare all ingredients according to recipe",
      "Cook using appropriate methods for each ingredient", 
      "Season to taste and serve hot"
    ],
    nutrition,
    medicalBadges,
    flags: selected.tags,
    servingSize: "1 serving",
    imageUrl: imageUrl,
    createdAt: new Date()
  };
}