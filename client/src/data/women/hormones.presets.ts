export type PresetMeal = {
  id: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  tags: string[];
  calories?: number;
  protein_g?: number; 
  carbs_g?: number; 
  fat_g?: number;
};

export const WOMEN_PRESETS: PresetMeal[] = [
  // Breakfasts
  { id:"w-bf-1", name:"Greek yogurt + berries + 2 tbsp flax", slot:"breakfast", tags:["protein-forward","high-fiber-carb","phyto-friendly"] },
  { id:"w-bf-2", name:"Veggie egg scramble + oats", slot:"breakfast", tags:["protein-forward","slow-release"] },
  { id:"w-bf-3", name:"Overnight oats + chia + peanut butter", slot:"breakfast", tags:["high-fiber-carb","slow-release"] },
  { id:"w-bf-4", name:"Cottage cheese bowl + pineapple + walnuts", slot:"breakfast", tags:["protein-forward","omega-3"] },
  { id:"w-bf-5", name:"Protein smoothie (yogurt/milk + berries + chia)", slot:"breakfast", tags:["protein-forward","omega-3","high-fiber-carb"] },
  { id:"w-bf-6", name:"Avocado toast (sprouted) + 2 eggs", slot:"breakfast", tags:["protein-calcium","phyto-friendly"] },
  { id:"w-bf-7", name:"High-fiber cereal + milk + almonds", slot:"breakfast", tags:["high-fiber-carb","protein-calcium"] },

  // Lunch
  { id:"w-lu-1", name:"Salmon + quinoa bowl + greens + olive oil", slot:"lunch", tags:["omega-3","high-fiber-carb","protein-veg-first"] },
  { id:"w-lu-2", name:"Rotisserie chicken salad + chickpeas + vinaigrette", slot:"lunch", tags:["protein-forward","high-fiber-carb"] },
  { id:"w-lu-3", name:"Lentil bowl + roasted veg + avocado", slot:"lunch", tags:["phyto-friendly","high-fiber-carb"] },
  { id:"w-lu-4", name:"Turkey wrap + hummus + veg + fruit", slot:"lunch", tags:["protein-forward","slow-release"] },
  { id:"w-lu-5", name:"Tofu/tempeh stir-fry + brown rice", slot:"lunch", tags:["phyto-friendly","high-fiber-carb"] },

  // Dinner
  { id:"w-di-1", name:"Shrimp stir-fry + brown rice", slot:"dinner", tags:["protein-forward","slow-release"] },
  { id:"w-di-2", name:"Turkey chili (beans) + side salad", slot:"dinner", tags:["protein-forward","high-fiber-carb"] },
  { id:"w-di-3", name:"Baked tofu + broccoli + soba", slot:"dinner", tags:["phyto-friendly","high-fiber-carb"] },
  { id:"w-di-4", name:"Chicken thighs + sweet potato + greens", slot:"dinner", tags:["protein-forward","slow-release"] },
  { id:"w-di-5", name:"Salmon + potatoes + asparagus", slot:"dinner", tags:["omega-3","protein-veg-first"] },

  // Snacks
  { id:"w-sn-1", name:"Edamame cup", slot:"snack", tags:["phyto-friendly","protein-forward"] },
  { id:"w-sn-2", name:"Apple + almonds", slot:"snack", tags:["slow-release","high-fiber-carb"] },
  { id:"w-sn-3", name:"Cottage cheese + berries", slot:"snack", tags:["protein-forward"] },
  { id:"w-sn-4", name:"Hummus + carrots/peppers", slot:"snack", tags:["phyto-friendly","high-fiber-carb"] },
  { id:"w-sn-5", name:"Protein bar (≤10g added sugar)", slot:"snack", tags:["lower-added-sugar","protein-forward"] },
];
