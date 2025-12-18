
// client/src/data/toddlersMealsData.ts
// Data shape mirrors KidsMeals so the existing scaling UI works.
// Textures and prep steps are toddler-safe (1–3). Always supervise.

export type ToddlersMeal = {
  id: string;
  name: string;
  description: string;
  baseServings: number; // how the ingredient list was authored
  image?: string;
  healthBadges?: string[];
  ingredients: { name: string; quantity: number; unit: string; notes?: string }[];
  instructions?: string[];
  funFact?: string;
};

export const toddlersMeals: ToddlersMeal[] = [
  {
    id: "t1-mini-turkey-meatballs-peas",
    name: "Mini Turkey Meatballs with Sweet Peas",
    description: "Soft, tiny meatballs made with ground turkey, finely chopped veggies, and sweet peas on the side. Perfect finger food for developing pincer grasp.",
    baseServings: 2,
    image: "/images/toddlers/t1-mini-turkey-meatballs-peas.jpg",
    healthBadges: ["High Protein", "Iron-Rich", "Toddler-Safe"],
    ingredients: [
      { name: "ground turkey", quantity: 6, unit: "oz", notes: "93% lean" },
      { name: "breadcrumbs", quantity: 0.25, unit: "cup", notes: "fine" },
      { name: "egg", quantity: 0.5, unit: "each", notes: "beaten" },
      { name: "peas", quantity: 0.5, unit: "cup", notes: "steamed" }
    ],
    instructions: [
      "Mix turkey, crumbs, and egg; form 1-inch meatballs.",
      "Bake at 375°F ~12–14 min until cooked through (165°F).",
      "Cool; serve halved/quartered with tender peas."
    ],
  },
  {
    id: "t2-sweet-potato-mash-chicken-bites",
    name: "Sweet Potato Mash with Chicken Bites",
    description: "Smooth, naturally sweet mashed sweet potato with tender, bite-sized pieces of chicken breast.",
    baseServings: 2,
    image: "/images/toddlers/t2-sweet-potato-mash-chicken-bites.jpg",
    healthBadges: ["Vitamin A", "Soft Texture"],
    ingredients: [
      { name: "chicken breast", quantity: 3, unit: "oz", notes: "cooked, finely diced" },
      { name: "sweet potato", quantity: 1, unit: "cup", notes: "cooked, mashed" }
    ],
    instructions: [
      "Mash sweet potato; fold in chicken.",
      "Cool slightly; serve in ≤ 1/2-inch pieces."
    ],
  },
  {
    id: "t3-scrambled-egg-avocado-fingers",
    name: "Scrambled Egg & Avocado Fingers",
    description: "Soft scrambled egg with avocado strips.",
    baseServings: 2,
    image: "/images/toddlers/t3-scrambled-egg-avocado-fingers.jpg",
    healthBadges: ["Protein", "Healthy Fats"],
    ingredients: [
      { name: "eggs", quantity: 2, unit: "each" },
      { name: "avocado", quantity: 0.5, unit: "each", notes: "ripe" }
    ],
    instructions: [
      "Soft-scramble eggs on low heat.",
      "Slice avocado into thin strips; serve together."
    ],
  },
  {
    id: "t4-greek-yogurt-berries-oats",
    name: "Greek Yogurt, Berries & Oats",
    description: "Full-fat yogurt with soft berries and quick oats.",
    baseServings: 2,
    image: "/images/toddlers/t4-greek-yogurt-berries-oats.jpg",
    healthBadges: ["Calcium", "No Added Sugar"],
    ingredients: [
      { name: "greek yogurt", quantity: 0.75, unit: "cup", notes: "full-fat" },
      { name: "berries", quantity: 0.5, unit: "cup", notes: "very soft, chopped" },
      { name: "quick oats", quantity: 2, unit: "tbsp" }
    ],
  },
  {
    id: "t5-banana-oat-mini-pancakes",
    name: "Banana Oat Mini Pancakes",
    description: "Soft 2-ingredient style minis.",
    baseServings: 2,
    image: "/images/toddlers/t5-banana-oat-mini-pancakes.jpg",
    healthBadges: ["No Added Sugar", "Soft Texture"],
    ingredients: [
      { name: "banana", quantity: 1, unit: "each", notes: "ripe, mashed" },
      { name: "egg", quantity: 1, unit: "each" },
      { name: "quick oats", quantity: 2, unit: "tbsp", notes: "optional" }
    ],
    instructions: [
      "Mix banana + egg (+ oats).",
      "Cook 2-inch pancakes on low; cool and cut small."
    ],
  },
  {
    id: "t6-salmon-flakes-soft-rice",
    name: "Salmon Flakes & Soft Rice",
    description: "Flaked cooked salmon over soft rice.",
    baseServings: 2,
    image: "/images/toddlers/t6-salmon-flakes-soft-rice.jpg",
    healthBadges: ["Omega-3", "Protein"],
    ingredients: [
      { name: "salmon", quantity: 3, unit: "oz", notes: "cooked, flaked" },
      { name: "rice", quantity: 0.75, unit: "cup", notes: "cooked, very soft" }
    ],
  },
  {
    id: "t7-lentil-pasta-marinara-low-salt",
    name: "Lentil Pasta Marinara (Low-Salt)",
    description: "Soft lentil pasta with mild, low-salt sauce.",
    baseServings: 2,
    image: "/images/toddlers/t7-lentil-pasta-marinara-low-salt.jpg",
    healthBadges: ["Iron", "Fiber", "Hidden Veg Option"],
    ingredients: [
      { name: "lentil pasta", quantity: 1, unit: "cup", notes: "cooked very soft" },
      { name: "marinara sauce", quantity: 0.33, unit: "cup", notes: "low-salt" }
    ],
  },
  {
    id: "t8-cottage-cheese-pear-slices",
    name: "Cottage Cheese & Pear Slices",
    description: "Soft pear with cottage cheese.",
    baseServings: 2,
    image: "/images/toddlers/t8-cottage-cheese-pear-slices.jpg",
    healthBadges: ["Calcium", "Protein"],
    ingredients: [
      { name: "cottage cheese", quantity: 0.5, unit: "cup", notes: "full-fat" },
      { name: "pear", quantity: 0.5, unit: "each", notes: "ripe, peeled, thin slices" }
    ],
  },
  {
    id: "t9-black-bean-sweet-corn-soft-bowl",
    name: "Black Bean & Sweet Corn Soft Bowl",
    description: "Very soft beans with corn and a bit of rice.",
    baseServings: 2,
    image: "/images/toddlers/t9-black-bean-sweet-corn-soft-bowl.jpg",
    healthBadges: ["Fiber", "Plant Protein"],
    ingredients: [
      { name: "black beans", quantity: 0.5, unit: "cup", notes: "very soft" },
      { name: "sweet corn", quantity: 0.25, unit: "cup", notes: "soft" },
      { name: "rice", quantity: 0.25, unit: "cup", notes: "soft, optional" }
    ],
  },
  {
    id: "t10-butternut-squash-mac-hidden-veg",
    name: "Butternut Squash Mac (Hidden Veg)",
    description: "Creamy squash purée folded into soft pasta.",
    baseServings: 2,
    image: "/images/toddlers/t10-butternut-squash-mac-hidden-veg.jpg",
    healthBadges: ["Hidden Veg", "Soft Texture"],
    ingredients: [
      { name: "pasta", quantity: 1, unit: "cup", notes: "small shapes, very soft" },
      { name: "butternut squash purée", quantity: 0.5, unit: "cup" }
    ],
  },
  {
    id: "t11-chicken-carrot-rice-balls",
    name: "Chicken & Carrot Rice Balls",
    description: "Sticky rice with minced chicken and carrot.",
    baseServings: 2,
    image: "/images/toddlers/t11-chicken-carrot-rice-balls.jpg",
    healthBadges: ["Protein", "Hidden Veg"],
    ingredients: [
      { name: "chicken", quantity: 3, unit: "oz", notes: "cooked, minced" },
      { name: "carrot", quantity: 0.25, unit: "cup", notes: "very finely grated" },
      { name: "rice", quantity: 0.75, unit: "cup", notes: "sticky, warm" }
    ],
    instructions: [
      "Mix warm rice with chicken and carrot.",
      "Form tiny balls; cool; serve small pieces."
    ],
  },
  {
    id: "t12-hummus-soft-pita-strips",
    name: "Hummus & Soft Pita Strips",
    description: "Spreadable hummus with soft pita.",
    baseServings: 2,
    image: "/images/toddlers/t12-hummus-soft-pita-strips.jpg",
    healthBadges: ["Fiber", "Plant Protein"],
    ingredients: [
      { name: "hummus", quantity: 0.33, unit: "cup", notes: "plain" },
      { name: "pita", quantity: 0.5, unit: "each", notes: "soft, cut thin" }
    ],
  },
  {
    id: "t13-blueberry-chia-pudding",
    name: "Blueberry Chia Pudding",
    description: "Thick yogurt with blueberries + chia.",
    baseServings: 2,
    image: "/images/toddlers/t13-blueberry-chia-pudding.jpg",
    healthBadges: ["No Added Sugar", "Fiber"],
    ingredients: [
      { name: "yogurt", quantity: 0.75, unit: "cup", notes: "full-fat" },
      { name: "blueberries", quantity: 0.33, unit: "cup", notes: "very soft" },
      { name: "chia seeds", quantity: 1, unit: "tsp", notes: "soaked 10 min" }
    ],
  },
  {
    id: "t14-soft-broccoli-trees-cheddar",
    name: "Soft Broccoli Trees & Cheddar",
    description: "Steamed broccoli pieces with mild cheese.",
    baseServings: 2,
    image: "/images/toddlers/t14-soft-broccoli-trees-cheddar.jpg",
    healthBadges: ["Calcium", "Veggies"],
    ingredients: [
      { name: "broccoli florets", quantity: 0.75, unit: "cup", notes: "steamed very soft" },
      { name: "cheddar", quantity: 2, unit: "tbsp", notes: "mild, finely grated" }
    ],
  },
  {
    id: "t15-turkey-spinach-quesadilla-soft",
    name: "Turkey & Spinach Quesadilla (soft)",
    description: "Mild turkey + spinach in soft tortilla.",
    baseServings: 2,
    image: "/images/toddlers/t15-turkey-spinach-quesadilla-soft.jpg",
    healthBadges: ["Hidden Veg", "Iron"],
    ingredients: [
      { name: "flour tortilla", quantity: 1, unit: "each", notes: "soft" },
      { name: "turkey", quantity: 2, unit: "oz", notes: "cooked, minced" },
      { name: "spinach", quantity: 0.25, unit: "cup", notes: "finely chopped" },
      { name: "cheese", quantity: 2, unit: "tbsp", notes: "mild, shredded" }
    ],
  },
  {
    id: "t16-applesauce-oat-energy-bites",
    name: "Applesauce & Oat Energy Bites",
    description: "No-bake, no-sugar toddler bites.",
    baseServings: 2,
    image: "/images/toddlers/t16-applesauce-oat-energy-bites.jpg",
    healthBadges: ["No Added Sugar", "Soft Texture"],
    ingredients: [
      { name: "applesauce", quantity: 0.5, unit: "cup", notes: "unsweetened" },
      { name: "quick oats", quantity: 0.5, unit: "cup" }
    ],
    instructions: [
      "Stir oats into applesauce; rest 5–10 min to soften.",
      "Form small spoonfuls; serve soft."
    ],
  },
  {
    id: "t17-quinoa-peas-tiny-tofu-cubes",
    name: "Quinoa, Peas & Tiny Tofu Cubes",
    description: "Very soft quinoa with peas and tofu.",
    baseServings: 2,
    image: "/images/toddlers/t17-quinoa-peas-tiny-tofu-cubes.jpg",
    healthBadges: ["Plant Protein", "Iron"],
    ingredients: [
      { name: "quinoa", quantity: 0.75, unit: "cup", notes: "cooked, very soft" },
      { name: "tofu", quantity: 0.5, unit: "cup", notes: "silken/soft, tiny cubes" },
      { name: "peas", quantity: 0.25, unit: "cup", notes: "steamed" }
    ],
  },
  {
    id: "t18-mashed-cauliflower-ground-beef",
    name: "Mashed Cauliflower & Ground Beef",
    description: "Cauli mash with finely crumbled beef.",
    baseServings: 2,
    image: "/images/toddlers/t18-mashed-cauliflower-ground-beef.jpg",
    healthBadges: ["Hidden Veg", "Iron"],
    ingredients: [
      { name: "cauliflower florets", quantity: 1, unit: "cup", notes: "steamed, mashed" },
      { name: "ground beef", quantity: 3, unit: "oz", notes: "lean, cooked, crumbled" }
    ],
  },
  {
    id: "t19-pumpkin-yogurt-swirl",
    name: "Pumpkin Yogurt Swirl",
    description: "Pumpkin purée folded into full-fat yogurt.",
    baseServings: 2,
    image: "/images/toddlers/t19-pumpkin-yogurt-swirl.jpg",
    healthBadges: ["Vitamin A", "Calcium", "No Added Sugar"],
    ingredients: [
      { name: "yogurt", quantity: 0.75, unit: "cup", notes: "full-fat" },
      { name: "pumpkin purée", quantity: 0.33, unit: "cup" }
    ],
  },
  {
    id: "t20-avocado-chickpea-smash",
    name: "Avocado Chickpea Smash",
    description: "Soft smashable dip/spread.",
    baseServings: 2,
    image: "/images/toddlers/t20-avocado-chickpea-smash.jpg",
    healthBadges: ["Fiber", "Healthy Fats", "Plant Protein"],
    ingredients: [
      { name: "avocado", quantity: 0.5, unit: "each", notes: "ripe" },
      { name: "chickpeas", quantity: 0.33, unit: "cup", notes: "very soft" }
    ],
  },
];
