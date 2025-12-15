export type PresetMeal = {
  id: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  tags: string[];
};

export const MEN_PRESETS: PresetMeal[] = [
  // Breakfast
  { id:"m-bf-1", name:"Egg & veggie omelet + oats", slot:"breakfast", tags:["protein-forward","high-fiber-carb"] },
  { id:"m-bf-2", name:"Greek yogurt bowl + walnuts + berries", slot:"breakfast", tags:["protein-forward","omega-3"] },
  { id:"m-bf-3", name:"Breakfast burrito (eggs/beans/cheese)", slot:"breakfast", tags:["protein-forward","high-fiber-carb"] },
  { id:"m-bf-4", name:"Cottage cheese + pineapple + almonds", slot:"breakfast", tags:["protein-forward"] },
  { id:"m-bf-5", name:"Protein smoothie (milk/yogurt + berries + oats)", slot:"breakfast", tags:["protein-forward","high-fiber-carb"] },

  // Lunch
  { id:"m-lu-1", name:"Lean steak + quinoa + broccoli (1–2×/wk)", slot:"lunch", tags:["protein-forward","zinc-rich"] },
  { id:"m-lu-2", name:"Chicken/shrimp fajita bowl (beans, peppers, avocado)", slot:"lunch", tags:["protein-forward","high-fiber-carb"] },
  { id:"m-lu-3", name:"Tuna or salmon whole-grain pasta salad", slot:"lunch", tags:["omega-3","high-fiber-carb"] },
  { id:"m-lu-4", name:"Turkey wrap + hummus + veg + fruit", slot:"lunch", tags:["protein-forward","lower-added-sugar"] },
  { id:"m-lu-5", name:"Lentil bowl + olive oil + feta", slot:"lunch", tags:["high-fiber-carb","protein-veg-first"] },

  // Dinner
  { id:"m-di-1", name:"Salmon + potatoes + asparagus", slot:"dinner", tags:["omega-3","protein-veg-first"] },
  { id:"m-di-2", name:"Turkey burgers + slaw + roasted potatoes", slot:"dinner", tags:["protein-forward"] },
  { id:"m-di-3", name:"Bean & beef chili + side salad", slot:"dinner", tags:["protein-forward","high-fiber-carb"] },
  { id:"m-di-4", name:"Sheet-pan chicken thighs + sweet potatoes + greens", slot:"dinner", tags:["protein-forward"] },
  { id:"m-di-5", name:"Tofu/tempeh stir-fry + brown rice", slot:"dinner", tags:["high-fiber-carb","protein-veg-first"] },

  // Snacks
  { id:"m-sn-1", name:"Jerky + fruit", slot:"snack", tags:["protein-forward","lower-added-sugar"] },
  { id:"m-sn-2", name:"Cottage cheese + berries", slot:"snack", tags:["protein-forward"] },
  { id:"m-sn-3", name:"Apple + peanut butter", slot:"snack", tags:["slow-release","lower-added-sugar"] },
  { id:"m-sn-4", name:"Mixed nuts (small handful)", slot:"snack", tags:["magnesium-friendly"] },
  { id:"m-sn-5", name:"Edamame cup", slot:"snack", tags:["protein-forward","high-fiber-carb"] },
];
