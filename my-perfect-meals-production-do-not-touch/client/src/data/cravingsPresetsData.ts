
export type Ingredient = { 
  name: string; 
  quantity: number; 
  unit: string;
  notes?: string;
};

export type CravingPreset = {
  id: string;
  name: string;
  image?: string;
  summary?: string;
  baseServings: number;
  ingredients: Ingredient[];
  instructions: string[];
  badges?: string[];
  tags?: string[];
  macros?: { calories: number; protein: number; carbs: number; fat: number };
};

export const CRAVING_PRESETS: CravingPreset[] = [
  {
    id: "crv-001",
    name: "Chocolate Protein Mousse",
    image: "/images/cravings/choc-mousse.jpg",
    summary: "Creamy, chocolatey, high‑protein comfort.",
    baseServings: 1,
    ingredients: [
      { name: "Greek yogurt", quantity: 170, unit: "g", notes: "2%-5%" },
      { name: "cocoa", quantity: 1.5, unit: "tbsp", notes: "unsweetened" },
      { name: "sweetener", quantity: 1, unit: "tbsp", notes: "zero-cal or maple" },
      { name: "vanilla extract", quantity: 0.5, unit: "tsp" },
      { name: "salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Whisk yogurt, cocoa, sweetener, vanilla, salt until smooth.",
      "Chill 10+ min for thicker texture.",
      "Optional: top with berries or dark chocolate shavings."
    ],
    badges: ["High protein", "Low sugar"],
    tags: ["chocolate", "dessert", "protein"],
    macros: { calories: 180, protein: 23, carbs: 13, fat: 4 }
  },
  {
    id: "crv-002",
    name: "Strawberry Cheesecake Parfait",
    image: "/images/cravings/strawberry-cheesecake-parfait.jpg",
    summary: "Cheesecake vibe without the crash.",
    baseServings: 1,
    ingredients: [
      { name: "Greek yogurt", quantity: 170, unit: "g", notes: "nonfat" },
      { name: "cream cheese", quantity: 28, unit: "g", notes: "light" },
      { name: "vanilla extract", quantity: 0.5, unit: "tsp" },
      { name: "strawberries", quantity: 0.75, unit: "cup", notes: "sliced" },
      { name: "graham crumbs", quantity: 1, unit: "tbsp", notes: "or HF alternative" },
      { name: "sweetener", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix yogurt, cream cheese, vanilla, sweetener until fluffy.",
      "Layer with strawberries and crumbs in a glass.",
      "Top with extra berries."
    ],
    badges: ["High protein", "Lower sugar"],
    tags: ["strawberry", "cheesecake", "parfait"],
    macros: { calories: 220, protein: 18, carbs: 28, fat: 5 }
  },
  {
    id: "crv-003",
    name: "Cinnamon Roll Protein Oats",
    image: "/images/cravings/cinnamon-roll-oats.jpg",
    summary: "Warm, cozy, frosting vibes.",
    baseServings: 1,
    ingredients: [
      { name: "rolled oats", quantity: 40, unit: "g" },
      { name: "protein powder", quantity: 24, unit: "g", notes: "vanilla" },
      { name: "cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "almond milk", quantity: 240, unit: "ml", notes: "unsweetened" },
      { name: "Greek yogurt", quantity: 60, unit: "g", notes: "topping" },
      { name: "sweetener", quantity: 1, unit: "tsp", notes: "to taste" }
    ],
    instructions: [
      "Cook oats with milk, cinnamon until creamy.",
      "Stir in protein powder off heat.",
      "Top with yogurt swirl and extra cinnamon."
    ],
    badges: ["High protein", "High fiber"],
    tags: ["oatmeal", "cinnamon", "breakfast"],
    macros: { calories: 290, protein: 27, carbs: 33, fat: 6 }
  },
  {
    id: "crv-004",
    name: "Apple Pie Crumble Cup",
    image: "/images/cravings/apple-crumble-cup.jpg",
    summary: "Pie flavor, weeknight speed.",
    baseServings: 1,
    ingredients: [
      { name: "apple", quantity: 1, unit: "each", notes: "diced" },
      { name: "rolled oats", quantity: 20, unit: "g" },
      { name: "flour", quantity: 1, unit: "tbsp", notes: "almond or oat" },
      { name: "cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "butter", quantity: 1, unit: "tsp", notes: "melted, or coconut oil" },
      { name: "sweetener", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Toss diced apple with half the cinnamon.",
      "Mix oats, flour, remaining cinnamon, butter, sweetener.",
      "Layer apple, then crumble; microwave 60-90 sec or bake 350°F 12 min."
    ],
    badges: ["High fiber"],
    tags: ["apple", "dessert", "crumble"],
    macros: { calories: 210, protein: 4, carbs: 38, fat: 6 }
  },
  {
    id: "crv-005",
    name: "Peanut Butter Cup Bites",
    image: "/images/cravings/pb-cup-bites.jpg",
    summary: "Salty‑sweet, chocolate‑peanut hit with control.",
    baseServings: 1,
    ingredients: [
      { name: "peanut butter", quantity: 1, unit: "tbsp", notes: "natural" },
      { name: "dark chocolate chips", quantity: 1, unit: "tbsp", notes: "60-70%" },
      { name: "oat flour", quantity: 1, unit: "tbsp", notes: "or protein crisps" },
      { name: "salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Mix PB with oat flour and salt; roll into 4-5 small balls.",
      "Melt chocolate chips; dip each ball halfway.",
      "Chill 15 min until set."
    ],
    badges: ["Portion controlled"],
    tags: ["peanut butter", "chocolate", "snack"],
    macros: { calories: 190, protein: 6, carbs: 13, fat: 13 }
  },
  {
    id: "crv-006",
    name: "Salt-&-Vinegar Roasted Chickpeas",
    image: "/images/cravings/sv-chickpeas.jpg",
    summary: "Crunch like chips, fiber like a champ.",
    baseServings: 1,
    ingredients: [
      { name: "chickpeas", quantity: 120, unit: "g", notes: "canned, drained" },
      { name: "apple cider vinegar", quantity: 1.5, unit: "tbsp" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Pat chickpeas dry; toss with oil, vinegar, salt.",
      "Air-fry 375°F / 190°C 12-15 min, shaking twice.",
      "Cool 5 min to maximize crunch."
    ],
    badges: ["High fiber"],
    tags: ["crunchy", "salty", "snack"],
    macros: { calories: 180, protein: 9, carbs: 22, fat: 6 }
  },
  {
    id: "crv-007",
    name: "BBQ Potato Wedges (Air‑Fryer)",
    image: "/images/cravings/bbq-wedges.jpg",
    summary: "Fries energy, less grease.",
    baseServings: 1,
    ingredients: [
      { name: "russet potato", quantity: 200, unit: "g", notes: "wedged" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "BBQ seasoning", quantity: 1, unit: "tsp", notes: "low-sodium" }
    ],
    instructions: [
      "Toss wedges with oil and seasoning.",
      "Air‑fry 400°F / 205°C 15–18 min, shaking once.",
      "Finish with extra BBQ seasoning if desired."
    ],
    badges: ["Lower fat"],
    tags: ["potato", "bbq", "crispy"],
    macros: { calories: 220, protein: 5, carbs: 38, fat: 6 }
  },
  {
    id: "crv-008",
    name: "Crispy Chicken Tenders (Air‑Fryer)",
    image: "/images/cravings/chicken-tenders.jpg",
    summary: "Crispy outside, juicy inside.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 120, unit: "g", notes: "strips" },
      { name: "egg white", quantity: 1, unit: "each" },
      { name: "panko crumbs", quantity: 0.5, unit: "cup", notes: "whole-wheat preferred" },
      { name: "paprika and garlic powder", quantity: 1, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Dip strips in egg white, then seasoned panko.",
      "Air‑fry 400°F / 205°C 8-10 min, flipping once.",
      "Check internal temp 165°F / 74°C."
    ],
    badges: ["High protein"],
    tags: ["chicken", "crispy", "protein"],
    macros: { calories: 230, protein: 28, carbs: 18, fat: 6 }
  },
  {
    id: "crv-009",
    name: "Portobello Pizza Caps",
    image: "/images/cravings/portobello-pizza.jpg",
    summary: "Pizza flavor, veggie base.",
    baseServings: 1,
    ingredients: [
      { name: "portobello cap", quantity: 1, unit: "each", notes: "large" },
      { name: "marinara", quantity: 2, unit: "tbsp", notes: "no-sugar-added" },
      { name: "mozzarella", quantity: 28, unit: "g", notes: "part-skim, shredded" },
      { name: "turkey pepperoni", quantity: 6, unit: "slice", notes: "optional" }
    ],
    instructions: [
      "Scoop gills lightly; pat cap dry.",
      "Fill with marinara, cheese, pepperoni.",
      "Bake 375°F / 190°C 12-15 min until cheese bubbles."
    ],
    badges: ["Low carb"],
    tags: ["pizza", "mushroom", "cheese"],
    macros: { calories: 190, protein: 18, carbs: 8, fat: 10 }
  },
  {
    id: "crv-010",
    name: "Turkey Nacho Skillet (Single‑Serve)",
    image: "/images/cravings/turkey-nacho-skillet.jpg",
    summary: "Nacho fix, protein‑forward.",
    baseServings: 1,
    ingredients: [
      { name: "ground turkey", quantity: 120, unit: "g", notes: "extra-lean" },
      { name: "taco seasoning", quantity: 1, unit: "tsp", notes: "low-sodium" },
      { name: "black beans", quantity: 60, unit: "g", notes: "rinsed" },
      { name: "salsa", quantity: 2, unit: "tbsp" },
      { name: "tortilla chips", quantity: 15, unit: "g", notes: "baked" },
      { name: "shredded cheese", quantity: 28, unit: "g" }
    ],
    instructions: [
      "Brown turkey with taco seasoning.",
      "Add beans, salsa; simmer 2 min.",
      "Top chips with turkey mix and cheese; broil 1-2 min."
    ],
    badges: ["High protein"],
    tags: ["nacho", "turkey", "mexican"],
    macros: { calories: 270, protein: 27, carbs: 18, fat: 9 }
  },
  {
    id: "crv-011",
    name: "2‑Ingredient Banana Soft‑Serve",
    image: "/images/cravings/banana-soft-serve.jpg",
    summary: "Ice‑cream feel, fruit‑first.",
    baseServings: 1,
    ingredients: [
      { name: "banana", quantity: 120, unit: "g", notes: "frozen ripe, coins" },
      { name: "almond milk", quantity: 30, unit: "ml", notes: "unsweetened" }
    ],
    instructions: [
      "Blend bananas with milk, scraping as needed, until soft‑serve.",
      "Optional: add vanilla or cinnamon."
    ],
    badges: ["No added sugar"],
    tags: ["ice cream", "banana", "simple"],
    macros: { calories: 120, protein: 2, carbs: 30, fat: 0 }
  },
  {
    id: "crv-012",
    name: "Chocolate PB 'Milkshake'",
    image: "/images/cravings/choc-pb-shake.jpg",
    summary: "Thick, rich, macro‑friendly.",
    baseServings: 1,
    ingredients: [
      { name: "protein powder", quantity: 30, unit: "g", notes: "chocolate" },
      { name: "banana", quantity: 100, unit: "g", notes: "frozen" },
      { name: "peanut butter", quantity: 1, unit: "tbsp" },
      { name: "almond milk", quantity: 240, unit: "ml", notes: "unsweetened" },
      { name: "ice cubes", quantity: 4, unit: "each" }
    ],
    instructions: [
      "Blend everything on high until thick and smooth.",
      "Add more ice for thicker consistency."
    ],
    badges: ["High protein"],
    tags: ["shake", "chocolate", "peanut butter"],
    macros: { calories: 260, protein: 25, carbs: 25, fat: 8 }
  },
  {
    id: "crv-013",
    name: "Oatmeal Chocolate‑Chip Cookie (Mug/Air‑Fryer)",
    image: "/images/cravings/oat-cookie.jpg",
    summary: "Chewy, gooey center; better macros.",
    baseServings: 1,
    ingredients: [
      { name: "oat flour", quantity: 30, unit: "g" },
      { name: "applesauce", quantity: 2, unit: "tbsp", notes: "unsweetened" },
      { name: "egg white", quantity: 1, unit: "each" },
      { name: "dark chocolate chips", quantity: 1, unit: "tbsp" },
      { name: "vanilla and salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Mix all; form into cookie shape in oven‑safe mug or air‑fryer basket.",
      "Bake 350°F / 175°C 8-10 min or air‑fry 320°F 6-8 min.",
      "Cool slightly before eating."
    ],
    badges: ["Lower sugar"],
    tags: ["cookie", "oatmeal", "chocolate chip"],
    macros: { calories: 200, protein: 7, carbs: 28, fat: 7 }
  },
  {
    id: "crv-014",
    name: "Baked Cinnamon Donut Holes",
    image: "/images/cravings/donut-holes.jpg",
    summary: "Donut shop vibe, oven method.",
    baseServings: 1,
    ingredients: [
      { name: "oat flour", quantity: 30, unit: "g" },
      { name: "Greek yogurt", quantity: 45, unit: "g", notes: "plain" },
      { name: "egg white", quantity: 1, unit: "each" },
      { name: "baking powder", quantity: 0.5, unit: "tsp" },
      { name: "cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "sweetener", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Whisk batter until smooth; roll into 6-8 small balls.",
      "Bake 375°F / 190°C 8-10 min until golden.",
      "Optional: roll in cinnamon-sweetener mix while warm."
    ],
    badges: ["Baked not fried"],
    tags: ["donut", "cinnamon", "baked"],
    macros: { calories: 160, protein: 9, carbs: 24, fat: 3 }
  },
  {
    id: "crv-015",
    name: "Air‑Fryer Fries (Real Potato)",
    image: "/images/cravings/airfries.jpg",
    summary: "Crisp edges, tender centers.",
    baseServings: 1,
    ingredients: [
      { name: "russet potato", quantity: 220, unit: "g", notes: "sticks" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Soak sticks 10 min, dry well.",
      "Toss with oil/salt; air‑fry 390°F / 200°C 16–20 min, shaking."
    ],
    badges: ["Lower fat"],
    tags: ["fries", "potato", "crispy"],
    macros: { calories: 240, protein: 5, carbs: 42, fat: 6 }
  },
  {
    id: "crv-016",
    name: "Light 'Mac' & Cheese (Cauli‑Mac Blend)",
    image: "/images/cravings/cauli-mac.jpg",
    summary: "Creamy, cheesy, sneaky veg.",
    baseServings: 1,
    ingredients: [
      { name: "elbow pasta", quantity: 40, unit: "g", notes: "whole-wheat, dry" },
      { name: "cauliflower florets", quantity: 120, unit: "g" },
      { name: "cheddar", quantity: 28, unit: "g", notes: "part-skim, shredded" },
      { name: "Greek yogurt", quantity: 45, unit: "g" },
      { name: "mustard and garlic powder", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Cook pasta and cauliflower together until tender; drain.",
      "Mix with cheese, yogurt, mustard, garlic powder until creamy.",
      "Season with salt/pepper to taste."
    ],
    badges: ["Hidden veggies"],
    tags: ["mac and cheese", "cauliflower", "comfort food"],
    macros: { calories: 250, protein: 15, carbs: 36, fat: 7 }
  },
  {
    id: "crv-017",
    name: "90‑Second Brownie Mug",
    image: "/images/cravings/mug-brownie.jpg",
    summary: "Fudgy fix, portion‑controlled.",
    baseServings: 1,
    ingredients: [
      { name: "oat flour", quantity: 30, unit: "g" },
      { name: "cocoa", quantity: 1.5, unit: "tbsp", notes: "unsweetened" },
      { name: "sweetener", quantity: 1, unit: "tbsp", notes: "or maple" },
      { name: "milk", quantity: 60, unit: "ml", notes: "of choice" },
      { name: "baking powder", quantity: 0.25, unit: "tsp" },
      { name: "salt", quantity: 1, unit: "pinch" }
    ],
    instructions: [
      "Mix dry ingredients in microwave‑safe mug.",
      "Add milk; stir until smooth.",
      "Microwave 75-90 sec until set but still fudgy."
    ],
    badges: ["Single serving"],
    tags: ["brownie", "chocolate", "microwave"],
    macros: { calories: 175, protein: 5, carbs: 30, fat: 4 }
  },
  {
    id: "crv-018",
    name: "Loaded Cauliflower 'Potato' Salad",
    image: "/images/cravings/cauli-potato-salad.jpg",
    summary: "Picnic vibes, lighter base.",
    baseServings: 1,
    ingredients: [
      { name: "cauliflower", quantity: 200, unit: "g", notes: "steamed and cooled" },
      { name: "Greek yogurt", quantity: 45, unit: "g" },
      { name: "Dijon mustard", quantity: 1, unit: "tsp" },
      { name: "green onion", quantity: 1, unit: "tbsp", notes: "chopped" },
      { name: "turkey bacon bits", quantity: 1, unit: "tbsp" },
      { name: "cheddar", quantity: 14, unit: "g", notes: "diced" }
    ],
    instructions: [
      "Chop steamed cauliflower into bite‑size pieces.",
      "Mix yogurt, mustard, green onion.",
      "Toss cauliflower with dressing, top with bacon and cheese."
    ],
    badges: ["Lower carb"],
    tags: ["salad", "cauliflower", "loaded"],
    macros: { calories: 165, protein: 12, carbs: 12, fat: 8 }
  },
  {
    id: "crv-019",
    name: "Buffalo Chicken Lettuce Wraps",
    image: "/images/cravings/buffalo-wraps.jpg",
    summary: "Wing flavor, no mess.",
    baseServings: 1,
    ingredients: [
      { name: "chicken breast", quantity: 120, unit: "g", notes: "cooked, diced" },
      { name: "buffalo sauce", quantity: 2, unit: "tbsp", notes: "low-sodium" },
      { name: "Greek yogurt", quantity: 30, unit: "g" },
      { name: "celery", quantity: 2, unit: "tbsp", notes: "diced" },
      { name: "butter lettuce leaves", quantity: 4, unit: "each" }
    ],
    instructions: [
      "Mix chicken with buffalo sauce.",
      "Fill lettuce cups with buffalo chicken.",
      "Top with yogurt dollop and diced celery."
    ],
    badges: ["High protein", "Low carb"],
    tags: ["buffalo", "chicken", "wraps"],
    macros: { calories: 180, protein: 30, carbs: 4, fat: 4 }
  },
  {
    id: "crv-020",
    name: "Vanilla Protein Pancake Stack",
    image: "/images/cravings/protein-pancakes.jpg",
    summary: "Sunday morning vibes, macro‑friendly.",
    baseServings: 1,
    ingredients: [
      { name: "protein powder", quantity: 30, unit: "g", notes: "vanilla" },
      { name: "egg white", quantity: 2, unit: "each" },
      { name: "banana", quantity: 0.5, unit: "each", notes: "mashed" },
      { name: "baking powder", quantity: 0.5, unit: "tsp" },
      { name: "cinnamon", quantity: 0.25, unit: "tsp" },
      { name: "almond milk", quantity: 60, unit: "ml", notes: "unsweetened" }
    ],
    instructions: [
      "Blend all ingredients until smooth batter forms.",
      "Cook 3-4 small pancakes in non‑stick pan, 2 min per side.",
      "Stack and top with berries or sugar‑free syrup."
    ],
    badges: ["High protein"],
    tags: ["pancakes", "protein", "breakfast"],
    macros: { calories: 240, protein: 28, carbs: 20, fat: 5 }
  },
  {
    id: "crv-021",
    name: "Matcha Energy Balls",
    image: "/images/cravings/matcha-energy-balls.jpg",
    summary: "Earthy, energizing bites with green tea power.",
    baseServings: 1,
    ingredients: [
      { name: "rolled oats", quantity: 40, unit: "g" },
      { name: "almond butter", quantity: 1, unit: "tbsp" },
      { name: "honey", quantity: 1, unit: "tbsp", notes: "or maple syrup" },
      { name: "matcha powder", quantity: 1, unit: "tsp" },
      { name: "chia seeds", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix everything until combined.",
      "Roll into 4–5 small balls; chill 15 min to set."
    ],
    badges: ["Energizing", "Antioxidant-rich"],
    tags: ["green tea", "bites", "snack"],
    macros: { calories: 220, protein: 8, carbs: 26, fat: 9 }
  },
  {
    id: "crv-022",
    name: "Spicy Mango Yogurt Bowl",
    image: "/images/cravings/spicy-mango-yogurt-bowl.jpg",
    summary: "Tropical sweetness meets chili heat.",
    baseServings: 1,
    ingredients: [
      { name: "Greek yogurt", quantity: 150, unit: "g", notes: "plain" },
      { name: "mango", quantity: 0.5, unit: "cup", notes: "diced" },
      { name: "chili-lime seasoning", quantity: 0.25, unit: "tsp" },
      { name: "honey", quantity: 1, unit: "tsp", notes: "or agave" }
    ],
    instructions: [
      "Stir yogurt and honey together.",
      "Top with mango and sprinkle chili-lime seasoning."
    ],
    badges: ["High protein", "Refreshing"],
    tags: ["spicy", "fruit", "sweet"],
    macros: { calories: 180, protein: 15, carbs: 22, fat: 4 }
  },
  {
    id: "crv-023",
    name: "Mediterranean Hummus Plate",
    image: "/images/cravings/mediterranean-hummus-plate.jpg",
    summary: "Creamy hummus with crisp veggie dippers.",
    baseServings: 1,
    ingredients: [
      { name: "hummus", quantity: 3, unit: "tbsp" },
      { name: "carrot sticks", quantity: 0.5, unit: "cup" },
      { name: "cucumber slices", quantity: 0.5, unit: "cup" },
      { name: "olive oil", quantity: 1, unit: "tsp", notes: "drizzle" }
    ],
    instructions: [
      "Spread hummus on a plate.",
      "Arrange veggies and drizzle olive oil on top."
    ],
    badges: ["Plant-based", "High fiber"],
    tags: ["savory", "veggie", "dip"],
    macros: { calories: 190, protein: 6, carbs: 16, fat: 11 }
  },
  {
    id: "crv-024",
    name: "Thai Peanut Lettuce Cups",
    image: "/images/cravings/thai-peanut-lettuce-cups.jpg",
    summary: "Crunchy, sweet-salty peanut flavor in lettuce wraps.",
    baseServings: 1,
    ingredients: [
      { name: "lettuce leaves", quantity: 3, unit: "each" },
      { name: "chicken", quantity: 80, unit: "g", notes: "shredded, or tofu" },
      { name: "peanut sauce", quantity: 1.5, unit: "tbsp" },
      { name: "carrots", quantity: 0.25, unit: "cup", notes: "shredded" }
    ],
    instructions: [
      "Fill lettuce leaves with chicken, sauce, and carrots.",
      "Roll and eat immediately."
    ],
    badges: ["High protein", "Lower carb"],
    tags: ["savory", "asian", "crunchy"],
    macros: { calories: 210, protein: 20, carbs: 9, fat: 11 }
  },
  {
    id: "crv-025",
    name: "Coconut Chia Pudding",
    image: "/images/cravings/coconut-chia-pudding.jpg",
    summary: "Creamy coconut base with fiber and omega-3s.",
    baseServings: 1,
    ingredients: [
      { name: "chia seeds", quantity: 2, unit: "tbsp" },
      { name: "coconut milk", quantity: 120, unit: "ml", notes: "light" },
      { name: "vanilla extract", quantity: 0.25, unit: "tsp" },
      { name: "sweetener", quantity: 1, unit: "tsp", notes: "optional" }
    ],
    instructions: [
      "Mix all ingredients in a jar.",
      "Refrigerate 3+ hours until thick."
    ],
    badges: ["High fiber", "Vegan"],
    tags: ["pudding", "sweet", "creamy"],
    macros: { calories: 200, protein: 5, carbs: 16, fat: 12 }
  },
  {
    id: "crv-026",
    name: "Protein Trail Mix Clusters",
    image: "/images/cravings/protein-trailmix-clusters.jpg",
    summary: "Crunchy, salty-sweet trail mix clusters.",
    baseServings: 1,
    ingredients: [
      { name: "mixed nuts", quantity: 25, unit: "g" },
      { name: "pumpkin seeds", quantity: 10, unit: "g" },
      { name: "dried cranberries", quantity: 10, unit: "g" },
      { name: "protein powder", quantity: 10, unit: "g", notes: "vanilla" },
      { name: "honey", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Mix everything in a bowl.",
      "Bake or air-fry 300°F / 150°C for 10 min until lightly set."
    ],
    badges: ["High protein", "On-the-go"],
    tags: ["trail mix", "sweet-salty", "snack"],
    macros: { calories: 240, protein: 12, carbs: 18, fat: 14 }
  },
  {
    id: "crv-027",
    name: "Mini Caprese Skewers",
    image: "/images/cravings/mini-caprese-skewers.jpg",
    summary: "Tomato, mozzarella, basil — Italian simplicity.",
    baseServings: 1,
    ingredients: [
      { name: "cherry tomatoes", quantity: 6, unit: "each" },
      { name: "mozzarella balls", quantity: 4, unit: "each", notes: "mini" },
      { name: "basil leaves", quantity: 4, unit: "each", notes: "fresh" },
      { name: "balsamic glaze", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Thread tomato, mozzarella, and basil onto skewers.",
      "Drizzle with balsamic glaze."
    ],
    badges: ["Fresh", "Low carb"],
    tags: ["savory", "italian", "bite-size"],
    macros: { calories: 160, protein: 9, carbs: 6, fat: 11 }
  },
  {
    id: "crv-028",
    name: "Sweet Potato Fries (Air-Fryer)",
    image: "/images/cravings/sweet-potato-fries.jpg",
    summary: "Naturally sweet and crispy edges.",
    baseServings: 1,
    ingredients: [
      { name: "sweet potato", quantity: 180, unit: "g", notes: "sticks" },
      { name: "olive oil", quantity: 1, unit: "tsp" },
      { name: "cinnamon and salt", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Toss sticks with oil and seasoning.",
      "Air-fry 400°F / 205°C for 15–18 min, shake halfway."
    ],
    badges: ["Whole food", "Lower fat"],
    tags: ["sweet", "crunchy", "side"],
    macros: { calories: 210, protein: 3, carbs: 35, fat: 7 }
  },
  {
    id: "crv-029",
    name: "Sushi Roll Snack Cups",
    image: "/images/cravings/sushi-roll-snack-cups.jpg",
    summary: "All sushi flavor, no rolling required.",
    baseServings: 1,
    ingredients: [
      { name: "sushi rice", quantity: 60, unit: "g", notes: "cooked" },
      { name: "imitation crab", quantity: 50, unit: "g", notes: "or tofu" },
      { name: "avocado", quantity: 0.25, unit: "each", notes: "diced" },
      { name: "nori flakes", quantity: 1, unit: "tsp" },
      { name: "soy sauce", quantity: 1, unit: "tsp", notes: "light" }
    ],
    instructions: [
      "Layer rice, crab, and avocado in a cup.",
      "Top with nori and drizzle soy sauce."
    ],
    badges: ["Balanced", "Creative"],
    tags: ["asian", "savory", "bowl"],
    macros: { calories: 210, protein: 9, carbs: 28, fat: 7 }
  },
  {
    id: "crv-030",
    name: "Chocolate-Covered Strawberry Bites",
    image: "/images/cravings/choc-strawberry-bites.jpg",
    summary: "Romantic, portion-controlled indulgence.",
    baseServings: 1,
    ingredients: [
      { name: "strawberries", quantity: 6, unit: "each", notes: "halved" },
      { name: "dark chocolate", quantity: 20, unit: "g", notes: "70%" },
      { name: "crushed almonds", quantity: 1, unit: "tsp", notes: "optional" }
    ],
    instructions: [
      "Dip strawberry halves in melted chocolate.",
      "Sprinkle almonds and chill until set."
    ],
    badges: ["Lower sugar", "Antioxidant"],
    tags: ["sweet", "chocolate", "fruit"],
    macros: { calories: 170, protein: 3, carbs: 20, fat: 9 }
  }
];
