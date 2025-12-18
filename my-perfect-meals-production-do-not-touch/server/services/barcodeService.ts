import { db } from "../db";

// Mock food database - in production this would be a real database or API
const MOCK_FOOD_DATABASE = {
  "0123456789123": {
    id: "food_1",
    barcode: "0123456789123", 
    name: "Organic Greek Yogurt",
    brand: "Chobani",
    servingSizes: [
      { label: "1 container (150g)", grams: 150 },
      { label: "1/2 container (75g)", grams: 75 }
    ],
    nutrPerServing: {
      kcal: 100,
      protein_g: 15,
      carbs_g: 6,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 4,
      sodium_mg: 50
    },
    verified: true,
    source: "off"
  },
  "4131": {
    id: "food_2",
    barcode: "4131",
    name: "Apple",
    brand: "Fresh Produce",
    servingSizes: [
      { label: "1 medium apple (182g)", grams: 182 },
      { label: "1 large apple (223g)", grams: 223 },
      { label: "1 small apple (149g)", grams: 149 }
    ],
    nutrPerServing: {
      kcal: 95,
      protein_g: 0.5,
      carbs_g: 25,
      fat_g: 0.3,
      fiber_g: 4,
      sugar_g: 19,
      sodium_mg: 2
    },
    verified: true,
    source: "usda"
  },
  "4011": {
    id: "food_3",
    barcode: "4011",
    name: "Banana",
    brand: "Fresh Produce",
    servingSizes: [
      { label: "1 medium banana (118g)", grams: 118 },
      { label: "1 large banana (136g)", grams: 136 },
      { label: "1 small banana (101g)", grams: 101 }
    ],
    nutrPerServing: {
      kcal: 105,
      protein_g: 1.3,
      carbs_g: 27,
      fat_g: 0.4,
      fiber_g: 3,
      sugar_g: 14,
      sodium_mg: 1
    },
    verified: true,
    source: "usda"
  }
};

interface FoodData {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  servingSizes: Array<{ label: string; grams: number }>;
  nutrPerServing: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  verified: boolean;
  source: string;
}

interface LogFoodParams {
  userId: string;
  dateLocal: string;
  mealSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId: string;
  barcode: string;
  servingLabel: string;
  servings: number;
}

interface AddNewFoodParams {
  barcode: string;
  name: string;
  brand?: string;
  servingLabel: string;
  servingGrams: number;
  nutrition: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
}

export async function lookupBarcode(barcode: string): Promise<FoodData | null> {
  console.log(`🔍 Looking up barcode: ${barcode}`);
  
  try {
    // Sanitize barcode: remove all non-digit characters (dashes, spaces, etc.)
    const sanitized = barcode.replace(/\D/g, '');
    console.log(`🧹 Sanitized barcode: ${sanitized}`);
    
    // Also try without leading zeros
    const withoutLeadingZeros = sanitized.replace(/^0+/, '');
    
    // First check our mock database with both versions
    const mockFood = MOCK_FOOD_DATABASE[sanitized as keyof typeof MOCK_FOOD_DATABASE] || 
                     MOCK_FOOD_DATABASE[withoutLeadingZeros as keyof typeof MOCK_FOOD_DATABASE];
    
    if (mockFood) {
      console.log(`✅ Found in mock database: ${mockFood.name}`);
      return mockFood;
    }

    // Try OpenFoodFacts API first (free, no API key needed)
    try {
      console.log(`🔍 Trying OpenFoodFacts...`);
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${sanitized}.json`, {
        headers: {
          'User-Agent': 'MacroCalculator/1.0 (macro-calculator@replit.com)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 1 && data.product) {
          const product = data.product;
          
          // Extract nutrition data (per 100g from OpenFoodFacts)
          const nutr100g = product.nutriments || {};
          
          // Convert to per-serving basis (assuming 100g serving by default)
          const servingSize = 100;
          const food: FoodData = {
            id: `off_${sanitized}`,
            barcode: sanitized,
            name: product.product_name || product.product_name_en || 'Unknown Product',
            brand: product.brands?.split(',')[0]?.trim(),
            servingSizes: [
              { label: `${servingSize}g`, grams: servingSize }
            ],
            nutrPerServing: {
              kcal: Math.round((nutr100g.energy_kcal_100g || nutr100g['energy-kcal_100g'] || 0) * (servingSize / 100)),
              protein_g: Math.round((nutr100g.proteins_100g || nutr100g['proteins_100g'] || 0) * (servingSize / 100) * 10) / 10,
              carbs_g: Math.round((nutr100g.carbohydrates_100g || nutr100g['carbohydrates_100g'] || 0) * (servingSize / 100) * 10) / 10,
              fat_g: Math.round((nutr100g.fat_100g || nutr100g['fat_100g'] || 0) * (servingSize / 100) * 10) / 10,
              fiber_g: nutr100g.fiber_100g ? Math.round(nutr100g.fiber_100g * (servingSize / 100) * 10) / 10 : undefined,
              sugar_g: nutr100g.sugars_100g ? Math.round(nutr100g.sugars_100g * (servingSize / 100) * 10) / 10 : undefined,
              sodium_mg: nutr100g.sodium_100g ? Math.round(nutr100g.sodium_100g * 1000 * (servingSize / 100)) : undefined
            },
            verified: true,
            source: 'off'
          };
          
          console.log(`✅ Found on OpenFoodFacts: ${food.name}`);
          return food;
        }
      }
    } catch (error) {
      console.warn("OpenFoodFacts API error:", error);
    }

    // Fallback to UPCitemdb API (free trial, 100 requests/day, no API key needed)
    try {
      console.log(`🔍 Trying UPCitemdb...`);
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${sanitized}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.code === "OK" && data.items && data.items.length > 0) {
          const item = data.items[0];
          
          // UPCitemdb doesn't always have nutrition data, so we provide defaults
          const servingSize = 100;
          const food: FoodData = {
            id: `upc_${sanitized}`,
            barcode: sanitized,
            name: item.title || 'Unknown Product',
            brand: item.brand,
            servingSizes: [
              { label: `${servingSize}g`, grams: servingSize }
            ],
            nutrPerServing: {
              kcal: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0
            },
            verified: false,
            source: 'upcitemdb'
          };
          
          console.log(`✅ Found on UPCitemdb: ${food.name} (no nutrition data - user can add manually)`);
          return food;
        }
      }
    } catch (error) {
      console.warn("UPCitemdb API error:", error);
    }

    // Check database for user-added foods
    // TODO: Add database lookup when schema is available
    
    console.log(`❌ Product not found in any database: ${barcode}`);
    return null;
  } catch (error: any) {
    console.error("Barcode lookup error:", error);
    throw new Error(`Failed to lookup barcode: ${error?.message || error}`);
  }
}

export async function logFood(params: LogFoodParams) {
  const { userId, dateLocal, mealSlot, foodId, barcode, servingLabel, servings } = params;
  
  try {
    console.log(`📝 Logging food: ${foodId} for user ${userId} on ${dateLocal}`);
    
    // Get food details
    const food = await lookupBarcode(barcode);
    if (!food) {
      throw new Error("Food not found");
    }

    // Calculate nutrition for the serving
    const nutrition = {
      kcal: Math.round(food.nutrPerServing.kcal * servings),
      protein_g: Math.round(food.nutrPerServing.protein_g * servings * 10) / 10,
      carbs_g: Math.round(food.nutrPerServing.carbs_g * servings * 10) / 10,
      fat_g: Math.round(food.nutrPerServing.fat_g * servings * 10) / 10,
      fiber_g: food.nutrPerServing.fiber_g ? Math.round(food.nutrPerServing.fiber_g * servings * 10) / 10 : 0,
      sugar_g: food.nutrPerServing.sugar_g ? Math.round(food.nutrPerServing.sugar_g * servings * 10) / 10 : 0,
      sodium_mg: food.nutrPerServing.sodium_mg ? Math.round(food.nutrPerServing.sodium_mg * servings) : 0
    };

    // Create diary entry
    const entry = {
      id: `diary_${Date.now()}`,
      userId,
      dateLocal,
      mealSlot,
      foodId,
      foodName: food.name,
      brand: food.brand,
      barcode,
      servingLabel,
      servings,
      ...nutrition,
      createdAt: new Date().toISOString()
    };

    // TODO: Save to database when schema is available
    console.log(`✅ Food logged successfully:`, entry);
    
    // Get updated totals
    const totals = await getDayTotals(userId, dateLocal);
    
    return {
      entry,
      totals
    };
  } catch (error: any) {
    console.error("Error logging food:", error);
    throw new Error(`Failed to log food: ${error?.message || error}`);
  }
}

export async function addNewFood(params: AddNewFoodParams): Promise<FoodData> {
  const { barcode, name, brand, servingLabel, servingGrams, nutrition } = params;
  
  try {
    console.log(`➕ Adding new food: ${name}`);
    
    const food: FoodData = {
      id: `user_${Date.now()}`,
      barcode,
      name,
      brand,
      servingSizes: [
        { label: servingLabel, grams: servingGrams }
      ],
      nutrPerServing: nutrition,
      verified: false,
      source: 'user'
    };

    // TODO: Save to database when schema is available
    console.log(`✅ New food added:`, food);
    
    return food;
  } catch (error: any) {
    console.error("Error adding new food:", error);
    throw new Error(`Failed to add new food: ${error?.message || error}`);
  }
}

export async function getDayTotals(userId: string, dateLocal: string) {
  try {
    console.log(`📊 Getting day totals for user ${userId} on ${dateLocal}`);
    
    // TODO: Query database when schema is available
    // For now, return mock data
    const totals = {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      entries: 0
    };

    console.log(`📊 Day totals:`, totals);
    return totals;
  } catch (error: any) {
    console.error("Error getting day totals:", error);
    throw new Error(`Failed to get day totals: ${error?.message || error}`);
  }
}

// Helper function to search for foods by name (for manual entry)
export async function searchFoods(query: string, limit: number = 10): Promise<FoodData[]> {
  try {
    console.log(`🔍 Searching foods: ${query}`);
    
    // Search in mock database first
    const mockResults = Object.values(MOCK_FOOD_DATABASE).filter(food =>
      food.name.toLowerCase().includes(query.toLowerCase()) ||
      (food.brand && food.brand.toLowerCase().includes(query.toLowerCase()))
    );

    // TODO: Add database search when schema is available
    // TODO: Add OpenFoodFacts text search
    
    console.log(`🔍 Found ${mockResults.length} results for "${query}"`);
    return mockResults.slice(0, limit);
  } catch (error: any) {
    console.error("Error searching foods:", error);
    throw new Error(`Failed to search foods: ${error?.message || error}`);
  }
}