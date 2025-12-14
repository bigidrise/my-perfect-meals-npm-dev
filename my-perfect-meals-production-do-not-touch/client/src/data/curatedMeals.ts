
export type MedicalBadge = "low-sugar" | "diabetes-friendly" | "gluten-free" | "heart-healthy" | "high-protein";

export type CuratedMeal = {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number; protein: number; carbs: number; fat: number;
  badges: MedicalBadge[];
  ingredients: { name: string; quantity: number; unit: string; notes?: string }[];
  instructions: string[];
};

export const CURATED_MEALS: CuratedMeal[] = [
  {
    id: "greek-yogurt-berries",
    name: "Greek Yogurt & Berries",
    mealType: "breakfast",
    calories: 320, protein: 28, carbs: 35, fat: 8,
    badges: ["high-protein", "diabetes-friendly"],
    ingredients: [
      { name: "Greek yogurt", quantity: 7, unit: "oz", notes: "plain, 2%" },
      { name: "mixed berries", quantity: 4, unit: "oz" },
      { name: "honey", quantity: 1, unit: "tsp", notes: "optional" },
    ],
    instructions: [
      "Spoon yogurt into a bowl.",
      "Top with berries.",
      "Drizzle honey if desired."
    ],
  },
  {
    id: "chicken-salad-bowl",
    name: "Grilled Chicken Salad",
    mealType: "lunch",
    calories: 480, protein: 40, carbs: 28, fat: 20,
    badges: ["gluten-free", "high-protein", "heart-healthy"],
    ingredients: [
      { name: "chicken breast", quantity: 5, unit: "oz", notes: "cooked" },
      { name: "mixed greens", quantity: 2, unit: "cup" },
      { name: "cherry tomatoes", quantity: 3.5, unit: "oz" },
      { name: "cucumber", quantity: 3, unit: "oz" },
      { name: "olive oil and lemon dressing", quantity: 2, unit: "tbsp" },
    ],
    instructions: [
      "Slice the cooked chicken.",
      "Toss greens with tomatoes and cucumber.",
      "Dress and top with chicken."
    ],
  },
  {
    id: "salmon-quinoa-broccoli",
    name: "Salmon, Quinoa & Broccoli",
    mealType: "dinner",
    calories: 620, protein: 42, carbs: 45, fat: 24,
    badges: ["heart-healthy", "gluten-free"],
    ingredients: [
      { name: "salmon fillet", quantity: 6, unit: "oz" },
      { name: "quinoa", quantity: 5, unit: "oz", notes: "cooked" },
      { name: "broccoli", quantity: 5, unit: "oz", notes: "steamed" },
      { name: "olive oil", quantity: 1, unit: "tbsp" },
    ],
    instructions: [
      "Season salmon with salt/pepper.",
      "Pan-sear 3–4 min per side until just cooked.",
      "Serve with cooked quinoa and steamed broccoli; drizzle oil."
    ],
  },
  {
    id: "egg-veg-scramble",
    name: "Egg & Veg Scramble",
    mealType: "breakfast",
    calories: 350, protein: 24, carbs: 10, fat: 22,
    badges: ["low-sugar", "high-protein"],
    ingredients: [
      { name: "eggs", quantity: 3, unit: "each", notes: "large" },
      { name: "spinach", quantity: 1, unit: "cup" },
      { name: "bell pepper", quantity: 0.5, unit: "each", notes: "medium" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
    ],
    instructions: [
      "Beat eggs with a pinch of salt.",
      "Sauté pepper and spinach 2–3 min.",
      "Add eggs and scramble until set."
    ],
  },
  {
    id: "beef-brown-rice-bowl",
    name: "Beef & Brown Rice Bowl",
    mealType: "lunch",
    calories: 610, protein: 38, carbs: 55, fat: 20,
    badges: ["high-protein"],
    ingredients: [
      { name: "ground beef", quantity: 5, unit: "oz", notes: "lean" },
      { name: "brown rice", quantity: 6, unit: "oz", notes: "cooked" },
      { name: "green beans", quantity: 4, unit: "oz" },
    ],
    instructions: [
      "Brown beef; season with salt/pepper.",
      "Steam green beans until tender-crisp.",
      "Serve beef over rice with green beans."
    ],
  },
  {
    id: "shrimp-taco-bowl",
    name: "Shrimp Taco Bowl",
    mealType: "dinner",
    calories: 520, protein: 35, carbs: 50, fat: 16,
    badges: ["gluten-free"],
    ingredients: [
      { name: "shrimp", quantity: 5.5, unit: "oz", notes: "peeled" },
      { name: "black beans", quantity: 4, unit: "oz" },
      { name: "corn", quantity: 3, unit: "oz" },
      { name: "rice", quantity: 5, unit: "oz", notes: "lime-cilantro, cooked" },
    ],
    instructions: [
      "Sauté shrimp with taco seasoning 3–4 min.",
      "Assemble with rice, beans, corn; finish with lime."
    ],
  },
];
