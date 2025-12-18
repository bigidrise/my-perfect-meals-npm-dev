// Per 100g unless noted
export type Macro = { calories: number; protein: number; carbs: number; fat: number };
export type MacroTable = Record<string, Macro & { unit?: "g" | "ml" | "unit"; unitSize?: number }>;

export const INGREDIENT_MACROS: MacroTable = {
  // Proteins
  "chicken breast":         { calories: 165, protein: 31, carbs: 0,  fat: 3.6 },
  "chicken":                { calories: 165, protein: 31, carbs: 0,  fat: 3.6 },
  "chicken thighs":         { calories: 209, protein: 26, carbs: 0,  fat: 11 },
  "turkey breast":          { calories: 135, protein: 29, carbs: 0,  fat: 1.0 },
  "turkey":                 { calories: 135, protein: 29, carbs: 0,  fat: 1.0 },
  "ground turkey":          { calories: 150, protein: 28, carbs: 0,  fat: 3.5 },
  "ground beef":            { calories: 250, protein: 26, carbs: 0,  fat: 17 },
  "lean beef":              { calories: 180, protein: 26, carbs: 0,  fat: 8.0 },
  "steak":                  { calories: 200, protein: 26, carbs: 0,  fat: 10 },
  "pork chops":             { calories: 242, protein: 27, carbs: 0,  fat: 14 },
  "pork tenderloin":        { calories: 143, protein: 26, carbs: 0,  fat: 3.5 },
  "salmon":                 { calories: 208, protein: 20, carbs: 0,  fat: 13 },
  "tuna":                   { calories: 132, protein: 28, carbs: 0,  fat: 1.3 },
  "cod":                    { calories: 82,  protein: 18, carbs: 0,  fat: 0.7 },
  "tilapia":                { calories: 96,  protein: 20, carbs: 0,  fat: 1.7 },
  "shrimp":                 { calories: 85,  protein: 20, carbs: 0,  fat: 1.0 },
  "tofu, firm":             { calories: 144, protein: 15, carbs: 3.5, fat: 8.0 },
  "tofu":                   { calories: 144, protein: 15, carbs: 3.5, fat: 8.0 },
  "eggs":                   { calories: 155, protein: 13, carbs: 1.1, fat: 11, unit:"unit", unitSize: 50 },
  "egg whites":             { calories: 52,  protein: 11, carbs: 0.7, fat: 0.2 },
  "greek yogurt":           { calories: 100, protein: 10, carbs: 4.0, fat: 6.0 },
  "cottage cheese":         { calories: 98,  protein: 11, carbs: 3.4, fat: 4.3 },
  "salmon fillet":          { calories: 208, protein: 20, carbs: 0,  fat: 13 },
  "cod fillet":             { calories: 82,  protein: 18, carbs: 0,  fat: 0.7 },
  "white fish fillet":      { calories: 82,  protein: 18, carbs: 0,  fat: 0.7 },
  "extra-lean ground turkey": { calories: 120, protein: 26, carbs: 0, fat: 2.0 },
  "beef strips":            { calories: 180, protein: 26, carbs: 0,  fat: 8.0 },
  "shrimp, peeled":         { calories: 85,  protein: 20, carbs: 0,  fat: 1.0 },

  // Carbs/Starches (cooked)
  "jasmine rice (cooked)":  { calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  "brown rice (cooked)":    { calories: 112, protein: 2.3, carbs: 23, fat: 0.9 },
  "white rice (cooked)":    { calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  "rice (cooked)":          { calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  "quinoa (cooked)":        { calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  "whole-wheat pasta (cooked)": { calories: 124, protein: 5.5, carbs: 26, fat: 0.9 },
  "sweet potato (roasted)": { calories: 90,  protein: 2.0, carbs: 21, fat: 0.1 },
  "sweet potato":           { calories: 86,  protein: 1.6, carbs: 20, fat: 0.1 },
  "sweet potatoes":         { calories: 86,  protein: 1.6, carbs: 20, fat: 0.1 },
  "yams":                   { calories: 118, protein: 1.5, carbs: 28, fat: 0.2 },
  "yam":                    { calories: 118, protein: 1.5, carbs: 28, fat: 0.2 },
  "potato":                 { calories: 77,  protein: 2.0, carbs: 17, fat: 0.1 },
  "potatoes":               { calories: 77,  protein: 2.0, carbs: 17, fat: 0.1 },
  "cooked jasmine rice":    { calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  "cooked brown rice":      { calories: 112, protein: 2.3, carbs: 23, fat: 0.9 },
  "cooked quinoa":          { calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  "cooked farro":           { calories: 115, protein: 3.5, carbs: 23, fat: 0.8 },
  "oats":                   { calories: 389, protein: 17, carbs: 66, fat: 7.0 },
  "oatmeal":                { calories: 71,  protein: 2.5, carbs: 12, fat: 1.5 },
  "pasta":                  { calories: 131, protein: 5.0, carbs: 25, fat: 1.1 },
  "bread":                  { calories: 265, protein: 9.0, carbs: 49, fat: 3.2 },
  "cauliflower rice":       { calories: 25,  protein: 2.0, carbs: 5,  fat: 0.3 },
  "zucchini noodles":       { calories: 20,  protein: 2.0, carbs: 4,  fat: 0.3 },

  // Fats & dressings
  "olive oil":              { calories: 884, protein: 0,  carbs: 0,  fat: 100 },
  "avocado":                { calories: 160, protein: 2.0, carbs: 9.0, fat: 15 },
  "nuts (mixed)":           { calories: 607, protein: 20, carbs: 16, fat: 54 },
  "walnuts":                { calories: 654, protein: 15, carbs: 14, fat: 65 },
  "almond butter":          { calories: 614, protein: 21, carbs: 19, fat: 56 },

  // Veg (non-starchy)
  "broccoli":               { calories: 35,  protein: 2.4, carbs: 7.2, fat: 0.4 },
  "spinach":                { calories: 23,  protein: 2.9, carbs: 3.6, fat: 0.4 },
  "asparagus":              { calories: 20,  protein: 2.2, carbs: 3.9, fat: 0.1 },
  "bell pepper":            { calories: 31,  protein: 1.0, carbs: 6.0, fat: 0.3 },
  "mixed greens":           { calories: 15,  protein: 1.4, carbs: 2.9, fat: 0.2 },
  "cucumber":               { calories: 16,  protein: 0.7, carbs: 4.0, fat: 0.1 },
  "tomato":                 { calories: 18,  protein: 0.9, carbs: 3.9, fat: 0.2 },
  "mixed veg":              { calories: 30,  protein: 2.0, carbs: 6.0, fat: 0.3 },
  "stir-fry veg mix":       { calories: 30,  protein: 2.0, carbs: 6.0, fat: 0.3 },
  "roasted veg mix":        { calories: 35,  protein: 2.0, carbs: 7.0, fat: 0.5 },

  // Legumes
  "chickpeas":              { calories: 164, protein: 8.0, carbs: 27, fat: 2.6 },
  "kidney beans":           { calories: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  "black beans":            { calories: 132, protein: 8.9, carbs: 23, fat: 0.5 },
  "lentils":                { calories: 116, protein: 9.0, carbs: 20, fat: 0.4 },
  "dry lentils":            { calories: 352, protein: 25, carbs: 60, fat: 1.1 },

  // Dairy & alternatives
  "Greek yogurt":           { calories: 100, protein: 10, carbs: 4.0, fat: 6.0 },
  "feta":                   { calories: 264, protein: 14, carbs: 4.1, fat: 21 },
  "mozzarella":             { calories: 300, protein: 22, carbs: 2.2, fat: 22 },
  "almond milk":            { calories: 17,  protein: 0.6, carbs: 1.5, fat: 1.4 },
  "soy protein powder":     { calories: 400, protein: 80, carbs: 10, fat: 5.0 }
};