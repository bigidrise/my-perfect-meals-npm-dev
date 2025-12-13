
// data/smartMenu.lunch.ts
import type { SmartMeal } from "./smartMenu.types";

export const smartMenuLunch: SmartMeal[] = [
  {
    id: "ln-001",
    name: "Grilled Chicken Salad (Avocado & Olive Oil)",
    macros: { calories: 420, protein_g: 38, carbs_g: 18, fat_g: 20 },
    badges: ["High Protein", "Heart-Healthy", "Diabetes-Friendly"],
    image: "/images/smart-menu/lunch/grilled-chicken-salad.jpg",
    ingredients: [
      { item: "grilled chicken breast", amount: "5 oz (140 g)" },
      { item: "mixed greens", amount: "2 cups (80 g)" },
      { item: "avocado", amount: "1/2 medium (70 g)" },
      { item: "olive oil", amount: "1 tbsp (15 ml)" },
      { item: "lemon juice", amount: "1 tbsp (15 ml)" }
    ],
    instructions: [
      "Slice grilled chicken.",
      "Arrange greens, avocado, and chicken on a plate.",
      "Drizzle with olive oil and lemon."
    ]
  },
  {
    id: "ln-002",
    name: "Turkey & Hummus Wrap",
    macros: { calories: 380, protein_g: 30, carbs_g: 36, fat_g: 12 },
    badges: ["Balanced", "High Fiber"],
    image: "/images/smart-menu/lunch/turkey-hummus-wrap.jpg",
    ingredients: [
      { item: "whole-wheat wrap", amount: "1 large (60 g)" },
      { item: "sliced turkey breast", amount: "4 oz (113 g)" },
      { item: "hummus", amount: "2 tbsp (30 g)" },
      { item: "spinach", amount: "1 cup (30 g)" },
      { item: "cucumber slices", amount: "1/2 cup (50 g)" }
    ],
    instructions: [
      "Spread hummus on wrap.",
      "Layer turkey, spinach, and cucumber.",
      "Roll tightly and slice."
    ]
  },
  {
    id: "ln-003",
    name: "Lentil Soup with Side Salad",
    macros: { calories: 360, protein_g: 22, carbs_g: 44, fat_g: 10 },
    badges: ["High Fiber", "Vegetarian", "Low Glycemic"],
    image: "/images/smart-menu/lunch/lentil-soup.jpg",
    ingredients: [
      { item: "lentils (dry)", amount: "1/2 cup (100 g)" },
      { item: "carrots, celery, onion (diced)", amount: "1 cup total (120 g)" },
      { item: "vegetable broth", amount: "3 cups (700 ml)" },
      { item: "olive oil", amount: "1 tsp (5 ml)" }
    ],
    instructions: [
      "Sauté diced veggies in oil for 5 min.",
      "Add lentils and broth; simmer 20–25 min.",
      "Serve hot with a side salad."
    ]
  },
  {
    id: "ln-004",
    name: "Salmon Grain Bowl",
    macros: { calories: 480, protein_g: 36, carbs_g: 40, fat_g: 18 },
    badges: ["Omega-3", "Anti-Inflammatory"],
    image: "/images/smart-menu/lunch/salmon-grain-bowl.jpg",
    ingredients: [
      { item: "grilled salmon", amount: "5 oz (140 g)" },
      { item: "quinoa (cooked)", amount: "1/2 cup (90 g)" },
      { item: "roasted broccoli", amount: "1 cup (90 g)" },
      { item: "tahini sauce", amount: "1 tbsp (15 g)" }
    ],
    instructions: [
      "Assemble quinoa, broccoli, and salmon in a bowl.",
      "Drizzle tahini sauce on top."
    ]
  },
  {
    id: "ln-005",
    name: "Chicken Stir-Fry (Low Sodium Soy Sauce)",
    macros: { calories: 420, protein_g: 34, carbs_g: 38, fat_g: 14 },
    badges: ["Diabetes-Friendly", "Low Sodium"],
    image: "/images/smart-menu/lunch/chicken-stirfry.jpg",
    ingredients: [
      { item: "chicken breast (cubed)", amount: "5 oz (140 g)" },
      { item: "broccoli, peppers, carrots", amount: "2 cups (200 g)" },
      { item: "low-sodium soy sauce", amount: "2 tbsp (30 ml)" },
      { item: "brown rice (cooked)", amount: "1/2 cup (90 g)" },
      { item: "olive oil", amount: "1 tsp (5 ml)" }
    ],
    instructions: [
      "Heat oil in pan; cook chicken until browned.",
      "Add veggies and stir-fry 3–4 min.",
      "Add soy sauce; serve over rice."
    ]
  },
  {
    id: "ln-006",
    name: "Shrimp Tacos (Cabbage Slaw)",
    macros: { calories: 400, protein_g: 28, carbs_g: 34, fat_g: 16 },
    badges: ["Gluten-Free Option", "Balanced"],
    image: "/images/smart-menu/lunch/shrimp-tacos.jpg",
    ingredients: [
      { item: "shrimp (peeled)", amount: "5 oz (140 g)" },
      { item: "corn tortillas", amount: "2 small (50 g)" },
      { item: "cabbage slaw", amount: "1 cup (90 g)" },
      { item: "avocado crema (light)", amount: "2 tbsp (30 g)" }
    ],
    instructions: [
      "Sauté shrimp in pan until pink.",
      "Warm tortillas, fill with shrimp and slaw.",
      "Top with avocado crema."
    ]
  },
  {
    id: "ln-007",
    name: "Mediterranean Chickpea Bowl",
    macros: { calories: 410, protein_g: 22, carbs_g: 48, fat_g: 14 },
    badges: ["Plant-Based", "High Fiber"],
    image: "/images/smart-menu/lunch/chickpea-bowl.jpg",
    ingredients: [
      { item: "chickpeas (cooked)", amount: "1 cup (160 g)" },
      { item: "brown rice (cooked)", amount: "1/2 cup (90 g)" },
      { item: "tomatoes & cucumber", amount: "1 cup (150 g)" },
      { item: "tahini dressing", amount: "1 tbsp (15 g)" }
    ],
    instructions: [
      "Layer rice, chickpeas, and veggies.",
      "Drizzle tahini on top."
    ]
  },
  {
    id: "ln-008",
    name: "Beef & Veggie Lettuce Wraps",
    macros: { calories: 380, protein_g: 32, carbs_g: 20, fat_g: 18 },
    badges: ["Low Carb", "Keto-Friendly"],
    image: "/images/smart-menu/lunch/beef-lettuce-wraps.jpg",
    ingredients: [
      { item: "lean ground beef", amount: "4 oz (113 g)" },
      { item: "romaine lettuce leaves", amount: "3–4" },
      { item: "diced peppers & onion", amount: "1/2 cup (75 g)" },
      { item: "low-sodium soy sauce", amount: "1 tbsp (15 ml)" }
    ],
    instructions: [
      "Cook beef with peppers/onion in a pan.",
      "Spoon mixture into lettuce leaves.",
      "Top with a dash of soy sauce."
    ]
  },
  {
    id: "ln-009",
    name: "Quinoa & Black Bean Bowl",
    macros: { calories: 400, protein_g: 24, carbs_g: 52, fat_g: 10 },
    badges: ["Vegetarian", "Low Glycemic"],
    image: "/images/smart-menu/lunch/quinoa-blackbean-bowl.jpg",
    ingredients: [
      { item: "quinoa (cooked)", amount: "1 cup (185 g)" },
      { item: "black beans (rinsed)", amount: "1/2 cup (85 g)" },
      { item: "corn", amount: "1/4 cup (40 g)" },
      { item: "salsa", amount: "2 tbsp (30 g)" }
    ],
    instructions: [
      "Combine quinoa, beans, and corn.",
      "Top with salsa before serving."
    ]
  },
  {
    id: "ln-010",
    name: "Tuna Salad Stuffed Avocado",
    macros: { calories: 360, protein_g: 28, carbs_g: 14, fat_g: 20 },
    badges: ["Low Carb", "Heart-Healthy"],
    image: "/images/smart-menu/lunch/tuna-avocado.jpg",
    ingredients: [
      { item: "canned tuna in water", amount: "1 can (120 g drained)" },
      { item: "avocado", amount: "1 medium, halved" },
      { item: "Greek yogurt", amount: "2 tbsp (30 g)" },
      { item: "celery (diced)", amount: "1/4 cup (30 g)" }
    ],
    instructions: [
      "Mix tuna with yogurt and celery.",
      "Spoon into avocado halves."
    ]
  }
];

export default smartMenuLunch;
