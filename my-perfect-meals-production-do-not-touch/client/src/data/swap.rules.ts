export type Slot = "protein" | "carb" | "fat" | "veg";

export const SWAP_OPTIONS: Record<Slot, string[]> = {
  protein: [
    "chicken breast", 
    "turkey breast", 
    "salmon fillet", 
    "cod fillet", 
    "tofu, firm", 
    "eggs",
    "extra-lean ground turkey",
    "beef strips",
    "shrimp, peeled"
  ],
  carb: [
    "cooked jasmine rice",
    "cooked brown rice", 
    "cooked quinoa", 
    "whole-wheat pasta (cooked)", 
    "sweet potato (roasted)",
    "cooked farro",
    "cauliflower rice",
    "zucchini noodles"
  ],
  fat: [
    "olive oil", 
    "avocado", 
    "nuts (mixed)",
    "walnuts",
    "almond butter"
  ],
  veg: [
    "broccoli", 
    "spinach", 
    "asparagus", 
    "bell pepper",
    "mixed greens",
    "cucumber",
    "tomato",
    "mixed veg",
    "stir-fry veg mix",
    "roasted veg mix"
  ],
};

export const ARCHETYPE_EXCLUDES: Record<string, Partial<Record<Slot,string[]>>> = {
  "HP/LC":     { 
    carb: ["whole-wheat pasta (cooked)", "cooked jasmine rice", "cooked brown rice", "cooked farro"] 
  },
  "Diabetic":  { 
    carb: ["cooked jasmine rice"], 
    fat: [], 
    protein: [], 
    veg: [] 
  },
  "Vegan":     { 
    protein: ["chicken breast", "turkey breast", "salmon fillet", "cod fillet", "eggs", "extra-lean ground turkey", "beef strips", "shrimp, peeled"] 
  },
  "Vegetarian": { 
    protein: ["chicken breast", "turkey breast", "salmon fillet", "cod fillet", "extra-lean ground turkey", "beef strips", "shrimp, peeled"] 
  },
  "Paleo":     { 
    carb: ["whole-wheat pasta (cooked)", "cooked brown rice", "cooked farro"] 
  },
};

export const MEDICAL_BLOCKERS: Record<string,string[]> = {
  nutAllergy: ["nuts (mixed)", "walnuts", "almond butter"],
  seafoodAllergy: ["salmon fillet", "cod fillet", "shrimp, peeled"],
  eggAllergy: ["eggs"],
  soyAllergy: ["tofu, firm", "soy protein powder"],
};