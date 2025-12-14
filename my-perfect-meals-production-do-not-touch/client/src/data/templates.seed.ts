// client/src/data/templates.seed.ts
// 40 templates: HP/LC, HP/HC, Balanced, Diabetic-Friendly, Vegetarian, Vegan, Paleo, Mediterranean (5 each)
// All quantities are per 1 serving (baseServings=1). Scaling handled by UI.
// Nutrition values are pragmatic estimates.

import type { MealTemplateBase } from "@/data/models";

export const TEMPLATES_SEED: MealTemplateBase[] = [
  // ========================= HP/LC (High Protein / Low Carb) =========================
  {
    id: "tpl-hplc-001",
    name: "Grilled Chicken + Garlicky Greens",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-chicken-greens.png",
    summary: "Lean chicken, sautéed garlic spinach, olive oil finish.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 170, unit: "g" },
      { name: "spinach", quantity: 120, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "garlic, minced", quantity: 1, unit: "clove" },
      { name: "salt", quantity: 0.25, unit: "tsp" },
      { name: "black pepper", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Season chicken with salt/pepper; grill or pan-sear 4–6 min/side.",
      "Sauté garlic in oil 30 sec; add spinach until wilted.",
      "Rest chicken 2 min; plate with greens and pan juices."
    ],
    nutritionPerServing: { calories: 380, protein: 55, carbs: 6, fat: 14 },
    badges: ["High protein", "Low carb"],
    source: "template"
  },
  {
    id: "tpl-hplc-002",
    name: "Salmon & Lemon-Herb Asparagus",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-salmon-asparagus.jpg",
    summary: "Omega-3 salmon with crisp-tender asparagus.",
    baseServings: 1,
    ingredients: [
      { name: "salmon fillet", quantity: 170, unit: "g" },
      { name: "asparagus", quantity: 140, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "lemon", quantity: 0.25, unit: "unit" },
      { name: "dill or parsley", quantity: 1, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" },
      { name: "pepper", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Roast salmon at 400°F/205°C for 10–12 min.",
      "Toss asparagus with oil/salt/pepper; roast 8–10 min.",
      "Finish with lemon squeeze and herbs."
    ],
    nutritionPerServing: { calories: 430, protein: 40, carbs: 7, fat: 28 },
    badges: ["High protein", "Low carb", "Omega-3"],
    source: "template"
  },
  {
    id: "tpl-hplc-003",
    name: "Turkey Lettuce Wraps (Asian-Style)",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-turkey-wraps.jpg",
    summary: "Savory ground turkey with crunchy lettuce cups.",
    baseServings: 1,
    ingredients: [
      { name: "extra-lean ground turkey", quantity: 150, unit: "g" },
      { name: "romaine or butter lettuce cups", quantity: 4, unit: "leaves" },
      { name: "low-sodium soy or tamari", quantity: 1, unit: "tbsp" },
      { name: "rice vinegar", quantity: 1, unit: "tsp" },
      { name: "garlic + ginger, minced", quantity: 1, unit: "tsp" },
      { name: "green onion", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Brown turkey with garlic/ginger; add soy and vinegar.",
      "Spoon into lettuce cups; top with green onion.",
      "Optional: chili flakes for heat."
    ],
    nutritionPerServing: { calories: 320, protein: 38, carbs: 9, fat: 14 },
    badges: ["High protein", "Lower sodium"],
    source: "template"
  },
  {
    id: "tpl-hplc-004",
    name: "Egg White Scramble + Veg & Feta",
    archetype: "HP/LC",
    mealType: "breakfast",
    image: "/images/templates/hplc-eggwhite-feta.jpg",
    summary: "Fluffy egg whites, sautéed veg, feta crumble.",
    baseServings: 1,
    ingredients: [
      { name: "egg whites", quantity: 200, unit: "ml" },
      { name: "bell pepper + onion, diced", quantity: 120, unit: "g" },
      { name: "feta, reduced fat", quantity: 20, unit: "g" },
      { name: "olive oil spray", quantity: 1, unit: "sec" },
      { name: "salt/pepper", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Sauté veg in light oil spray 3–4 min.",
      "Add whites; scramble until set.",
      "Top with feta; season to taste."
    ],
    nutritionPerServing: { calories: 240, protein: 30, carbs: 10, fat: 8 },
    badges: ["High protein", "Low carb"],
    source: "template"
  },
  {
    id: "tpl-hplc-005",
    name: "Greek Yogurt Bowl (Savory)",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-savory-yogurt.jpg",
    summary: "Thick yogurt with cucumbers, olive oil, herbs.",
    baseServings: 1,
    ingredients: [
      { name: "plain Greek yogurt (2%–5%)", quantity: 200, unit: "g" },
      { name: "cucumber, diced", quantity: 80, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "dill + mint", quantity: 1, unit: "tsp" },
      { name: "salt/pepper", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Stir herbs, cucumber, and pinch of salt into yogurt.",
      "Drizzle olive oil; crack pepper; serve cold."
    ],
    nutritionPerServing: { calories: 230, protein: 22, carbs: 9, fat: 12 },
    badges: ["High protein", "Low carb"],
    source: "template"
  },
  {
    id: "tpl-hplc-006",
    name: "Shrimp & Zucchini Noodles",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-shrimp-zoodles.jpg",
    summary: "Seared shrimp with spiralized zucchini, garlic oil.",
    baseServings: 1,
    ingredients: [
      { name: "shrimp, peeled", quantity: 180, unit: "g", role: "protein" },
      { name: "zucchini noodles", quantity: 200, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "garlic, minced", quantity: 2, unit: "clove" },
      { name: "red pepper flakes", quantity: 0.25, unit: "tsp" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Sear shrimp 2 min per side; set aside.",
      "Sauté garlic in oil 30 sec; add zoodles 2-3 min.",
      "Toss with shrimp, lemon, red pepper."
    ],
    nutritionPerServing: { calories: 320, protein: 38, carbs: 8, fat: 12 },
    badges: ["High protein", "Low carb", "Quick"],
    source: "template"
  },
  {
    id: "tpl-hplc-007",
    name: "Beef & Bell Pepper Stir-Fry",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-beef-peppers.jpg",
    summary: "Lean beef strips with colorful bell peppers.",
    baseServings: 1,
    ingredients: [
      { name: "beef strips", quantity: 160, unit: "g", role: "protein" },
      { name: "bell pepper", quantity: 180, unit: "g", role: "veg" },
      { name: "broccoli", quantity: 100, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "ginger, minced", quantity: 1, unit: "tsp" },
      { name: "low-sodium soy sauce", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Stir-fry beef in oil 3-4 min; remove.",
      "Stir-fry peppers and broccoli 4-5 min.",
      "Return beef; add ginger and soy; toss."
    ],
    nutritionPerServing: { calories: 410, protein: 42, carbs: 12, fat: 22 },
    badges: ["High protein", "Low carb", "Iron"],
    source: "template"
  },
  {
    id: "tpl-hplc-008",
    name: "Cod with Roasted Brussels Sprouts",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-cod-brussels.jpg",
    summary: "Flaky white fish with caramelized Brussels sprouts.",
    baseServings: 1,
    ingredients: [
      { name: "cod fillet", quantity: 180, unit: "g", role: "protein" },
      { name: "Brussels sprouts", quantity: 200, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1.5, unit: "tsp", role: "fat" },
      { name: "balsamic vinegar", quantity: 1, unit: "tsp" },
      { name: "garlic powder", quantity: 0.5, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Halve Brussels sprouts; roast with oil at 425°F 15-20 min.",
      "Season cod; bake 12-15 min until flaky.",
      "Drizzle Brussels with balsamic; serve with cod."
    ],
    nutritionPerServing: { calories: 350, protein: 36, carbs: 14, fat: 18 },
    badges: ["High protein", "Low carb", "Vitamin C"],
    source: "template"
  },
  {
    id: "tpl-hplc-009",
    name: "Chicken & Cauliflower Rice",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-chicken-caulirice.jpg",
    summary: "Seasoned chicken with fluffy cauliflower rice base.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 160, unit: "g", role: "protein" },
      { name: "cauliflower rice", quantity: 180, unit: "g", role: "veg" },
      { name: "spinach", quantity: 80, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "onion powder", quantity: 0.5, unit: "tsp" },
      { name: "paprika", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Season chicken with spices; grill 6-8 min per side.",
      "Sauté cauliflower rice in oil 4-5 min.",
      "Wilt spinach; serve as bed for sliced chicken."
    ],
    nutritionPerServing: { calories: 370, protein: 49, carbs: 10, fat: 14 },
    badges: ["High protein", "Low carb", "Keto-friendly"],
    source: "template"
  },
  {
    id: "tpl-hplc-010",
    name: "Tuna-Stuffed Avocado",
    archetype: "HP/LC",
    mealType: "snack",
    image: "/images/templates/hplc-tuna-avocado.jpg",
    summary: "Fresh tuna salad in creamy avocado halves.",
    baseServings: 1,
    ingredients: [
      { name: "canned tuna in water", quantity: 140, unit: "g", role: "protein" },
      { name: "avocado", quantity: 1, unit: "unit", role: "fat" },
      { name: "mixed greens", quantity: 100, unit: "g", role: "veg" },
      { name: "cucumber", quantity: 80, unit: "g", role: "veg" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" },
      { name: "olive oil", quantity: 0.5, unit: "tsp", role: "fat" }
    ],
    instructions: [
      "Halve and pit avocado; scoop some flesh.",
      "Mix tuna with lemon, oil, and avocado flesh.",
      "Stuff avocado halves; serve over greens and cucumber."
    ],
    nutritionPerServing: { calories: 420, protein: 34, carbs: 12, fat: 28 },
    badges: ["High protein", "Low carb", "Healthy fats"],
    source: "template"
  },

  // ========================= HP/HC (High Protein / High Carb) =========================
  {
    id: "tpl-hphc-001",
    name: "Chicken Teriyaki Rice Bowl",
    archetype: "HP/HC",
    mealType: "lunch",
    image: "/images/templates/hphc-teriyaki-bowl.jpg",
    summary: "Grilled chicken, jasmine rice, steamed broccoli, light teriyaki.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 150, unit: "g" },
      { name: "cooked jasmine rice", quantity: 200, unit: "g" },
      { name: "broccoli florets", quantity: 120, unit: "g" },
      { name: "light teriyaki sauce", quantity: 1.5, unit: "tbsp" },
      { name: "sesame seeds (optional)", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Grill chicken; steam broccoli.",
      "Bowl rice; top with sliced chicken and broccoli.",
      "Drizzle teriyaki; sprinkle sesame."
    ],
    nutritionPerServing: { calories: 580, protein: 42, carbs: 75, fat: 10 },
    badges: ["High protein", "Fuel carbs"],
    source: "template"
  },
  {
    id: "tpl-hphc-002",
    name: "Turkey Bolognese Whole‑Wheat Pasta",
    archetype: "HP/HC",
    mealType: "snack",
    image: "/images/templates/hphc-bolognese.jpg",
    summary: "Lean turkey ragù, fiber‑rich pasta.",
    baseServings: 1,
    ingredients: [
      { name: "extra-lean ground turkey", quantity: 150, unit: "g" },
      { name: "whole‑wheat pasta (dry)", quantity: 70, unit: "g" },
      { name: "marinara (no added sugar)", quantity: 180, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "Italian herbs", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Brown turkey in oil; add marinara and herbs; simmer 5–10 min.",
      "Boil pasta until al dente; combine and serve."
    ],
    nutritionPerServing: { calories: 620, protein: 44, carbs: 78, fat: 14 },
    badges: ["High protein", "Whole grain"],
    source: "template"
  },
  {
    id: "tpl-hphc-003",
    name: "Honey‑Mustard Salmon Quinoa",
    archetype: "HP/HC",
    mealType: "dinner",
    image: "/images/templates/hphc-salmon-quinoa.jpg",
    summary: "Omega‑3 salmon, fluffy quinoa, sweet‑tang glaze.",
    baseServings: 1,
    ingredients: [
      { name: "salmon fillet", quantity: 150, unit: "g" },
      { name: "cooked quinoa", quantity: 180, unit: "g" },
      { name: "honey", quantity: 1, unit: "tsp" },
      { name: "Dijon mustard", quantity: 1, unit: "tsp" },
      { name: "lemon", quantity: 0.25, unit: "unit" }
    ],
    instructions: [
      "Whisk honey + Dijon; brush salmon; bake 400°F/205°C 10–12 min.",
      "Fluff quinoa; serve with lemon wedge."
    ],
    nutritionPerServing: { calories: 610, protein: 40, carbs: 63, fat: 22 },
    badges: ["High protein", "Fuel carbs", "Omega‑3"],
    source: "template"
  },
  {
    id: "tpl-hphc-004",
    name: "Breakfast Burrito (Egg + Potato)",
    archetype: "HP/HC",
    mealType: "breakfast",
    image: "/images/templates/hphc-breakfast-burrito.jpg",
    summary: "Eggs, roasted potatoes, whole‑grain tortilla, salsa.",
    baseServings: 1,
    ingredients: [
      { name: "eggs", quantity: 2, unit: "unit" },
      { name: "roasted potato cubes", quantity: 120, unit: "g" },
      { name: "whole‑grain tortilla (large)", quantity: 1, unit: "unit" },
      { name: "salsa", quantity: 2, unit: "tbsp" },
      { name: "part‑skim cheddar", quantity: 20, unit: "g" }
    ],
    instructions: [
      "Scramble eggs; warm tortilla.",
      "Fill with potatoes, eggs, cheese; roll; griddle 1–2 min.",
      "Serve with salsa."
    ],
    nutritionPerServing: { calories: 550, protein: 28, carbs: 62, fat: 20 },
    badges: ["Whole grain"],
    source: "template"
  },
  {
    id: "tpl-hphc-006",
    name: "Japanese-Style Rice Bowl (Tamago)",
    archetype: "HP/HC",
    mealType: "breakfast",
    image: "/images/templates/hphc-tamago-rice.jpg",
    summary: "Brown rice, scrambled eggs, edamame, nori, soy sauce.",
    baseServings: 1,
    ingredients: [
      { name: "cooked brown rice", quantity: 180, unit: "g", role: "carb" },
      { name: "eggs", quantity: 2, unit: "unit", role: "protein" },
      { name: "edamame", quantity: 80, unit: "g", role: "veg" },
      { name: "spinach", quantity: 60, unit: "g", role: "veg" },
      { name: "nori (seaweed)", quantity: 2, unit: "sheets" },
      { name: "low-sodium soy sauce", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Steam edamame and spinach; scramble eggs.",
      "Bowl warm rice; top with eggs, vegetables.",
      "Garnish with torn nori; drizzle soy sauce."
    ],
    nutritionPerServing: { calories: 520, protein: 26, carbs: 72, fat: 12 },
    badges: ["High protein", "International", "Whole grain"],
    source: "template"
  },

  // ========================= Balanced (approx. 30/30/40 or 25/30/45) =========================
  {
    id: "tpl-bal-001",
    name: "Mediterranean Chicken Bowl",
    archetype: "Balanced",
    mealType: "lunch",
    image: "/images/templates/bal-mediterranean-bowl.jpg",
    summary: "Chicken, brown rice, cucumber-tomato, olives, tzatziki.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 140, unit: "g" },
      { name: "cooked brown rice", quantity: 150, unit: "g" },
      { name: "cucumber + tomato", quantity: 120, unit: "g" },
      { name: "olives", quantity: 6, unit: "unit" },
      { name: "tzatziki", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Grill chicken; cube.",
      "Bowl rice; add veg, olives, chicken; dollop tzatziki."
    ],
    nutritionPerServing: { calories: 520, protein: 36, carbs: 52, fat: 18 },
    badges: ["Balanced", "Mediterranean"],
    source: "template"
  },
  {
    id: "tpl-bal-002",
    name: "Shrimp Stir‑Fry + Veg + Rice",
    archetype: "Balanced",
    mealType: "dinner",
    image: "/images/templates/bal-shrimp-stirfry.jpg",
    summary: "Quick sauté, colorful veg, light sauce, steamed rice.",
    baseServings: 1,
    ingredients: [
      { name: "shrimp, peeled", quantity: 160, unit: "g" },
      { name: "stir‑fry veg mix", quantity: 200, unit: "g" },
      { name: "cooked white rice", quantity: 150, unit: "g" },
      { name: "light soy + ginger + garlic", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Sear shrimp 1–2 min/side; remove.",
      "Stir‑fry veg; add light sauce; return shrimp; toss.",
      "Serve over rice."
    ],
    nutritionPerServing: { calories: 530, protein: 38, carbs: 60, fat: 12 },
    badges: ["Balanced"],
    source: "template"
  },
  {
    id: "tpl-bal-003",
    name: "Turkey Chili (Bean‑Forward)",
    archetype: "Balanced",
    mealType: "dinner",
    image: "/images/templates/bal-turkey-chili.jpg",
    summary: "Lean turkey, beans, tomatoes, warm spices.",
    baseServings: 1,
    ingredients: [
      { name: "extra‑lean ground turkey", quantity: 150, unit: "g" },
      { name: "kidney beans, rinsed", quantity: 120, unit: "g" },
      { name: "diced tomatoes", quantity: 200, unit: "g" },
      { name: "onion + chili spices", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Brown turkey; add onion and spices; stir.",
      "Add tomatoes and beans; simmer 15–20 min."
    ],
    nutritionPerServing: { calories: 520, protein: 42, carbs: 48, fat: 16 },
    badges: ["Balanced", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-bal-004",
    name: "Egg + Avocado Toast (Whole‑Grain)",
    archetype: "Balanced",
    mealType: "breakfast",
    image: "/images/templates/bal-avo-toast.jpg",
    summary: "Poached egg, mashed avocado, chili flakes, lemon.",
    baseServings: 1,
    ingredients: [
      { name: "whole-grain bread", quantity: 2, unit: "slices" },
      { name: "eggs", quantity: 1, unit: "unit" },
      { name: "avocado", quantity: 80, unit: "g" },
      { name: "lemon juice", quantity: 1, unit: "tsp" },
      { name: "chili flakes", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Toast bread; poach egg.",
      "Mash avocado with lemon; spread on toast; top with egg and chili flakes."
    ],
    nutritionPerServing: { calories: 480, protein: 20, carbs: 48, fat: 24 },
    badges: ["Balanced", "Whole grain"],
    source: "template"
  },
  {
    id: "tpl-bal-005",
    name: "Balanced Smoothie Bowl",
    archetype: "Balanced",
    mealType: "snack",
    image: "/images/templates/bal-smoothie-bowl.jpg",
    summary: "Protein powder, banana, berries, nuts, seeds.",
    baseServings: 1,
    ingredients: [
      { name: "protein powder", quantity: 25, unit: "g" },
      { name: "banana", quantity: 1, unit: "unit" },
      { name: "frozen berries", quantity: 100, unit: "g" },
      { name: "almond milk", quantity: 150, unit: "ml" },
      { name: "mixed nuts + seeds", quantity: 15, unit: "g" }
    ],
    instructions: [
      "Blend protein, banana, berries, almond milk.",
      "Pour into bowl; top with nuts and seeds."
    ],
    nutritionPerServing: { calories: 380, protein: 28, carbs: 40, fat: 12 },
    badges: ["Balanced", "High protein"],
    source: "template"
  },

  // ========================= Diabetic-Friendly =========================
  {
    id: "tpl-dia-001",
    name: "Grilled Chicken + Cauliflower Rice",
    archetype: "Diabetic",
    mealType: "dinner",
    image: "/images/templates/dia-chicken-cauliflower.jpg",
    summary: "Lean protein, low-GI cauliflower rice, steamed greens.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 160, unit: "g" },
      { name: "cauliflower rice", quantity: 200, unit: "g" },
      { name: "steamed broccoli", quantity: 120, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "herbs + spices", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Grill seasoned chicken; steam broccoli.",
      "Sauté cauliflower rice with herbs.",
      "Plate with olive oil drizzle."
    ],
    nutritionPerServing: { calories: 420, protein: 44, carbs: 18, fat: 16 },
    badges: ["Low-GI", "High protein", "Diabetic-friendly"],
    source: "template"
  },
  {
    id: "tpl-dia-002",
    name: "Lentil Soup (Low-Sodium)",
    archetype: "Diabetic",
    mealType: "lunch",
    image: "/images/templates/dia-lentil-soup.jpg",
    summary: "Fiber-rich lentils, vegetables, low-sodium broth.",
    baseServings: 1,
    ingredients: [
      { name: "dry lentils", quantity: 80, unit: "g" },
      { name: "carrots + celery + onion", quantity: 180, unit: "g" },
      { name: "low-sodium vegetable broth", quantity: 300, unit: "ml" },
      { name: "herbs (no salt)", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Simmer lentils and veg in broth 25–30 min.",
      "Season with herbs; serve hot."
    ],
    nutritionPerServing: { calories: 360, protein: 20, carbs: 52, fat: 4 },
    badges: ["Low-GI", "High fiber", "Low sodium"],
    source: "template"
  },
  {
    id: "tpl-dia-003",
    name: "Greek Salad + Grilled Fish",
    archetype: "Diabetic",
    mealType: "lunch",
    image: "/images/templates/dia-greek-salad.jpg",
    summary: "Mixed greens, tomato, cucumber, olives, feta, grilled fish.",
    baseServings: 1,
    ingredients: [
      { name: "white fish fillet", quantity: 150, unit: "g" },
      { name: "mixed greens", quantity: 120, unit: "g" },
      { name: "cucumber + tomato", quantity: 120, unit: "g" },
      { name: "olives", quantity: 6, unit: "unit" },
      { name: "feta (reduced fat)", quantity: 20, unit: "g" },
      { name: "olive oil + lemon", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Grill fish; assemble salad with veg, olives, feta.",
      "Top with fish; drizzle olive oil and lemon."
    ],
    nutritionPerServing: { calories: 380, protein: 34, carbs: 12, fat: 22 },
    badges: ["Low-GI", "Heart healthy", "Omega-3"],
    source: "template"
  },
  {
    id: "tpl-dia-004",
    name: "Veggie Omelet (Sugar-Free)",
    archetype: "Diabetic",
    mealType: "breakfast",
    image: "/images/templates/dia-veggie-omelet.jpg",
    summary: "Eggs, bell peppers, spinach, low-fat cheese.",
    baseServings: 1,
    ingredients: [
      { name: "eggs", quantity: 2, unit: "unit" },
      { name: "bell peppers + spinach", quantity: 120, unit: "g" },
      { name: "low-fat cheese", quantity: 20, unit: "g" },
      { name: "olive oil spray", quantity: 1, unit: "sec" }
    ],
    instructions: [
      "Sauté veg in oil spray; beat eggs; pour over veg.",
      "Add cheese; fold omelet; serve."
    ],
    nutritionPerServing: { calories: 320, protein: 24, carbs: 8, fat: 20 },
    badges: ["Low-GI", "High protein", "Low carb"],
    source: "template"
  },
  {
    id: "tpl-dia-005",
    name: "Chia Pudding (Unsweetened)",
    archetype: "Diabetic",
    mealType: "snack",
    image: "/images/templates/dia-chia-pudding.jpg",
    summary: "Chia seeds, unsweetened almond milk, berries.",
    baseServings: 1,
    ingredients: [
      { name: "chia seeds", quantity: 25, unit: "g" },
      { name: "unsweetened almond milk", quantity: 200, unit: "ml" },
      { name: "fresh berries", quantity: 80, unit: "g" },
      { name: "vanilla extract", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Mix chia with almond milk and vanilla; refrigerate 2+ hours.",
      "Top with berries before serving."
    ],
    nutritionPerServing: { calories: 220, protein: 8, carbs: 16, fat: 14 },
    badges: ["Low-GI", "High fiber", "Sugar-free"],
    source: "template"
  },
  {
    id: "tpl-dia-006",
    name: "Diabetic-Friendly Protein Pancakes",
    archetype: "Diabetic",
    mealType: "breakfast",
    image: "/images/templates/dia-protein-pancakes.jpg",
    summary: "Almond flour pancakes with protein powder, sugar-free syrup.",
    baseServings: 1,
    ingredients: [
      { name: "almond flour", quantity: 40, unit: "g", role: "carb" },
      { name: "protein powder", quantity: 25, unit: "g", role: "protein" },
      { name: "egg", quantity: 1, unit: "unit", role: "protein" },
      { name: "unsweetened almond milk", quantity: 80, unit: "ml" },
      { name: "berries", quantity: 100, unit: "g", role: "veg" },
      { name: "sugar-free syrup", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Mix almond flour, protein powder, egg, almond milk.",
      "Cook small pancakes in non-stick pan 2-3 min per side.",
      "Serve with berries and sugar-free syrup."
    ],
    nutritionPerServing: { calories: 380, protein: 32, carbs: 18, fat: 22 },
    badges: ["Low-GI", "High protein", "Sugar-free"],
    source: "template"
  },

  // ========================= Vegetarian =========================
  {
    id: "tpl-veg-001",
    name: "Vegetarian Lentil Curry",
    archetype: "Vegetarian",
    mealType: "dinner",
    image: "/images/templates/veg-lentil-curry.jpg",
    summary: "Hearty lentils with Indian spices, served with basmati rice.",
    baseServings: 1,
    ingredients: [
      { name: "dry lentils", quantity: 80, unit: "g" },
      { name: "onion, garlic, ginger", quantity: 50, unit: "g" },
      { name: "tomatoes, diced", quantity: 200, unit: "g" },
      { name: "garam masala + turmeric", quantity: 1, unit: "tbsp" },
      { name: "cooked basmati rice", quantity: 150, unit: "g" }
    ],
    instructions: [
      "Simmer lentils 20–25 min.",
      "Sauté onion, garlic, ginger; add spices and tomatoes.",
      "Stir lentils into sauce; serve with rice."
    ],
    nutritionPerServing: { calories: 520, protein: 26, carbs: 80, fat: 8 },
    badges: ["Vegetarian", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-veg-002",
    name: "Caprese Quinoa Bowl",
    archetype: "Vegetarian",
    mealType: "lunch",
    image: "/images/templates/veg-caprese-quinoa.jpg",
    summary: "Quinoa, cherry tomatoes, mozzarella, basil, balsamic glaze.",
    baseServings: 1,
    ingredients: [
      { name: "cooked quinoa", quantity: 180, unit: "g" },
      { name: "cherry tomatoes", quantity: 120, unit: "g" },
      { name: "fresh mozzarella", quantity: 60, unit: "g" },
      { name: "basil", quantity: 5, unit: "leaves" },
      { name: "balsamic glaze", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Assemble quinoa, tomatoes, mozzarella.",
      "Drizzle with balsamic; garnish with basil."
    ],
    nutritionPerServing: { calories: 480, protein: 20, carbs: 60, fat: 16 },
    badges: ["Vegetarian", "Balanced"],
    source: "template"
  },
  {
    id: "tpl-veg-003",
    name: "Vegetarian Chili (Beans + Veg)",
    archetype: "Vegetarian",
    mealType: "dinner",
    image: "/images/templates/veg-chili.jpg",
    summary: "Beans, peppers, tomatoes, chili spices.",
    baseServings: 1,
    ingredients: [
      { name: "kidney + black beans", quantity: 200, unit: "g" },
      { name: "tomatoes, canned", quantity: 200, unit: "g" },
      { name: "bell peppers + onion", quantity: 150, unit: "g" },
      { name: "chili spice blend", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Sauté onion/pepper; add beans, tomatoes, spices; simmer 20 min."
    ],
    nutritionPerServing: { calories: 460, protein: 22, carbs: 68, fat: 8 },
    badges: ["Vegetarian", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-veg-004",
    name: "Avocado Hummus Wrap",
    archetype: "Vegetarian",
    mealType: "lunch",
    image: "/images/templates/veg-hummus-wrap.jpg",
    summary: "Whole-grain tortilla, hummus, avocado, cucumber, spinach.",
    baseServings: 1,
    ingredients: [
      { name: "whole-grain tortilla", quantity: 1, unit: "unit" },
      { name: "hummus", quantity: 2, unit: "tbsp" },
      { name: "avocado", quantity: 60, unit: "g" },
      { name: "cucumber, sliced", quantity: 60, unit: "g" },
      { name: "spinach", quantity: 40, unit: "g" }
    ],
    instructions: [
      "Spread hummus; layer avocado, cucumber, spinach; roll tightly."
    ],
    nutritionPerServing: { calories: 420, protein: 12, carbs: 50, fat: 20 },
    badges: ["Vegetarian"],
    source: "template"
  },
  {
    id: "tpl-veg-006",
    name: "Vegetarian Breakfast Hash",
    archetype: "Vegetarian",
    mealType: "breakfast",
    image: "/images/templates/veg-breakfast-hash.jpg",
    summary: "Sweet potato, bell peppers, onion, topped with poached egg and cheese.",
    baseServings: 1,
    ingredients: [
      { name: "sweet potato, diced", quantity: 150, unit: "g", role: "carb" },
      { name: "bell pepper", quantity: 100, unit: "g", role: "veg" },
      { name: "onion", quantity: 60, unit: "g", role: "veg" },
      { name: "egg", quantity: 1, unit: "unit", role: "protein" },
      { name: "cheddar cheese", quantity: 20, unit: "g", role: "fat" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" }
    ],
    instructions: [
      "Roast diced sweet potato with oil at 425°F 20 min.",
      "Sauté peppers and onion 5-6 min.",
      "Poach egg; serve over hash with cheese."
    ],
    nutritionPerServing: { calories: 420, protein: 16, carbs: 48, fat: 18 },
    badges: ["Vegetarian", "Whole food"],
    source: "template"
  },
  {
    id: "tpl-veg-007",
    name: "Vegetarian Breakfast Burrito",
    archetype: "Vegetarian",
    mealType: "breakfast",
    image: "/images/templates/veg-breakfast-burrito.jpg",
    summary: "Scrambled eggs, black beans, cheese, salsa in whole wheat tortilla.",
    baseServings: 1,
    ingredients: [
      { name: "whole wheat tortilla", quantity: 1, unit: "unit", role: "carb" },
      { name: "eggs", quantity: 2, unit: "unit", role: "protein" },
      { name: "black beans", quantity: 80, unit: "g", role: "protein" },
      { name: "bell pepper", quantity: 80, unit: "g", role: "veg" },
      { name: "spinach", quantity: 60, unit: "g", role: "veg" },
      { name: "cheese", quantity: 20, unit: "g", role: "fat" },
      { name: "salsa", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Sauté peppers 3 min; add spinach until wilted.",
      "Scramble eggs; warm beans and tortilla.",
      "Fill tortilla with eggs, beans, veg, cheese; roll and serve with salsa."
    ],
    nutritionPerServing: { calories: 480, protein: 26, carbs: 52, fat: 20 },
    badges: ["Vegetarian", "High protein"],
    source: "template"
  },

  // ========================= Vegan =========================
  {
    id: "tpl-vegan-001",
    name: "Vegan Buddha Bowl",
    archetype: "Vegan",
    mealType: "lunch",
    image: "/images/templates/vegan-buddha-bowl.jpg",
    summary: "Quinoa, chickpeas, roasted veg, tahini dressing.",
    baseServings: 1,
    ingredients: [
      { name: "cooked quinoa", quantity: 150, unit: "g" },
      { name: "chickpeas, cooked", quantity: 120, unit: "g" },
      { name: "roasted veg mix", quantity: 200, unit: "g" },
      { name: "tahini + lemon", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Assemble quinoa, chickpeas, roasted veg; drizzle tahini-lemon."
    ],
    nutritionPerServing: { calories: 540, protein: 22, carbs: 70, fat: 18 },
    badges: ["Vegan", "Balanced"],
    source: "template"
  },
  {
    id: "tpl-vegan-002",
    name: "Vegan Tofu Stir-Fry",
    archetype: "Vegan",
    mealType: "dinner",
    image: "/images/templates/vegan-tofu-stirfry.jpg",
    summary: "Crispy tofu cubes, mixed veggies, light soy-ginger sauce.",
    baseServings: 1,
    ingredients: [
      { name: "tofu, firm", quantity: 150, unit: "g" },
      { name: "veg stir-fry mix", quantity: 200, unit: "g" },
      { name: "soy sauce low sodium", quantity: 1, unit: "tbsp" },
      { name: "ginger + garlic", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Pan-fry tofu until golden; set aside.",
      "Stir-fry veg with garlic/ginger; add soy; return tofu; toss."
    ],
    nutritionPerServing: { calories: 460, protein: 26, carbs: 40, fat: 18 },
    badges: ["Vegan", "High protein"],
    source: "template"
  },
  {
    id: "tpl-vegan-003",
    name: "Vegan Oatmeal + Almond Butter",
    archetype: "Vegan",
    mealType: "breakfast",
    image: "/images/templates/vegan-oatmeal.jpg",
    summary: "Rolled oats, almond milk, almond butter, berries.",
    baseServings: 1,
    ingredients: [
      { name: "rolled oats", quantity: 60, unit: "g" },
      { name: "almond milk", quantity: 200, unit: "ml" },
      { name: "almond butter", quantity: 1, unit: "tbsp" },
      { name: "berries", quantity: 80, unit: "g" }
    ],
    instructions: [
      "Cook oats in almond milk; top with almond butter and berries."
    ],
    nutritionPerServing: { calories: 400, protein: 14, carbs: 55, fat: 14 },
    badges: ["Vegan"],
    source: "template"
  },
  {
    id: "tpl-vegan-004",
    name: "Vegan Lentil Soup",
    archetype: "Vegan",
    mealType: "dinner",
    image: "/images/templates/vegan-lentil-soup.jpg",
    summary: "Lentils, carrots, celery, onion, spices.",
    baseServings: 1,
    ingredients: [
      { name: "dry lentils", quantity: 80, unit: "g" },
      { name: "carrots + celery + onion", quantity: 180, unit: "g" },
      { name: "vegetable broth", quantity: 300, unit: "ml" },
      { name: "spices (cumin, paprika)", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Simmer lentils, veg, and spices in broth until tender."
    ],
    nutritionPerServing: { calories: 380, protein: 20, carbs: 55, fat: 6 },
    badges: ["Vegan", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-vegan-005",
    name: "Vegan Smoothie Bowl",
    archetype: "Vegan",
    mealType: "snack",
    image: "/images/templates/vegan-smoothie-bowl.jpg",
    summary: "Banana, frozen berries, soy protein, almond milk, granola topping.",
    baseServings: 1,
    ingredients: [
      { name: "banana", quantity: 1, unit: "unit" },
      { name: "frozen berries", quantity: 120, unit: "g" },
      { name: "soy protein powder", quantity: 25, unit: "g" },
      { name: "almond milk", quantity: 150, unit: "ml" },
      { name: "granola", quantity: 20, unit: "g" }
    ],
    instructions: [
      "Blend banana, berries, protein powder, almond milk.",
      "Pour into bowl; top with granola."
    ],
    nutritionPerServing: { calories: 420, protein: 24, carbs: 56, fat: 10 },
    badges: ["Vegan", "High protein"],
    source: "template"
  },
  {
    id: "tpl-vegan-006",
    name: "Vegan Chia Breakfast Bowl",
    archetype: "Vegan",
    mealType: "breakfast",
    image: "/images/templates/vegan-chia-bowl.jpg",
    summary: "Chia seeds, coconut milk, banana, hemp hearts, maple syrup.",
    baseServings: 1,
    ingredients: [
      { name: "chia seeds", quantity: 30, unit: "g", role: "protein" },
      { name: "coconut milk", quantity: 200, unit: "ml", role: "fat" },
      { name: "banana", quantity: 1, unit: "unit", role: "carb" },
      { name: "mixed berries", quantity: 100, unit: "g", role: "veg" },
      { name: "hemp hearts", quantity: 15, unit: "g", role: "protein" },
      { name: "maple syrup", quantity: 1, unit: "tsp", role: "carb" }
    ],
    instructions: [
      "Mix chia seeds with coconut milk; refrigerate overnight.",
      "Top with sliced banana, berries, hemp hearts.",
      "Drizzle with maple syrup."
    ],
    nutritionPerServing: { calories: 450, protein: 12, carbs: 52, fat: 22 },
    badges: ["Vegan", "High fiber"],
    source: "template"
  },

  // ========================= Paleo =========================
  {
    id: "tpl-paleo-001",
    name: "Paleo Beef Stir-Fry",
    archetype: "Paleo",
    mealType: "dinner",
    image: "/images/templates/paleo-beef-stirfry.jpg",
    summary: "Grass-fed beef strips, bell peppers, coconut aminos sauce.",
    baseServings: 1,
    ingredients: [
      { name: "beef strips", quantity: 150, unit: "g" },
      { name: "bell peppers + broccoli", quantity: 180, unit: "g" },
      { name: "coconut aminos", quantity: 1, unit: "tbsp" },
      { name: "garlic + ginger", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Sear beef; remove. Stir-fry veg; add garlic/ginger; return beef; toss with aminos."
    ],
    nutritionPerServing: { calories: 430, protein: 36, carbs: 14, fat: 26 },
    badges: ["Paleo"],
    source: "template"
  },
  {
    id: "tpl-paleo-002",
    name: "Paleo Chicken Zoodle Bowl",
    archetype: "Paleo",
    mealType: "lunch",
    image: "/images/templates/paleo-zoodles.jpg",
    summary: "Grilled chicken, zucchini noodles, tomato sauce.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 150, unit: "g" },
      { name: "zucchini noodles", quantity: 200, unit: "g" },
      { name: "tomato sauce (no sugar)", quantity: 120, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Grill chicken; heat sauce; toss zoodles lightly in pan.",
      "Combine chicken, zoodles, sauce."
    ],
    nutritionPerServing: { calories: 390, protein: 38, carbs: 12, fat: 20 },
    badges: ["Paleo", "Low carb"],
    source: "template"
  },
  {
    id: "tpl-paleo-003",
    name: "Paleo Breakfast Scramble",
    archetype: "Paleo",
    mealType: "breakfast",
    image: "/images/templates/paleo-scramble.jpg",
    summary: "Eggs, sweet potato cubes, spinach, avocado.",
    baseServings: 1,
    ingredients: [
      { name: "eggs", quantity: 2, unit: "unit" },
      { name: "sweet potato, diced", quantity: 100, unit: "g" },
      { name: "spinach", quantity: 60, unit: "g" },
      { name: "avocado", quantity: 60, unit: "g" }
    ],
    instructions: [
      "Roast sweet potato cubes.",
      "Scramble eggs with spinach; top with avocado + roasted potato."
    ],
    nutritionPerServing: { calories: 440, protein: 20, carbs: 28, fat: 26 },
    badges: ["Paleo", "Whole food"],
    source: "template"
  },
  {
    id: "tpl-paleo-004",
    name: "Paleo Salmon Salad",
    archetype: "Paleo",
    mealType: "lunch",
    image: "/images/templates/paleo-salmon-salad.jpg",
    summary: "Mixed greens, grilled salmon, olive oil + lemon.",
    baseServings: 1,
    ingredients: [
      { name: "salmon fillet", quantity: 150, unit: "g" },
      { name: "mixed greens", quantity: 120, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "lemon juice", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Grill salmon until cooked; flake over greens.",
      "Drizzle with olive oil and lemon juice."
    ],
    nutritionPerServing: { calories: 420, protein: 34, carbs: 6, fat: 28 },
    badges: ["Paleo", "Omega-3"],
    source: "template"
  },
  {
    id: "tpl-paleo-005",
    name: "Paleo Chicken Veggie Soup",
    archetype: "Paleo",
    mealType: "dinner",
    image: "/images/templates/paleo-chicken-soup.jpg",
    summary: "Chicken, carrots, celery, onion, herbs, bone broth.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast, cubed", quantity: 150, unit: "g" },
      { name: "carrots + celery + onion", quantity: 200, unit: "g" },
      { name: "bone broth", quantity: 300, unit: "ml" },
      { name: "herbs (thyme, parsley)", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Simmer chicken and veg in broth 20 min.",
      "Season with herbs; serve hot."
    ],
    nutritionPerServing: { calories: 360, protein: 36, carbs: 12, fat: 16 },
    badges: ["Paleo", "Whole food"],
    source: "template"
  },
  {
    id: "tpl-paleo-006",
    name: "Paleo Trail Mix",
    archetype: "Paleo",
    mealType: "snack",
    image: "/images/templates/paleo-trail-mix.jpg",
    summary: "Raw almonds, walnuts, dried fruit, coconut flakes.",
    baseServings: 1,
    ingredients: [
      { name: "raw almonds", quantity: 20, unit: "g", role: "fat" },
      { name: "walnuts", quantity: 15, unit: "g", role: "fat" },
      { name: "dried cranberries (no sugar)", quantity: 20, unit: "g", role: "carb" },
      { name: "coconut flakes", quantity: 10, unit: "g", role: "fat" }
    ],
    instructions: [
      "Mix all ingredients; portion for grab-and-go snack."
    ],
    nutritionPerServing: { calories: 340, protein: 8, carbs: 22, fat: 26 },
    badges: ["Paleo", "Portable"],
    source: "template"
  },

  // ========================= Mediterranean (5) =========================
  {
    id: "tpl-med-001",
    name: "Mediterranean Grain Bowl",
    archetype: "Mediterranean",
    mealType: "lunch",
    image: "/images/templates/med-grain-bowl.jpg",
    summary: "Farro, chickpeas, roasted veg, olive oil, feta.",
    baseServings: 1,
    ingredients: [
      { name: "cooked farro", quantity: 150, unit: "g" },
      { name: "chickpeas", quantity: 100, unit: "g" },
      { name: "roasted veg mix", quantity: 180, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "feta", quantity: 20, unit: "g" }
    ],
    instructions: [
      "Assemble farro, chickpeas, roasted veg; drizzle olive oil; sprinkle feta."
    ],
    nutritionPerServing: { calories: 500, protein: 22, carbs: 64, fat: 16 },
    badges: ["Mediterranean", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-med-002",
    name: "Mediterranean Baked Cod",
    archetype: "Mediterranean",
    mealType: "dinner",
    image: "/images/templates/med-baked-cod.jpg",
    summary: "Cod fillet with olives, tomatoes, capers, herbs.",
    baseServings: 1,
    ingredients: [
      { name: "cod fillet", quantity: 160, unit: "g" },
      { name: "tomatoes, diced", quantity: 120, unit: "g" },
      { name: "olives", quantity: 6, unit: "unit" },
      { name: "capers", quantity: 1, unit: "tsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Bake cod at 375°F/190°C 12–15 min with tomato, olives, capers.",
      "Finish with olive oil drizzle."
    ],
    nutritionPerServing: { calories: 380, protein: 34, carbs: 8, fat: 20 },
    badges: ["Mediterranean", "Omega-3"],
    source: "template"
  },
  {
    id: "tpl-med-003",
    name: "Mediterranean Chickpea Salad",
    archetype: "Mediterranean",
    mealType: "lunch",
    image: "/images/templates/med-chickpea-salad.jpg",
    summary: "Chickpeas, cucumber, tomato, parsley, lemon-olive oil dressing.",
    baseServings: 1,
    ingredients: [
      { name: "chickpeas", quantity: 150, unit: "g" },
      { name: "cucumber", quantity: 100, unit: "g" },
      { name: "tomato", quantity: 100, unit: "g" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "lemon juice", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Combine chickpeas, cucumber, tomato; dress with oil + lemon; add parsley."
    ],
    nutritionPerServing: { calories: 360, protein: 14, carbs: 44, fat: 14 },
    badges: ["Mediterranean", "High fiber"],
    source: "template"
  },
  {
    id: "tpl-med-004",
    name: "Mediterranean Breakfast Pita",
    archetype: "Mediterranean",
    mealType: "breakfast",
    image: "/images/templates/med-breakfast-pita.jpg",
    summary: "Whole wheat pita, scrambled egg, tomato, cucumber, tzatziki.",
    baseServings: 1,
    ingredients: [
      { name: "whole wheat pita", quantity: 1, unit: "unit" },
      { name: "egg", quantity: 1, unit: "unit" },
      { name: "tomato", quantity: 60, unit: "g" },
      { name: "cucumber", quantity: 60, unit: "g" },
      { name: "tzatziki", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Scramble egg; stuff pita with egg, tomato, cucumber, tzatziki."
    ],
    nutritionPerServing: { calories: 340, protein: 16, carbs: 36, fat: 14 },
    badges: ["Mediterranean", "Whole grain"],
    source: "template"
  },
  {
    id: "tpl-med-005",
    name: "Mediterranean Fruit + Nut Snack",
    archetype: "Mediterranean",
    mealType: "snack",
    image: "/images/templates/med-fruit-nuts.jpg",
    summary: "Fresh figs or dates, walnuts, and Greek yogurt dip.",
    baseServings: 1,
    ingredients: [
      { name: "figs or dates", quantity: 60, unit: "g" },
      { name: "walnuts", quantity: 20, unit: "g" },
      { name: "Greek yogurt", quantity: 100, unit: "g" }
    ],
    instructions: [
      "Serve fruit with walnuts and Greek yogurt for dipping."
    ],
    nutritionPerServing: { calories: 300, protein: 12, carbs: 34, fat: 12 },
    badges: ["Mediterranean", "Balanced"],
    source: "template"
  },

  // ========================= ADDITIONAL BALANCED TEMPLATES =========================
  {
    id: "tpl-bal-006",
    name: "Korean-Style Bibimbap Bowl",
    archetype: "Balanced",
    mealType: "dinner",
    image: "/images/templates/bal-bibimbap.jpg",
    summary: "Brown rice, seasoned vegetables, protein, sesame oil, gochujang.",
    baseServings: 1,
    ingredients: [
      { name: "cooked brown rice", quantity: 150, unit: "g", role: "carb" },
      { name: "lean ground turkey", quantity: 120, unit: "g", role: "protein" },
      { name: "spinach", quantity: 100, unit: "g", role: "veg" },
      { name: "carrots, julienned", quantity: 80, unit: "g", role: "veg" },
      { name: "bell pepper", quantity: 80, unit: "g", role: "veg" },
      { name: "sesame oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "gochujang", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Brown turkey with garlic; steam vegetables separately.",
      "Bowl rice; arrange vegetables and protein in sections.",
      "Drizzle sesame oil; serve with gochujang on side."
    ],
    nutritionPerServing: { calories: 510, protein: 32, carbs: 58, fat: 16 },
    badges: ["Balanced", "International"],
    source: "template"
  },

  // ========================= ADDITIONAL BALANCED BREAKFAST =========================
  {
    id: "tpl-bal-007",
    name: "Mexican Breakfast Bowl",
    archetype: "Balanced",
    mealType: "breakfast",
    image: "/images/templates/bal-mexican-bowl.jpg",
    summary: "Quinoa, black beans, scrambled eggs, avocado, salsa.",
    baseServings: 1,
    ingredients: [
      { name: "cooked quinoa", quantity: 120, unit: "g", role: "carb" },
      { name: "eggs", quantity: 2, unit: "unit", role: "protein" },
      { name: "black beans", quantity: 80, unit: "g", role: "protein" },
      { name: "bell pepper", quantity: 100, unit: "g", role: "veg" },
      { name: "spinach", quantity: 60, unit: "g", role: "veg" },
      { name: "avocado", quantity: 60, unit: "g", role: "fat" },
      { name: "salsa", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Scramble eggs; warm beans and quinoa.",
      "Sauté peppers; wilt spinach.",
      "Bowl quinoa; top with eggs, beans, vegetables, avocado, salsa."
    ],
    nutritionPerServing: { calories: 520, protein: 28, carbs: 54, fat: 20 },
    badges: ["Balanced", "International"],
    source: "template"
  },

  // ========================= ADDITIONAL HP/LC LUNCH =========================
  {
    id: "tpl-hplc-011",
    name: "Thai Larb Lettuce Cups",
    archetype: "HP/LC",
    mealType: "lunch",
    image: "/images/templates/hplc-thai-larb.jpg",
    summary: "Ground chicken, fresh herbs, lime juice, fish sauce, lettuce cups.",
    baseServings: 1,
    ingredients: [
      { name: "ground chicken", quantity: 160, unit: "g", role: "protein" },
      { name: "butter lettuce cups", quantity: 6, unit: "leaves", role: "veg" },
      { name: "cucumber", quantity: 100, unit: "g", role: "veg" },
      { name: "mint + cilantro", quantity: 20, unit: "g", role: "veg" },
      { name: "lime juice", quantity: 2, unit: "tbsp" },
      { name: "fish sauce", quantity: 1, unit: "tsp" },
      { name: "chili flakes", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Cook ground chicken until done; cool slightly.",
      "Mix with lime juice, fish sauce, herbs, chili.",
      "Serve in lettuce cups with cucumber slices."
    ],
    nutritionPerServing: { calories: 340, protein: 40, carbs: 8, fat: 16 },
    badges: ["High protein", "Low carb", "International"],
    source: "template"
  },

  // ========================= ADDITIONAL MEDITERRANEAN DINNER =========================
  {
    id: "tpl-med-006",
    name: "Mediterranean Stuffed Eggplant",
    archetype: "Mediterranean",
    mealType: "dinner",
    image: "/images/templates/med-stuffed-eggplant.jpg",
    summary: "Roasted eggplant, quinoa, chickpeas, tomatoes, feta, herbs.",
    baseServings: 1,
    ingredients: [
      { name: "eggplant, halved", quantity: 200, unit: "g", role: "veg" },
      { name: "cooked quinoa", quantity: 100, unit: "g", role: "carb" },
      { name: "chickpeas", quantity: 80, unit: "g", role: "protein" },
      { name: "tomatoes, diced", quantity: 100, unit: "g", role: "veg" },
      { name: "feta cheese", quantity: 30, unit: "g", role: "fat" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "oregano + basil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Roast eggplant halves at 400°F 25 min; scoop flesh.",
      "Mix eggplant flesh with quinoa, chickpeas, tomatoes, herbs.",
      "Stuff eggplant shells; top with feta; bake 15 min."
    ],
    nutritionPerServing: { calories: 480, protein: 22, carbs: 64, fat: 18 },
    badges: ["Mediterranean", "High fiber"],
    source: "template"
  },

  // ========================= ADDITIONAL DIABETIC LUNCH =========================
  {
    id: "tpl-dia-007",
    name: "Diabetic Cauliflower Tabbouleh",
    archetype: "Diabetic",
    mealType: "lunch",
    image: "/images/templates/dia-cauli-tabbouleh.jpg",
    summary: "Cauliflower rice, cucumber, tomato, parsley, lemon, grilled chicken.",
    baseServings: 1,
    ingredients: [
      { name: "cauliflower rice", quantity: 180, unit: "g", role: "veg" },
      { name: "grilled chicken breast", quantity: 140, unit: "g", role: "protein" },
      { name: "cucumber", quantity: 100, unit: "g", role: "veg" },
      { name: "tomatoes", quantity: 100, unit: "g", role: "veg" },
      { name: "parsley", quantity: 20, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "lemon juice", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Raw cauliflower rice; dice cucumber and tomatoes fine.",
      "Mix with parsley, lemon juice, olive oil.",
      "Serve topped with sliced grilled chicken."
    ],
    nutritionPerServing: { calories: 380, protein: 38, carbs: 16, fat: 18 },
    badges: ["Low-GI", "High protein", "Fresh"],
    source: "template"
  },

  // ========================= ADDITIONAL HP/HC DINNER =========================
  {
    id: "tpl-hphc-007",
    name: "Italian Chicken Risotto",
    archetype: "HP/HC",
    mealType: "dinner",
    image: "/images/templates/hphc-chicken-risotto.jpg",
    summary: "Arborio rice, chicken breast, peas, parmesan, chicken broth.",
    baseServings: 1,
    ingredients: [
      { name: "arborio rice", quantity: 80, unit: "g", role: "carb" },
      { name: "chicken breast", quantity: 140, unit: "g", role: "protein" },
      { name: "green peas", quantity: 100, unit: "g", role: "veg" },
      { name: "spinach", quantity: 80, unit: "g", role: "veg" },
      { name: "parmesan cheese", quantity: 20, unit: "g", role: "fat" },
      { name: "chicken broth", quantity: 300, unit: "ml" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" }
    ],
    instructions: [
      "Cook risotto slowly, adding broth gradually 20 min.",
      "Grill chicken; dice. Stir peas and spinach into risotto.",
      "Top with chicken and parmesan."
    ],
    nutritionPerServing: { calories: 580, protein: 44, carbs: 68, fat: 14 },
    badges: ["High protein", "Fuel carbs", "International"],
    source: "template"
  },

  // ========================= ADDITIONAL VEGETARIAN DINNER =========================
  {
    id: "tpl-veg-008",
    name: "Indian Dal with Vegetables",
    archetype: "Vegetarian",
    mealType: "dinner",
    image: "/images/templates/veg-indian-dal.jpg",
    summary: "Red lentils, mixed vegetables, turmeric, cumin, cilantro, basmati rice.",
    baseServings: 1,
    ingredients: [
      { name: "red lentils", quantity: 80, unit: "g", role: "protein" },
      { name: "cooked basmati rice", quantity: 120, unit: "g", role: "carb" },
      { name: "cauliflower", quantity: 100, unit: "g", role: "veg" },
      { name: "green beans", quantity: 80, unit: "g", role: "veg" },
      { name: "carrots", quantity: 60, unit: "g", role: "veg" },
      { name: "turmeric + cumin", quantity: 1, unit: "tsp" },
      { name: "coconut milk", quantity: 60, unit: "ml", role: "fat" }
    ],
    instructions: [
      "Simmer lentils with spices 15 min.",
      "Add vegetables; cook 10 min until tender.",
      "Stir in coconut milk; serve over rice."
    ],
    nutritionPerServing: { calories: 520, protein: 24, carbs: 78, fat: 12 },
    badges: ["Vegetarian", "High fiber", "International"],
    source: "template"
  },

  // ========================= ADDITIONAL VEGAN LUNCH =========================
  {
    id: "tpl-vegan-007",
    name: "Mediterranean Quinoa Salad",
    archetype: "Vegan",
    mealType: "lunch",
    image: "/images/templates/vegan-quinoa-salad.jpg",
    summary: "Quinoa, chickpeas, cucumber, tomato, olives, tahini dressing.",
    baseServings: 1,
    ingredients: [
      { name: "cooked quinoa", quantity: 150, unit: "g", role: "carb" },
      { name: "chickpeas", quantity: 120, unit: "g", role: "protein" },
      { name: "cucumber", quantity: 100, unit: "g", role: "veg" },
      { name: "tomatoes", quantity: 100, unit: "g", role: "veg" },
      { name: "red onion", quantity: 40, unit: "g", role: "veg" },
      { name: "kalamata olives", quantity: 8, unit: "unit", role: "fat" },
      { name: "tahini", quantity: 1, unit: "tbsp", role: "fat" },
      { name: "lemon juice", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Mix quinoa with diced vegetables and olives.",
      "Whisk tahini with lemon juice; toss with salad.",
      "Chill 30 min before serving."
    ],
    nutritionPerServing: { calories: 520, protein: 20, carbs: 68, fat: 18 },
    badges: ["Vegan", "High fiber", "Mediterranean"],
    source: "template"
  },

  // ========================= ADDITIONAL PALEO LUNCH =========================
  {
    id: "tpl-paleo-007",
    name: "Paleo Tuna-Stuffed Sweet Potato",
    archetype: "Paleo",
    mealType: "lunch",
    image: "/images/templates/paleo-tuna-sweet-potato.jpg",
    summary: "Baked sweet potato, tuna, avocado, spinach, olive oil.",
    baseServings: 1,
    ingredients: [
      { name: "sweet potato", quantity: 200, unit: "g", role: "carb" },
      { name: "canned tuna in water", quantity: 140, unit: "g", role: "protein" },
      { name: "avocado", quantity: 80, unit: "g", role: "fat" },
      { name: "spinach", quantity: 100, unit: "g", role: "veg" },
      { name: "cucumber", quantity: 80, unit: "g", role: "veg" },
      { name: "olive oil", quantity: 1, unit: "tsp", role: "fat" },
      { name: "lemon juice", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Bake sweet potato at 425°F 45 min until tender.",
      "Mix tuna with diced avocado, lemon, olive oil.",
      "Stuff potato with spinach and tuna mixture; serve with cucumber."
    ],
    nutritionPerServing: { calories: 480, protein: 32, carbs: 48, fat: 18 },
    badges: ["Paleo", "Whole food"],
    source: "template"
  },

  // ========================= ADDITIONAL BREAKFAST TEMPLATES =========================
  {
    id: "tpl-keto-breakfast-001",
    name: "Keto Avocado Egg Bowl",
    archetype: "HP/LC",
    mealType: "breakfast",
    image: "/images/templates/keto-avocado-egg.jpg",
    summary: "Baked avocado, eggs, bacon bits, cheese, spinach.",
    baseServings: 1,
    ingredients: [
      { name: "avocado, halved", quantity: 150, unit: "g", role: "fat" },
      { name: "eggs", quantity: 2, unit: "unit", role: "protein" },
      { name: "bacon bits", quantity: 15, unit: "g", role: "fat" },
      { name: "cheddar cheese", quantity: 30, unit: "g", role: "fat" },
      { name: "spinach", quantity: 100, unit: "g", role: "veg" },
      { name: "bell peppers", quantity: 80, unit: "g", role: "veg" }
    ],
    instructions: [
      "Hollow out avocado halves, crack eggs inside.",
      "Top with cheese and bacon; bake 375°F 15 min.",
      "Serve with sautéed spinach and peppers."
    ],
    nutritionPerServing: { calories: 520, protein: 22, carbs: 12, fat: 44 },
    badges: ["Keto", "High fat", "Low carb"],
    source: "template"
  },

  {
    id: "tpl-vegan-breakfast-002",
    name: "Vegan Chia Pudding Bowl",
    archetype: "Vegan",
    mealType: "breakfast",
    image: "/images/templates/vegan-chia-pudding.jpg",
    summary: "Chia seeds, almond milk, berries, nuts, coconut flakes.",
    baseServings: 1,
    ingredients: [
      { name: "chia seeds", quantity: 30, unit: "g", role: "protein" },
      { name: "almond milk", quantity: 200, unit: "ml", role: "fat" },
      { name: "mixed berries", quantity: 100, unit: "g", role: "carb" },
      { name: "walnuts", quantity: 20, unit: "g", role: "fat" },
      { name: "coconut flakes", quantity: 15, unit: "g", role: "fat" },
      { name: "spinach", quantity: 50, unit: "g", role: "veg" }
    ],
    instructions: [
      "Mix chia seeds with almond milk; refrigerate overnight.",
      "Top with berries, nuts, and coconut.",
      "Add spinach to smoothie or serve on side."
    ],
    nutritionPerServing: { calories: 380, protein: 12, carbs: 28, fat: 26 },
    badges: ["Vegan", "High fiber", "Make-ahead"],
    source: "template"
  },

  // ========================= NEW BREAKFAST MEALS =========================
  {
    id: "bf-tofu-scramble-wrap",
    name: "Tofu Scramble Wrap",
    archetype: "Vegan",
    mealType: "breakfast",
    image: "/images/templates/tofu-scramble-wrap.jpg",
    summary: "Protein-packed tofu scramble wrapped in whole-wheat tortilla",
    baseServings: 1,
    ingredients: [
      { name: "firm tofu (crumbled)", quantity: 4, unit: "oz", role: "protein" },
      { name: "peppers/onions", quantity: 0.5, unit: "cup", role: "veg" },
      { name: "whole-wheat tortilla", quantity: 1, unit: "unit", role: "carb" }
    ],
    instructions: [
      "Sauté veg 3–4 min.",
      "Add tofu + seasoning, cook 3 min.",
      "Wrap in tortilla."
    ],
    nutritionPerServing: { calories: 350, protein: 22, carbs: 38, fat: 12 },
    badges: ["vegan", "quick"],
    source: "template"
  },
  {
    id: "bf-overnight-oats-pb-chia",
    name: "Overnight Oats (PB + Chia)",
    archetype: "Vegan",
    mealType: "breakfast",
    image: "/images/templates/overnight-oats-pb.jpg",
    summary: "Make-ahead oats with peanut butter and chia seeds",
    baseServings: 1,
    ingredients: [
      { name: "oats", quantity: 0.5, unit: "cup", role: "carb" },
      { name: "milk/plant milk", quantity: 0.75, unit: "cup", role: "fat" },
      { name: "chia seeds", quantity: 1, unit: "tbsp", role: "protein" },
      { name: "peanut butter", quantity: 1, unit: "tbsp", role: "fat" }
    ],
    instructions: [
      "Stir all; chill overnight."
    ],
    nutritionPerServing: { calories: 420, protein: 14, carbs: 50, fat: 16 },
    badges: ["vegan", "quick"],
    source: "template"
  },
  {
    id: "bf-yogurt-protein-bowl",
    name: "Greek Yogurt Protein Bowl",
    archetype: "Vegetarian",
    mealType: "breakfast",
    image: "/images/templates/yogurt-protein-bowl.jpg",
    summary: "High-protein yogurt bowl with berries and granola",
    baseServings: 1,
    ingredients: [
      { name: "Greek yogurt (2%)", quantity: 1, unit: "cup", role: "protein" },
      { name: "berries", quantity: 1, unit: "cup", role: "carb" },
      { name: "lower-sugar granola", quantity: 0.33, unit: "cup", role: "carb" }
    ],
    instructions: [
      "Layer and serve."
    ],
    nutritionPerServing: { calories: 320, protein: 24, carbs: 42, fat: 8 },
    badges: ["vegetarian", "quick"],
    source: "template"
  },
  {
    id: "bf-egg-avocado-toast",
    name: "Egg + Avocado Toast",
    archetype: "Vegetarian",
    mealType: "breakfast",
    image: "/images/templates/egg-avocado-toast.jpg",
    summary: "Classic avocado toast topped with perfectly cooked egg",
    baseServings: 1,
    ingredients: [
      { name: "whole-grain bread", quantity: 2, unit: "slices", role: "carb" },
      { name: "avocado", quantity: 0.5, unit: "unit", role: "fat" },
      { name: "egg", quantity: 1, unit: "unit", role: "protein" }
    ],
    instructions: [
      "Toast bread; mash avocado; top with fried/poached egg."
    ],
    nutritionPerServing: { calories: 380, protein: 16, carbs: 34, fat: 18 },
    badges: ["vegetarian", "comfort"],
    source: "template"
  },
  {
    id: "bf-pb-banana-pinwheels",
    name: "PB Banana Pinwheels",
    archetype: "Vegetarian",
    mealType: "breakfast",
    image: "/images/templates/pb-banana-pinwheels.jpg",
    summary: "Fun finger-food breakfast with peanut butter and banana",
    baseServings: 1,
    ingredients: [
      { name: "whole-wheat tortilla", quantity: 1, unit: "unit", role: "carb" },
      { name: "peanut butter", quantity: 1.5, unit: "tbsp", role: "fat" },
      { name: "banana", quantity: 1, unit: "unit", role: "carb" }
    ],
    instructions: [
      "Spread PB, add banana, roll tight, slice into pinwheels."
    ],
    nutritionPerServing: { calories: 360, protein: 13, carbs: 48, fat: 14 },
    badges: ["vegetarian", "finger", "quick"],
    source: "template"
  },

  // ========================= NEW LUNCH MEALS =========================
  {
    id: "lu-chickpea-salad-sandwich",
    name: "Chickpea Salad Sandwich",
    archetype: "Vegan",
    mealType: "lunch",
    image: "/images/templates/chickpea-salad-sandwich.jpg",
    summary: "Plant-based protein sandwich with mashed chickpeas",
    baseServings: 1,
    ingredients: [
      { name: "chickpeas (rinsed)", quantity: 0.75, unit: "cup", role: "protein" },
      { name: "celery/onion (minced)", quantity: 0.33, unit: "cup", role: "veg" },
      { name: "light mayo or yogurt", quantity: 2, unit: "tbsp", role: "fat" },
      { name: "whole-grain bread", quantity: 2, unit: "slices", role: "carb" }
    ],
    instructions: [
      "Mash chickpeas with dressing + veg; assemble sandwich."
    ],
    nutritionPerServing: { calories: 440, protein: 18, carbs: 62, fat: 12 },
    badges: ["vegan", "comfort"],
    source: "template"
  },
  {
    id: "lu-hummus-veggie-wrap",
    name: "Hummus Veggie Wrap",
    archetype: "Vegan",
    mealType: "lunch",
    image: "/images/templates/hummus-veggie-wrap.jpg",
    summary: "Fresh and light wrap packed with vegetables and hummus",
    baseServings: 1,
    ingredients: [
      { name: "whole-wheat tortilla", quantity: 1, unit: "large", role: "carb" },
      { name: "hummus", quantity: 3, unit: "tbsp", role: "protein" },
      { name: "mixed veggies", quantity: 1, unit: "cup", role: "veg" }
    ],
    instructions: [
      "Spread hummus, add veg, roll tight."
    ],
    nutritionPerServing: { calories: 420, protein: 14, carbs: 52, fat: 14 },
    badges: ["vegan", "light", "quick"],
    source: "template"
  },
  {
    id: "lu-caprese-sandwich-light",
    name: "Caprese Sandwich (Light)",
    archetype: "Vegetarian",
    mealType: "lunch",
    image: "/images/templates/caprese-sandwich.jpg",
    summary: "Italian-inspired sandwich with fresh mozzarella and basil",
    baseServings: 1,
    ingredients: [
      { name: "whole-grain bread", quantity: 2, unit: "slices", role: "carb" },
      { name: "tomato + basil", quantity: 1, unit: "cup", role: "veg" },
      { name: "part-skim mozzarella", quantity: 2, unit: "oz", role: "protein" }
    ],
    instructions: [
      "Layer ingredients; toast if desired."
    ],
    nutritionPerServing: { calories: 420, protein: 22, carbs: 36, fat: 18 },
    badges: ["vegetarian", "comfort"],
    source: "template"
  },
  {
    id: "lu-quinoa-chickpea-bowl",
    name: "Quinoa Chickpea Bowl",
    archetype: "Vegan",
    mealType: "lunch",
    image: "/images/templates/quinoa-chickpea-bowl.jpg",
    summary: "Complete protein bowl with quinoa and chickpeas",
    baseServings: 1,
    ingredients: [
      { name: "cooked quinoa", quantity: 1, unit: "cup", role: "carb" },
      { name: "chickpeas", quantity: 0.5, unit: "cup", role: "protein" },
      { name: "roasted vegetables", quantity: 1, unit: "cup", role: "veg" }
    ],
    instructions: [
      "Assemble warm or cold; season to taste."
    ],
    nutritionPerServing: { calories: 520, protein: 18, carbs: 68, fat: 14 },
    badges: ["vegan", "plant-forward"],
    source: "template"
  },
  {
    id: "lu-grilled-cheese-tomato",
    name: "Grilled Cheese + Tomato Soup",
    archetype: "Vegetarian",
    mealType: "lunch",
    image: "/images/templates/grilled-cheese-soup.jpg",
    summary: "Classic comfort food combo with whole grain bread",
    baseServings: 1,
    ingredients: [
      { name: "whole-grain bread", quantity: 2, unit: "slices", role: "carb" },
      { name: "part-skim cheese", quantity: 2, unit: "oz", role: "protein" },
      { name: "tomato soup (light)", quantity: 1, unit: "cup", role: "veg" }
    ],
    instructions: [
      "Griddle sandwich until golden.",
      "Warm soup; serve together."
    ],
    nutritionPerServing: { calories: 500, protein: 24, carbs: 52, fat: 20 },
    badges: ["vegetarian", "comfort"],
    source: "template"
  },

  // ========================= NEW DINNER MEALS =========================
  {
    id: "di-cauliflower-tacos",
    name: "Crispy Cauliflower Tacos",
    archetype: "Vegan",
    mealType: "dinner",
    image: "/images/templates/cauliflower-tacos.jpg",
    summary: "Plant-based tacos with crispy roasted cauliflower",
    baseServings: 1,
    ingredients: [
      { name: "cauliflower florets", quantity: 2, unit: "cups", role: "veg" },
      { name: "corn tortillas", quantity: 3, unit: "unit", role: "carb" },
      { name: "slaw + salsa", quantity: 1, unit: "cup + 2 tbsp", role: "veg" }
    ],
    instructions: [
      "Roast or air-fry cauliflower until crisp.",
      "Warm tortillas; assemble with slaw + salsa."
    ],
    nutritionPerServing: { calories: 480, protein: 14, carbs: 68, fat: 14 },
    badges: ["vegan", "comfort"],
    source: "template"
  },
  {
    id: "di-lentil-bolognese",
    name: "Lentil Bolognese (High-Fiber Pasta)",
    archetype: "Vegan",
    mealType: "dinner",
    image: "/images/templates/lentil-bolognese.jpg",
    summary: "Plant-based bolognese with protein-rich lentils",
    baseServings: 1,
    ingredients: [
      { name: "cooked lentils", quantity: 1, unit: "cup", role: "protein" },
      { name: "tomato sauce", quantity: 1, unit: "cup", role: "veg" },
      { name: "high-fiber pasta", quantity: 3, unit: "oz dry", role: "carb" }
    ],
    instructions: [
      "Simmer sauce + lentils; boil pasta; combine."
    ],
    nutritionPerServing: { calories: 560, protein: 26, carbs: 82, fat: 9 },
    badges: ["vegan", "comfort"],
    source: "template"
  },
  {
    id: "di-teriyaki-tofu-bowl",
    name: "Teriyaki Tofu Bowl",
    archetype: "Vegan",
    mealType: "dinner",
    image: "/images/templates/teriyaki-tofu-bowl.jpg",
    summary: "Asian-inspired bowl with marinated tofu and vegetables",
    baseServings: 1,
    ingredients: [
      { name: "firm tofu (cubed)", quantity: 6, unit: "oz", role: "protein" },
      { name: "cooked rice", quantity: 1, unit: "cup", role: "carb" },
      { name: "veg mix", quantity: 1.5, unit: "cups", role: "veg" }
    ],
    instructions: [
      "Sear tofu; sauté veg; add teriyaki; serve over rice."
    ],
    nutritionPerServing: { calories: 520, protein: 24, carbs: 62, fat: 16 },
    badges: ["vegan", "comfort"],
    source: "template"
  },
  {
    id: "di-veggie-quesadillas",
    name: "Veggie Quesadillas (Triangles)",
    archetype: "Vegetarian",
    mealType: "dinner",
    image: "/images/templates/veggie-quesadillas.jpg",
    summary: "Cheesy quesadillas filled with sautéed vegetables",
    baseServings: 1,
    ingredients: [
      { name: "whole-wheat tortillas", quantity: 2, unit: "unit", role: "carb" },
      { name: "shredded cheese", quantity: 2, unit: "oz", role: "protein" },
      { name: "peppers/onions (sautéed)", quantity: 1, unit: "cup", role: "veg" }
    ],
    instructions: [
      "Fill; griddle until crisp; cut into triangles."
    ],
    nutritionPerServing: { calories: 480, protein: 22, carbs: 46, fat: 20 },
    badges: ["vegetarian", "finger", "comfort"],
    source: "template"
  },
  {
    id: "di-sheetpan-halloumi-veg",
    name: "Sheet-Pan Veg + Halloumi",
    archetype: "Vegetarian",
    mealType: "dinner",
    image: "/images/templates/sheetpan-halloumi.jpg",
    summary: "One-pan dinner with roasted vegetables and halloumi cheese",
    baseServings: 1,
    ingredients: [
      { name: "mixed vegetables", quantity: 3, unit: "cups", role: "veg" },
      { name: "halloumi (sliced)", quantity: 4, unit: "oz", role: "protein" },
      { name: "olive oil", quantity: 2, unit: "tsp", role: "fat" }
    ],
    instructions: [
      "Toss veg with oil; bake 425°F 18–22 min; add halloumi last 5 min."
    ],
    nutritionPerServing: { calories: 520, protein: 24, carbs: 30, fat: 32 },
    badges: ["vegetarian", "comfort"],
    source: "template"
  },

  // ========================= NEW SNACK MEALS =========================
  {
    id: "sn-zucchini-fries-af",
    name: "Zucchini Fries (Air-Fryer)",
    archetype: "Vegetarian",
    mealType: "snack",
    image: "/images/templates/zucchini-fries.jpg",
    summary: "Crispy air-fried zucchini with parmesan coating",
    baseServings: 1,
    ingredients: [
      { name: "zucchini", quantity: 1, unit: "medium", role: "veg" },
      { name: "panko + grated parm", quantity: 0.5, unit: "cup", role: "protein" },
      { name: "egg", quantity: 1, unit: "unit", role: "protein" }
    ],
    instructions: [
      "Coat; air-fry 400°F 9–12 min; salt."
    ],
    nutritionPerServing: { calories: 220, protein: 12, carbs: 22, fat: 9 },
    badges: ["vegetarian", "finger", "crispy"],
    source: "template"
  },
  {
    id: "sn-airpopped-popcorn",
    name: "Air-Popped Popcorn",
    archetype: "Vegan",
    mealType: "snack",
    image: "/images/templates/air-popped-popcorn.jpg",
    summary: "Light and healthy whole grain snack",
    baseServings: 1,
    ingredients: [
      { name: "popcorn kernels", quantity: 0.25, unit: "cup", role: "carb" },
      { name: "salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Pop; season lightly."
    ],
    nutritionPerServing: { calories: 150, protein: 5, carbs: 30, fat: 2 },
    badges: ["vegan", "finger", "quick"],
    source: "template"
  },
  {
    id: "sn-apple-pb-slices",
    name: "Apple + PB Slices",
    archetype: "Vegan",
    mealType: "snack",
    image: "/images/templates/apple-pb-slices.jpg",
    summary: "Classic combination of fresh apple with peanut butter",
    baseServings: 1,
    ingredients: [
      { name: "apple", quantity: 1, unit: "large", role: "carb" },
      { name: "peanut butter", quantity: 1, unit: "tbsp", role: "fat" }
    ],
    instructions: [
      "Slice apple; dip in PB or drizzle."
    ],
    nutritionPerServing: { calories: 220, protein: 5, carbs: 34, fat: 8 },
    badges: ["vegan", "finger", "quick"],
    source: "template"
  },
  {
    id: "sn-hummus-veggies",
    name: "Hummus + Veg Sticks",
    archetype: "Vegan",
    mealType: "snack",
    image: "/images/templates/hummus-veg-sticks.jpg",
    summary: "Fresh vegetables with protein-rich hummus dip",
    baseServings: 1,
    ingredients: [
      { name: "hummus", quantity: 0.33, unit: "cup", role: "protein" },
      { name: "veg sticks", quantity: 2, unit: "cups", role: "veg" }
    ],
    instructions: [
      "Serve together."
    ],
    nutritionPerServing: { calories: 250, protein: 8, carbs: 28, fat: 12 },
    badges: ["vegan", "finger", "quick"],
    source: "template"
  },
  {
    id: "sn-yogurt-ranch-dip",
    name: "Greek Yogurt Ranch Dip + Veg",
    archetype: "Vegetarian",
    mealType: "snack",
    image: "/images/templates/yogurt-ranch-dip.jpg",
    summary: "Protein-packed yogurt dip with fresh vegetables",
    baseServings: 1,
    ingredients: [
      { name: "Greek yogurt (2%)", quantity: 0.75, unit: "cup", role: "protein" },
      { name: "ranch seasoning", quantity: 1, unit: "tsp" },
      { name: "raw vegetables", quantity: 2, unit: "cups", role: "veg" }
    ],
    instructions: [
      "Mix seasoning into yogurt; serve with veg."
    ],
    nutritionPerServing: { calories: 180, protein: 18, carbs: 10, fat: 6 },
    badges: ["vegetarian", "finger", "quick"],
    source: "template"
  }
];
