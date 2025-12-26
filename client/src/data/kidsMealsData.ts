// 20 PRE-DESIGNED KIDS MEALS for Kids Meals Hub
// Healthy, kid-friendly meals with fun presentation and balanced nutrition

export type KidsMeal = {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseServings: number;
  healthBadges: string[];
  ingredients: { name: string; quantity: number; unit: string; notes?: string }[];
  instructions: string[];
  funFact?: string;
  image?: string;
};

export const kidsMeals: KidsMeal[] = [
  {
    id: "mini-chicken-quesadillas",
    slug: "mini-chicken-quesadillas",
    name: "Mini Chicken Quesadillas",
    description: "Bite-sized quesadillas with tender chicken and cheese.",
    baseServings: 2,
    healthBadges: ["High Protein", "Kid Favorite"],
    ingredients: [
      { name: "flour tortillas", quantity: 4, unit: "each", notes: "small" },
      { name: "chicken", quantity: 5, unit: "oz", notes: "cooked, shredded" },
      { name: "cheddar cheese", quantity: 3.5, unit: "oz", notes: "mild, shredded" },
      { name: "bell peppers", quantity: 0.25, unit: "cup", notes: "diced fine" }
    ],
    instructions: [
      "Fill tortillas with chicken, cheese, and peppers.",
      "Cook in skillet 2-3 min per side until golden.",
      "Cut into triangles and serve with mild salsa."
    ],
    funFact: "Quesadillas means 'little cheeses' in Spanish!",
    image: "/images/kids-meals/mini-chicken-quesadillas.jpg" 
  },
  {
    id: "rainbow-veggie-pasta",
    slug: "rainbow-veggie-pasta",
    name: "Rainbow Veggie Pasta",
    description: "Colorful pasta with hidden vegetables in a creamy sauce.",
    baseServings: 4,
    healthBadges: ["Vegetarian", "Hidden Veggies"],
    ingredients: [
      { name: "pasta", quantity: 10, unit: "oz", notes: "whole wheat" },
      { name: "carrots", quantity: 1, unit: "cup", notes: "finely diced" },
      { name: "yellow bell pepper", quantity: 0.5, unit: "cup", notes: "diced" },
      { name: "zucchini", quantity: 0.5, unit: "cup", notes: "diced" },
      { name: "cream cheese", quantity: 3.5, unit: "oz" },
      { name: "milk", quantity: 0.5, unit: "cup" }
    ],
    instructions: [
      "Cook pasta according to package directions.",
      "Sauté vegetables until tender, about 5 minutes.",
      "Mix cream cheese and milk for sauce; toss everything together."
    ],
    funFact: "Eating a rainbow of colors gives your body different vitamins!",
    image: "/images/kids-meals/rainbow-veggie-pasta.jpg"
  },
  {
    id: "turkey-apple-roll-ups",
    slug: "turkey-apple-roll-ups",
    name: "Turkey & Apple Roll-Ups",
    description: "Fun tortilla spirals with turkey, cream cheese, and crisp apples.",
    baseServings: 2,
    healthBadges: ["High Protein", "No Cook"],
    ingredients: [
      { name: "flour tortillas", quantity: 2, unit: "each", notes: "large" },
      { name: "cream cheese", quantity: 4, unit: "tbsp", notes: "softened" },
      { name: "turkey", quantity: 3.5, unit: "oz", notes: "sliced" },
      { name: "apple", quantity: 1, unit: "each", notes: "small, thinly sliced" },
      { name: "lettuce leaves", quantity: 4, unit: "each" }
    ],
    instructions: [
      "Spread cream cheese on tortillas.",
      "Layer turkey, apple slices, and lettuce.",
      "Roll tightly and slice into pinwheels."
    ],
    funFact: "Apples help keep your teeth clean and strong!",
    image: "/images/kids-meals/turkey-apple-roll-ups.jpg"
  },
  {
    id: "cheesy-broccoli-bites",
    slug: "cheesy-broccoli-bites",
    name: "Cheesy Broccoli Bites",
    description: "Crispy baked bites that make broccoli fun to eat.",
    baseServings: 3,
    healthBadges: ["Vegetarian", "Hidden Veggies"],
    ingredients: [
      { name: "broccoli florets", quantity: 2, unit: "cup", notes: "steamed" },
      { name: "cheddar cheese", quantity: 1, unit: "cup", notes: "shredded" },
      { name: "breadcrumbs", quantity: 0.5, unit: "cup" },
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "garlic powder", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Chop steamed broccoli finely.",
      "Mix with cheese, breadcrumbs, eggs, and garlic powder.",
      "Form into small balls and bake at 375°F (190°C) for 20 minutes."
    ],
    funFact: "Broccoli looks like tiny trees and makes you grow strong!",
    image: "/images/kids-meals/cheesy-broccoli-bites.jpg"
  },
  {
    id: "banana-pancake-bites",
    slug: "banana-pancake-bites",
    name: "Banana Pancake Bites",
    description: "Mini pancakes with mashed banana baked right in.",
    baseServings: 2,
    healthBadges: ["Vegetarian", "Naturally Sweet"],
    ingredients: [
      { name: "bananas", quantity: 2, unit: "each", notes: "medium, ripe, mashed" },
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "flour", quantity: 0.5, unit: "cup" },
      { name: "baking powder", quantity: 1, unit: "tsp" },
      { name: "vanilla extract", quantity: 0.5, unit: "tsp" }
    ],
    instructions: [
      "Mix all ingredients until smooth.",
      "Pour into mini muffin tins.",
      "Bake at 350°F (175°C) for 12-15 minutes."
    ],
    funFact: "Bananas give you energy to run and play!",
    image: "/images/kids-meals/banana-pancake-bites.jpg"
  },
  {
    id: "chicken-veggie-meatballs",
    slug: "chicken-veggie-meatballs",
    name: "Chicken & Veggie Meatballs",
    description: "Tender meatballs with hidden vegetables and mild flavors.",
    baseServings: 4,
    healthBadges: ["High Protein", "Hidden Veggies"],
    ingredients: [
      { name: "chicken", quantity: 1, unit: "lb", notes: "ground" },
      { name: "carrots", quantity: 0.5, unit: "cup", notes: "finely grated" },
      { name: "zucchini", quantity: 0.5, unit: "cup", notes: "finely grated" },
      { name: "breadcrumbs", quantity: 0.5, unit: "cup" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" }
    ],
    instructions: [
      "Mix all ingredients gently.",
      "Form into small balls.",
      "Bake at 400°F (200°C) for 18-20 minutes."
    ],
    funFact: "These meatballs have vegetables hiding inside like a treasure!",
    image: "/images/kids-meals/chicken-veggie-meatballs.jpg"
  },
  {
    id: "sweet-potato-fries",
    slug: "sweet-potato-fries",
    name: "Crispy Sweet Potato Fries",
    description: "Naturally sweet fries that are baked, not fried.",
    baseServings: 3,
    healthBadges: ["Vegetarian", "Naturally Sweet"],
    ingredients: [
      { name: "sweet potatoes", quantity: 2, unit: "each", notes: "large" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
      { name: "paprika", quantity: 0.5, unit: "tsp" },
      { name: "salt", quantity: 0.25, unit: "tsp" }
    ],
    instructions: [
      "Cut sweet potatoes into fry shapes.",
      "Toss with oil and seasonings.",
      "Bake at 425°F (220°C) for 25-30 minutes, flipping once."
    ],
    funFact: "Sweet potatoes are orange because they're full of vitamin A for your eyes!",
    image: "/images/kids-meals/sweet-potato-fries.jpg"
  },
  {
    id: "mini-pizza-bagels",
    slug: "mini-pizza-bagels",
    name: "Mini Pizza Bagels",
    description: "Individual pizza bagels that kids can customize.",
    baseServings: 2,
    healthBadges: ["Vegetarian", "Customizable"],
    ingredients: [
      { name: "mini bagels", quantity: 4, unit: "each", notes: "halved" },
      { name: "pizza sauce", quantity: 0.5, unit: "cup" },
      { name: "mozzarella cheese", quantity: 1, unit: "cup", notes: "shredded" },
      { name: "mini pepperoni", quantity: 0.25, unit: "cup", notes: "optional" }
    ],
    instructions: [
      "Spread sauce on bagel halves.",
      "Sprinkle with cheese and toppings.",
      "Bake at 400°F (200°C) for 8-10 minutes."
    ],
    funFact: "Pizza was invented in Italy and means 'pie'!",
    image: "/images/kids-meals/mini-pizza-bagels.jpg"
  },
  {
    id: "fruit-yogurt-parfait",
    slug: "fruit-yogurt-parfait",
    name: "Fruit & Yogurt Parfait",
    description: "Layered goodness with yogurt, fruit, and granola.",
    baseServings: 2,
    healthBadges: ["Vegetarian", "No Cook", "Probiotic"],
    ingredients: [
      { name: "greek yogurt", quantity: 1, unit: "cup", notes: "vanilla" },
      { name: "mixed berries", quantity: 1, unit: "cup" },
      { name: "granola", quantity: 0.5, unit: "cup" },
      { name: "honey", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Layer yogurt, berries, and granola in cups.",
      "Repeat layers.",
      "Drizzle with honey on top."
    ],
    funFact: "Yogurt has good bacteria that help your tummy feel happy!",
    image: "/images/kids-meals/fruit-yogurt-parfait.jpg"
  },
  {
    id: "chicken-nugget-wraps",
    slug: "chicken-nugget-wraps",
    name: "Chicken Nugget Wraps",
    description: "Soft wraps filled with crispy chicken nuggets and veggies.",
    baseServings: 2,
    healthBadges: ["High Protein", "Kid Favorite"],
    ingredients: [
      { name: "flour tortillas", quantity: 2, unit: "each", notes: "large, soft" },
      { name: "chicken nuggets", quantity: 8, unit: "each", notes: "cooked" },
      { name: "lettuce", quantity: 1, unit: "cup", notes: "shredded" },
      { name: "ranch dressing", quantity: 2, unit: "tbsp", notes: "mild" }
    ],
    instructions: [
      "Warm tortillas slightly.",
      "Place nuggets, lettuce, and dressing in center.",
      "Roll up tightly and cut in half."
    ],
    funFact: "Wraps are like edible blankets for your food!",
    image: "/images/kids-meals/chicken-nugget-wraps.jpg"
  },
  {
    id: "veggie-mac-cheese",
    slug: "veggie-mac-cheese",
    name: "Hidden Veggie Mac & Cheese",
    description: "Classic mac and cheese with pureed vegetables mixed in.",
    baseServings: 4,
    healthBadges: ["Vegetarian", "Hidden Veggies"],
    ingredients: [
      { name: "macaroni pasta", quantity: 10, unit: "oz" },
      { name: "cheddar cheese", quantity: 2, unit: "cup", notes: "shredded" },
      { name: "milk", quantity: 1, unit: "cup" },
      { name: "butternut squash puree", quantity: 0.5, unit: "cup" },
      { name: "butter", quantity: 2, unit: "tbsp" }
    ],
    instructions: [
      "Cook pasta according to package directions.",
      "Make cheese sauce with milk, cheese, and butter.",
      "Stir in squash puree until smooth and creamy."
    ],
    funFact: "The orange vegetables make the cheese even more orange!",
    image: "/images/kids-meals/veggie-mac-cheese.jpg"
  },
  {
    id: "turkey-cheese-roll",
    slug: "turkey-cheese-roll",
    name: "Turkey & Cheese Roll",
    description: "Simple roll-ups that are perfect for little hands.",
    baseServings: 1,
    healthBadges: ["High Protein", "No Cook"],
    ingredients: [
      { name: "turkey", quantity: 3, unit: "slice", notes: "sliced" },
      { name: "cheese", quantity: 2, unit: "slice" },
      { name: "cucumber sticks", quantity: 4, unit: "each" }
    ],
    instructions: [
      "Lay turkey slices flat.",
      "Place cheese and cucumber on top.",
      "Roll up tightly and secure with toothpick if needed."
    ],
    funFact: "Rolling food makes it fun to eat and easy to hold!",
    image: "/images/kids-meals/turkey-cheese-roll.jpg"
  },
  {
    id: "mini-meatball-sliders",
    slug: "mini-meatball-sliders",
    name: "Mini Meatball Sliders",
    description: "Tiny burgers with meatballs instead of patties.",
    baseServings: 3,
    healthBadges: ["High Protein", "Kid Favorite"],
    ingredients: [
      { name: "mini burger buns", quantity: 6, unit: "each" },
      { name: "meatballs", quantity: 6, unit: "each", notes: "small, cooked" },
      { name: "marinara sauce", quantity: 0.25, unit: "cup" },
      { name: "mozzarella cheese", quantity: 6, unit: "slice" }
    ],
    instructions: [
      "Warm meatballs in sauce.",
      "Place meatball on bun bottom.",
      "Top with cheese and bun top."
    ],
    funFact: "Sliders got their name because they slide down easy!",
    image: "/images/kids-meals/mini-meatball-sliders.jpg"
  },
  {
    id: "apple-cinnamon-oatmeal",
    slug: "apple-cinnamon-oatmeal",
    name: "Apple Cinnamon Oatmeal",
    description: "Warm, comforting oatmeal with sweet apple pieces.",
    baseServings: 2,
    healthBadges: ["Vegetarian", "Fiber Rich"],
    ingredients: [
      { name: "rolled oats", quantity: 1, unit: "cup" },
      { name: "milk", quantity: 2, unit: "cup" },
      { name: "apple", quantity: 1, unit: "each", notes: "medium, diced" },
      { name: "cinnamon", quantity: 0.5, unit: "tsp" },
      { name: "honey", quantity: 1, unit: "tbsp" }
    ],
    instructions: [
      "Cook oats with milk for 5 minutes.",
      "Stir in diced apple and cinnamon.",
      "Sweeten with honey and serve warm."
    ],
    funFact: "Oats give you energy that lasts all morning long!",
    image: "/images/kids-meals/apple-cinnamon-oatmeal.jpg"
  },
  {
    id: "chicken-rice-balls",
    slug: "chicken-rice-balls",
    name: "Chicken Rice Balls",
    description: "Fun finger food with chicken and rice shaped into balls.",
    baseServings: 3,
    healthBadges: ["High Protein", "Gluten-Free"],
    ingredients: [
      { name: "rice", quantity: 2, unit: "cup", notes: "cooked" },
      { name: "chicken", quantity: 1, unit: "cup", notes: "cooked, finely shredded" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" },
      { name: "cheese", quantity: 0.5, unit: "cup", notes: "grated" }
    ],
    instructions: [
      "Mix rice, chicken, egg, and cheese.",
      "Form into small balls with damp hands.",
      "Bake at 375°F (190°C) for 15 minutes."
    ],
    funFact: "Rice is eaten by more people around the world than any other food!",
    image: "/images/kids-meals/chicken-rice-balls.jpg"
  },
  {
    id: "strawberry-banana-smoothie-bowl",
    slug: "strawberry-banana-smoothie-bowl",
    name: "Strawberry Banana Smoothie Bowl",
    description: "Thick smoothie you can eat with a spoon and fun toppings.",
    baseServings: 2,
    healthBadges: ["Vegetarian", "Naturally Sweet", "No Cook"],
    ingredients: [
      { name: "strawberries", quantity: 1, unit: "cup", notes: "frozen" },
      { name: "banana", quantity: 1, unit: "each", notes: "medium, frozen" },
      { name: "greek yogurt", quantity: 0.5, unit: "cup" },
      { name: "granola", quantity: 0.25, unit: "cup", notes: "for topping" },
      { name: "fresh berries", quantity: 0.5, unit: "cup", notes: "for topping" }
    ],
    instructions: [
      "Blend frozen fruit with yogurt until thick.",
      "Pour into bowls.",
      "Top with granola and fresh berries."
    ],
    funFact: "Smoothie bowls are like ice cream but made from fruit!",
    image: "/images/kids-meals/strawberry-banana-smoothie-bowl.jpg"
  },
  {
    id: "cheese-crackers-grapes",
    slug: "cheese-crackers-grapes",
    name: "Cheese, Crackers & Grapes",
    description: "Perfect snack plate with protein, carbs, and fruit.",
    baseServings: 1,
    healthBadges: ["Vegetarian", "No Cook", "Balanced"],
    ingredients: [
      { name: "crackers", quantity: 8, unit: "each", notes: "whole grain" },
      { name: "cheddar cheese", quantity: 0.25, unit: "cup", notes: "mild, cubed" },
      { name: "red grapes", quantity: 0.5, unit: "cup" }
    ],
    instructions: [
      "Arrange crackers on plate.",
      "Add cheese cubes and grapes.",
      "Let kids build their own bites."
    ],
    funFact: "This snack has all three food groups on one plate!",
    image: "/images/kids-meals/cheese-crackers-grapes.jpg"
  },
  {
    id: "mini-corn-muffins",
    slug: "mini-corn-muffins",
    name: "Mini Corn Muffins",
    description: "Sweet, bite-sized muffins perfect for little hands.",
    baseServings: 4,
    healthBadges: ["Vegetarian", "Kid-Sized"],
    ingredients: [
      { name: "cornmeal", quantity: 1, unit: "cup" },
      { name: "flour", quantity: 1, unit: "cup" },
      { name: "sugar", quantity: 0.25, unit: "cup" },
      { name: "baking powder", quantity: 1, unit: "tbsp" },
      { name: "milk", quantity: 1, unit: "cup" },
      { name: "egg", quantity: 1, unit: "each", notes: "large" },
      { name: "butter", quantity: 0.25, unit: "cup", notes: "melted" }
    ],
    instructions: [
      "Mix dry ingredients in one bowl.",
      "Mix wet ingredients in another bowl.",
      "Combine and bake in mini muffin tins at 400°F (200°C) for 12-15 minutes."
    ],
    funFact: "Corn was first grown by Native Americans thousands of years ago!",
    image: "/images/kids-meals/mini-corn-muffins.jpg"
  },
  {
    id: "peanut-butter-banana-toast",
    slug: "peanut-butter-banana-toast",
    name: "Peanut Butter Banana Toast",
    description: "Classic combination that kids love for breakfast or snack.",
    baseServings: 1,
    healthBadges: ["High Protein", "Naturally Sweet"],
    ingredients: [
      { name: "bread", quantity: 2, unit: "slice", notes: "whole grain" },
      { name: "peanut butter", quantity: 2, unit: "tbsp", notes: "natural" },
      { name: "banana", quantity: 1, unit: "each", notes: "medium, sliced" },
      { name: "honey", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Toast bread until golden.",
      "Spread peanut butter on toast.",
      "Arrange banana slices and drizzle with honey."
    ],
    funFact: "Peanuts aren't actually nuts - they grow underground like potatoes!",
    image: "/images/kids-meals/peanut-butter-banana-toast.jpg"
  },
  {
    id: "veggie-fried-rice",
    slug: "veggie-fried-rice",
    name: "Kid-Friendly Veggie Fried Rice",
    description: "Mild fried rice with colorful vegetables and scrambled egg.",
    baseServings: 3,
    healthBadges: ["Vegetarian", "Hidden Veggies"],
    ingredients: [
      { name: "rice", quantity: 3, unit: "cup", notes: "cooked, cooled" },
      { name: "eggs", quantity: 2, unit: "each", notes: "large" },
      { name: "peas and carrots", quantity: 1, unit: "cup", notes: "frozen" },
      { name: "green onions", quantity: 2, unit: "stalk", notes: "chopped" },
      { name: "soy sauce", quantity: 2, unit: "tbsp", notes: "low sodium" },
      { name: "sesame oil", quantity: 1, unit: "tsp" }
    ],
    instructions: [
      "Scramble eggs and set aside.",
      "Stir-fry vegetables until tender.",
      "Add rice, eggs, and seasonings; stir until heated through."
    ],
    funFact: "Fried rice was invented as a way to use leftover rice!",
    image: "/images/kids-meals/veggie-fried-rice.jpg"
  }
];