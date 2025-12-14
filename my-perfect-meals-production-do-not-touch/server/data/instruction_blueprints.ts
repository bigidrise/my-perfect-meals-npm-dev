// server/data/instruction_blueprints.ts
// Deterministic instruction blueprints for consistent cooking instructions

export interface Blueprint {
  id: string;
  name: string;
  slots: string[];
  portions: Record<string, number>;
  steps: string[];
  cookPattern?: string;
}

// Ingredient properties for token replacement
export const INGREDIENT_PROPERTIES: Record<string, any> = {
  // Proteins
  chicken: { safe_temp_f: 165, sear_time_min: 6, sear_time_max: 8 },
  beef: { safe_temp_f: 145, sear_time_min: 3, sear_time_max: 5 },
  pork: { safe_temp_f: 145, sear_time_min: 4, sear_time_max: 6 },
  turkey: { safe_temp_f: 165, sear_time_min: 5, sear_time_max: 7 },
  salmon: { safe_temp_f: 145, sear_time_min: 3, sear_time_max: 4 },
  shrimp: { safe_temp_f: 145, sear_time_min: 2, sear_time_max: 3 },
  tofu: { safe_temp_f: null, sear_time_min: 3, sear_time_max: 5 },
  eggs: { safe_temp_f: 160, sear_time_min: 2, sear_time_max: 3 },
  
  // Vegetables
  broccoli: { cook_time_min: 4, cook_time_max: 6 },
  asparagus: { cook_time_min: 3, cook_time_max: 5 },
  carrots: { cook_time_min: 5, cook_time_max: 8 },
  spinach: { cook_time_min: 1, cook_time_max: 2 },
  
  // Common oils
  "olive oil": { smoke_point_f: 375 },
  "vegetable oil": { smoke_point_f: 400 },
  "avocado oil": { smoke_point_f: 520 }
};

// Blueprint registry for consistent instructions
export const INSTRUCTION_BLUEPRINTS: Record<string, Blueprint> = {
  "one_pan_stir_fry": {
    id: "one_pan_stir_fry.v1",
    name: "One Pan Stir Fry",
    slots: ["protein", "veg", "carb?", "fat", "condiment?"],
    portions: { protein_g: 150, veg_c: 2, carb_cooked_c: 0.75, fat_tbsp: 1 },
    steps: [
      "Heat large skillet or wok over medium-high heat.",
      "Add ${fat.amount} ${fat.name}. Heat until shimmering.",
      "Add ${protein.amount} ${protein.name}. Cook ${protein.sear_time_min}–${protein.sear_time_max} minutes per side until internal temperature reaches ${protein.safe_temp_f}°F.",
      "Add ${veg.amount} ${veg.name}. Stir-fry ${veg.cook_time_min}–${veg.cook_time_max} minutes until tender-crisp.",
      "${condiment?.name|Season with salt and pepper to taste}.",
      "Serve ${carb?.name|hot} immediately."
    ]
  },

  "sheet_pan_roast": {
    id: "sheet_pan_roast.v1", 
    name: "Sheet Pan Roast",
    slots: ["protein", "veg", "fat", "seasoning?"],
    portions: { protein_g: 180, veg_c: 2.5, fat_tbsp: 1.5 },
    steps: [
      "Preheat oven to 425°F (220°C). Line a large sheet pan with parchment paper.",
      "In a large bowl, toss ${protein.amount} ${protein.name} and ${veg.amount} ${veg.name} with ${fat.amount} ${fat.name}.",
      "${seasoning?.name|Season generously with salt and pepper}.",
      "Arrange in single layer on prepared sheet pan, ensuring protein and vegetables aren't overcrowded.",
      "Roast 18–25 minutes until protein reaches ${protein.safe_temp_f}°F and vegetables are tender and lightly caramelized.",
      "Let rest 2-3 minutes before serving."
    ]
  },

  "classic_omelet": {
    id: "classic_omelet.v1",
    name: "Classic Omelet",
    slots: ["eggs", "filling?", "fat", "herb?"],
    portions: { eggs_count: 3, filling_c: 0.5, fat_tbsp: 1 },
    steps: [
      "Crack ${eggs.amount} eggs into a bowl. Whisk until well combined.",
      "Heat ${fat.amount} ${fat.name} in an 8-inch non-stick pan over medium-low heat.",
      "Pour in eggs. Using a spatula, gently push edges toward center while tilting pan to let uncooked egg flow underneath.",
      "When eggs are almost set but still slightly wet on top (about 2-3 minutes), add ${filling?.amount} ${filling?.name} to one half.",
      "Fold omelet in half and slide onto plate.",
      "Garnish with ${herb?.name|fresh herbs} if desired."
    ]
  },

  "pasta_with_sauce": {
    id: "pasta_with_sauce.v1",
    name: "Pasta with Sauce",
    slots: ["pasta", "protein?", "sauce", "veg?", "fat"],
    portions: { pasta_g: 100, protein_g: 120, sauce_c: 0.75, veg_c: 1, fat_tbsp: 1 },
    steps: [
      "Bring large pot of salted water to boil. Add ${pasta.amount} ${pasta.name} and cook according to package directions until al dente.",
      "Meanwhile, heat ${fat.amount} ${fat.name} in large skillet over medium heat.",
      "${protein?.amount ? 'Add ' + protein.amount + ' ' + protein.name + '. Cook until done (' + protein.safe_temp_f + '°F). Remove and set aside.' : ''}",
      "${veg?.amount ? 'Add ' + veg.amount + ' ' + veg.name + '. Sauté until tender.' : ''}",
      "Add ${sauce.amount} ${sauce.name}. Simmer 2-3 minutes.",
      "Drain pasta, reserving ½ cup pasta water. Add pasta to skillet with sauce.",
      "${protein?.name ? 'Return ' + protein.name + ' to pan.' : ''} Toss to combine, adding pasta water if needed.",
      "Serve immediately with freshly ground black pepper."
    ]
  },

  "grain_bowl": {
    id: "grain_bowl.v1",
    name: "Grain Bowl",
    slots: ["grain", "protein", "veg", "sauce", "garnish?"],
    portions: { grain_cooked_c: 1, protein_g: 150, veg_c: 1.5, sauce_tbsp: 2 },
    steps: [
      "Prepare ${grain.amount} ${grain.name} according to package instructions. Keep warm.",
      "Heat medium skillet over medium-high heat with a drizzle of oil.",
      "Cook ${protein.amount} ${protein.name} until done (${protein.safe_temp_f}°F). Let rest, then slice if needed.",
      "In same pan, quickly sauté ${veg.amount} ${veg.name} until tender-crisp.",
      "Divide warm ${grain.name} between bowls.",
      "Top with cooked ${protein.name} and ${veg.name}.",
      "Drizzle with ${sauce.amount} ${sauce.name}.",
      "Garnish with ${garnish?.name|fresh herbs or seeds} if desired."
    ]
  },

  "soup_stew": {
    id: "soup_stew.v1",
    name: "Soup or Stew",
    slots: ["protein", "veg", "liquid", "seasoning", "thickener?"],
    portions: { protein_g: 150, veg_c: 2, liquid_c: 2, seasoning_tsp: 1 },
    steps: [
      "Heat large pot or Dutch oven over medium heat with a drizzle of oil.",
      "Add ${protein.amount} ${protein.name}. Cook until browned on all sides.",
      "Add ${veg.amount} ${veg.name}. Cook 5 minutes until softened.",
      "Add ${liquid.amount} ${liquid.name} and ${seasoning.amount} ${seasoning.name}.",
      "Bring to boil, then reduce heat and simmer 20-30 minutes until protein is tender (${protein.safe_temp_f}°F).",
      "${thickener?.amount ? 'Stir in ' + thickener.amount + ' ' + thickener.name + ' to thicken if desired.' : ''}",
      "Taste and adjust seasoning. Serve hot."
    ]
  }
};

// Helper function to find best blueprint match
export function findBestBlueprint(meal: any): Blueprint | null {
  const mealName = (meal.name || meal.title || "").toLowerCase();
  const tags = meal.tags || meal.badges || [];
  
  // Direct pattern matching
  if (mealName.includes("stir fry") || mealName.includes("stir-fry")) {
    return INSTRUCTION_BLUEPRINTS.one_pan_stir_fry;
  }
  if (mealName.includes("sheet pan") || mealName.includes("roast")) {
    return INSTRUCTION_BLUEPRINTS.sheet_pan_roast;
  }
  if (mealName.includes("omelet") || mealName.includes("omelette")) {
    return INSTRUCTION_BLUEPRINTS.classic_omelet;
  }
  if (mealName.includes("pasta") && (mealName.includes("sauce") || tags.includes("pasta"))) {
    return INSTRUCTION_BLUEPRINTS.pasta_with_sauce;
  }
  if (mealName.includes("bowl") || tags.includes("grain-bowl")) {
    return INSTRUCTION_BLUEPRINTS.grain_bowl;
  }
  if (mealName.includes("soup") || mealName.includes("stew") || mealName.includes("chili")) {
    return INSTRUCTION_BLUEPRINTS.soup_stew;
  }
  
  // Tag-based matching
  if (tags.includes("sheet-pan")) return INSTRUCTION_BLUEPRINTS.sheet_pan_roast;
  if (tags.includes("stir-fry")) return INSTRUCTION_BLUEPRINTS.one_pan_stir_fry;
  if (tags.includes("one-pan")) return INSTRUCTION_BLUEPRINTS.one_pan_stir_fry;
  
  return null;
}