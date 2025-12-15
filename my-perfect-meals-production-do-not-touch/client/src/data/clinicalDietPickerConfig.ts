
export type ClinicalDietKey =
  | "low_fodmap"
  | "aip"
  | "cardiac"
  | "renal"
  | "bariatric"
  | "anti_inflammatory"
  | "liver_friendly";

interface ClinicalDietIngredients {
  proteins: string[];
  starchyCarbs: string[];
  fibrousCarbs: string[];
  fats: string[];
  fruit: string[];
  snacks: {
    sweetTreats: string[];
    savoryCrunchy: string[];
    lightGentle: string[];
    proteinEnergy: string[];
    drinkables: string[];
    dessertBites: string[];
  };
}

export const clinicalDietPickerConfig: Record<ClinicalDietKey, ClinicalDietIngredients> = {
  low_fodmap: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "Lean Beef",
      "Pork Tenderloin",
      "Salmon",
      "Tuna",
      "Cod",
      "Shrimp",
      "Eggs",
      "Firm Tofu",
      "Tempeh"
    ],
    starchyCarbs: [
      "White Rice",
      "Brown Rice",
      "Quinoa",
      "Oats",
      "Gluten-free Pasta",
      "Potatoes",
      "Sweet Potato (small portions)",
      "Sourdough Bread (spelt)",
      "Rice Cakes"
    ],
    fibrousCarbs: [
      "Spinach",
      "Lettuce",
      "Kale",
      "Zucchini",
      "Bell Peppers",
      "Carrots",
      "Green Beans",
      "Cucumber",
      "Tomatoes",
      "Bok Choy",
      "Eggplant"
    ],
    fats: [
      "Olive Oil",
      "Coconut Oil",
      "Avocado Oil",
      "Macadamia Nuts",
      "Walnuts",
      "Pumpkin Seeds",
      "Chia Seeds"
    ],
    fruit: [
      "Blueberries",
      "Strawberries",
      "Oranges",
      "Grapes",
      "Kiwi",
      "Pineapple",
      "Cantaloupe",
      "Banana (unripe)"
    ],
    snacks: {
      sweetTreats: [
        "Lactose-free yogurt with blueberries",
        "Rice cakes with peanut butter",
        "Banana (unripe) with almond butter",
        "Strawberry smoothie with lactose-free milk",
        "Maple oat bites"
      ],
      savoryCrunchy: [
        "Hard-boiled eggs",
        "Turkey roll-ups",
        "Rice crackers with lactose-free cheese",
        "Carrot sticks with olive oil dip",
        "Roasted pumpkin seeds"
      ],
      lightGentle: [
        "Lactose-free cottage cheese",
        "Plain rice cakes",
        "Cucumber slices",
        "Melon cup",
        "Boiled potatoes (cooled)"
      ],
      proteinEnergy: [
        "Grilled chicken strips",
        "Tuna on rice crackers",
        "Hard-boiled eggs",
        "Lactose-free protein shake",
        "Turkey breast slices"
      ],
      drinkables: [
        "Lactose-free protein shake",
        "Green smoothie with spinach and banana",
        "Strawberry smoothie",
        "Peppermint tea",
        "Low-FODMAP protein drink"
      ],
      dessertBites: [
        "Lactose-free frozen yogurt",
        "Maple walnut energy balls",
        "Rice pudding (lactose-free)",
        "Strawberry sorbet",
        "Oat cookie (low-FODMAP)"
      ]
    }
  },
  aip: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "Grass-fed Beef",
      "Bison",
      "Wild Salmon",
      "Sardines",
      "Cod",
      "Shrimp",
      "Organ Meats (liver)"
    ],
    starchyCarbs: [
      "Sweet Potato",
      "White Potato",
      "Butternut Squash",
      "Acorn Squash",
      "Plantains",
      "Cassava",
      "Taro Root",
      "Parsnips"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Brussels Sprouts",
      "Asparagus",
      "Zucchini",
      "Cucumber",
      "Carrots",
      "Beets",
      "Mushrooms",
      "Celery"
    ],
    fats: [
      "Avocado",
      "Olive Oil",
      "Coconut Oil",
      "Avocado Oil",
      "Coconut Butter"
    ],
    fruit: [
      "Berries",
      "Apples",
      "Pears",
      "Bananas",
      "Mango",
      "Pineapple",
      "Melon",
      "Peaches"
    ],
    snacks: {
      sweetTreats: [
        "Apple slices with coconut butter",
        "Banana with coconut flakes",
        "Berries with coconut cream",
        "Date energy balls (no nuts)",
        "Baked sweet potato bites"
      ],
      savoryCrunchy: [
        "Plantain chips",
        "Veggie sticks with guacamole",
        "Coconut chips",
        "Baked zucchini chips",
        "Carrot sticks"
      ],
      lightGentle: [
        "Applesauce (unsweetened)",
        "Mashed sweet potato",
        "Cucumber rounds",
        "Melon slices",
        "Bone broth"
      ],
      proteinEnergy: [
        "Grilled chicken strips",
        "Turkey breast slices",
        "Salmon jerky",
        "Beef stick (AIP-compliant)",
        "Chicken bone broth"
      ],
      drinkables: [
        "Green smoothie with coconut milk",
        "Berry smoothie",
        "Bone broth",
        "Coconut water",
        "Herbal tea"
      ],
      dessertBites: [
        "Coconut date balls",
        "Frozen banana bites",
        "Coconut cream cups",
        "Fruit sorbet (no sugar)",
        "AIP brownie bite"
      ]
    }
  },
  cardiac: {
    proteins: [
      "Skinless Chicken Breast",
      "Turkey Breast",
      "Salmon",
      "Tuna",
      "Cod",
      "Tilapia",
      "Shrimp",
      "Egg Whites",
      "Tofu",
      "Lentils",
      "Chickpeas",
      "Black Beans"
    ],
    starchyCarbs: [
      "Oats",
      "Quinoa",
      "Brown Rice",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Sweet Potato",
      "Barley",
      "Bulgur",
      "Farro"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Brussels Sprouts",
      "Asparagus",
      "Green Beans",
      "Zucchini",
      "Bell Peppers",
      "Tomatoes",
      "Carrots",
      "Celery",
      "Cucumber"
    ],
    fats: [
      "Olive Oil",
      "Avocado",
      "Avocado Oil",
      "Almonds (unsalted)",
      "Walnuts (unsalted)",
      "Flax Seeds",
      "Chia Seeds"
    ],
    fruit: [
      "Berries",
      "Apples",
      "Oranges",
      "Bananas",
      "Grapes",
      "Pears",
      "Peaches",
      "Kiwi"
    ],
    snacks: {
      sweetTreats: [
        "Plain Greek yogurt (low-fat) with berries",
        "Apple slices with almond butter (unsalted)",
        "Oatmeal with cinnamon and banana",
        "Fruit smoothie bowl",
        "Chia pudding with berries"
      ],
      savoryCrunchy: [
        "Unsalted almonds",
        "Edamame (no salt)",
        "Hummus with veggie sticks",
        "Air-popped popcorn (no salt)",
        "Rice cakes (unsalted)"
      ],
      lightGentle: [
        "Plain yogurt (low-fat)",
        "Applesauce (no sugar)",
        "Fruit cup",
        "Cucumber slices",
        "Melon slices"
      ],
      proteinEnergy: [
        "Grilled chicken strips (no salt)",
        "Tuna on whole grain crackers (low sodium)",
        "Egg whites",
        "Low-fat Greek yogurt",
        "Protein shake (low sodium)"
      ],
      drinkables: [
        "Green smoothie",
        "Berry smoothie (no sugar)",
        "Low-fat protein shake",
        "Herbal tea",
        "Fruit-infused water"
      ],
      dessertBites: [
        "Frozen banana bites",
        "Fruit sorbet (no sugar)",
        "Oat energy ball (no salt)",
        "Baked apple chips",
        "Berry frozen yogurt (low-fat)"
      ]
    }
  },
  renal: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "Egg Whites",
      "Fish (portions controlled)",
      "Lean Beef (small portions)"
    ],
    starchyCarbs: [
      "White Rice",
      "White Bread",
      "White Pasta",
      "Rice Noodles",
      "Couscous"
    ],
    fibrousCarbs: [
      "Green Beans (leached)",
      "Cabbage",
      "Cauliflower (leached)",
      "Cucumber",
      "Lettuce",
      "Bell Peppers",
      "Onions",
      "Zucchini (leached)"
    ],
    fats: [
      "Olive Oil",
      "Canola Oil",
      "Unsalted Butter (small portions)"
    ],
    fruit: [
      "Apples",
      "Grapes",
      "Pineapple",
      "Strawberries",
      "Blueberries",
      "Cranberries"
    ],
    snacks: {
      sweetTreats: [
        "Apple slices with honey",
        "White rice pudding",
        "Grapes",
        "Pineapple chunks",
        "Cranberry sauce (low sugar)"
      ],
      savoryCrunchy: [
        "Unsalted crackers",
        "Rice cakes (unsalted)",
        "Cucumber sticks",
        "Bell pepper strips",
        "Popcorn (unsalted, air-popped)"
      ],
      lightGentle: [
        "Applesauce (no sugar)",
        "White rice cake",
        "Cucumber rounds",
        "Fruit cup (approved fruits)",
        "Gelatin cup (sugar-free)"
      ],
      proteinEnergy: [
        "Egg white bites",
        "Chicken breast strips (no salt)",
        "Small portion tuna (low sodium)",
        "Turkey breast slices",
        "Protein shake (renal-specific)"
      ],
      drinkables: [
        "Apple juice (small portions)",
        "Cranberry juice (small portions)",
        "Herbal tea",
        "Lemonade (controlled)",
        "Renal-specific protein drink"
      ],
      dessertBites: [
        "Apple pie bite (low potassium)",
        "White cake mini",
        "Sugar cookie (small)",
        "Cranberry bars",
        "Vanilla wafer"
      ]
    }
  },
  bariatric: {
    proteins: [
      "Greek Yogurt (low-fat)",
      "Cottage Cheese (low-fat)",
      "Egg Whites",
      "Scrambled Eggs (soft)",
      "Pureed Chicken",
      "Pureed Fish",
      "Protein Powder",
      "Soft Tofu",
      "Ricotta Cheese"
    ],
    starchyCarbs: [
      "Oatmeal (well-cooked)",
      "Cream of Wheat",
      "Mashed Potatoes",
      "Soft White Rice",
      "Pureed Sweet Potato"
    ],
    fibrousCarbs: [
      "Pureed Spinach",
      "Pureed Carrots",
      "Pureed Green Beans",
      "Pureed Squash",
      "Well-cooked Zucchini"
    ],
    fats: [
      "Avocado (pureed)",
      "Olive Oil (small amounts)",
      "Nut Butter (smooth, thin)"
    ],
    fruit: [
      "Applesauce (unsweetened)",
      "Pureed Banana",
      "Pureed Peaches",
      "Pureed Pears",
      "Strained Berries"
    ],
    snacks: {
      sweetTreats: [
        "Protein pudding",
        "Sugar-free yogurt",
        "Applesauce cup",
        "Protein shake (vanilla)",
        "Pureed fruit cup"
      ],
      savoryCrunchy: [
        "Soft cheese cubes",
        "Cottage cheese",
        "Ricotta cheese",
        "Soft scrambled eggs",
        "Smooth hummus (thin)"
      ],
      lightGentle: [
        "Greek yogurt (plain)",
        "Cottage cheese",
        "Protein shake",
        "Sugar-free gelatin",
        "Bone broth"
      ],
      proteinEnergy: [
        "Protein shake",
        "Greek yogurt (high protein)",
        "Soft egg bites",
        "Protein pudding",
        "Cottage cheese with protein powder"
      ],
      drinkables: [
        "Protein shake",
        "Bone broth",
        "Clear protein drink",
        "Sugar-free smoothie (thin)",
        "Protein water"
      ],
      dessertBites: [
        "Protein pudding cup",
        "Sugar-free yogurt",
        "Protein ice cream (soft)",
        "Pureed fruit bar",
        "Protein mousse"
      ]
    }
  },
  anti_inflammatory: {
    proteins: [
      "Wild Salmon",
      "Sardines",
      "Mackerel",
      "Chicken Breast",
      "Turkey Breast",
      "Eggs",
      "Tofu",
      "Tempeh",
      "Lentils",
      "Chickpeas"
    ],
    starchyCarbs: [
      "Quinoa",
      "Brown Rice",
      "Oats",
      "Sweet Potato",
      "Butternut Squash",
      "Wild Rice"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Brussels Sprouts",
      "Asparagus",
      "Beets",
      "Carrots",
      "Bell Peppers",
      "Ginger",
      "Turmeric"
    ],
    fats: [
      "Olive Oil",
      "Avocado",
      "Avocado Oil",
      "Walnuts",
      "Chia Seeds",
      "Flax Seeds",
      "Hemp Seeds"
    ],
    fruit: [
      "Blueberries",
      "Strawberries",
      "Raspberries",
      "Cherries",
      "Pineapple",
      "Oranges",
      "Papaya"
    ],
    snacks: {
      sweetTreats: [
        "Berry smoothie bowl",
        "Chia pudding with berries",
        "Golden milk latte",
        "Date energy balls with turmeric",
        "Cherry parfait"
      ],
      savoryCrunchy: [
        "Walnuts",
        "Roasted chickpeas with turmeric",
        "Edamame",
        "Veggie sticks with tahini",
        "Kale chips"
      ],
      lightGentle: [
        "Applesauce with cinnamon",
        "Cucumber with ginger",
        "Melon slices",
        "Papaya chunks",
        "Steamed veggies"
      ],
      proteinEnergy: [
        "Salmon jerky",
        "Hard-boiled eggs",
        "Tempeh strips",
        "Anti-inflammatory protein shake",
        "Greek yogurt with turmeric"
      ],
      drinkables: [
        "Golden milk smoothie",
        "Green smoothie with ginger",
        "Turmeric latte",
        "Berry antioxidant shake",
        "Matcha green tea"
      ],
      dessertBites: [
        "Dark chocolate squares (70%+)",
        "Turmeric energy balls",
        "Berry sorbet",
        "Walnut date bites",
        "Ginger cacao truffles"
      ]
    }
  },
  liver_friendly: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "White Fish (cod, tilapia)",
      "Egg Whites",
      "Tofu",
      "Lentils",
      "Chickpeas"
    ],
    starchyCarbs: [
      "Oats",
      "Quinoa",
      "Brown Rice",
      "Sweet Potato",
      "Whole Wheat Bread",
      "Whole Wheat Pasta"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Brussels Sprouts",
      "Asparagus",
      "Beets",
      "Carrots",
      "Artichokes",
      "Green Beans"
    ],
    fats: [
      "Olive Oil",
      "Avocado (small portions)",
      "Walnuts (small portions)",
      "Flax Seeds",
      "Chia Seeds"
    ],
    fruit: [
      "Apples",
      "Pears",
      "Berries",
      "Grapefruit",
      "Grapes",
      "Papaya"
    ],
    snacks: {
      sweetTreats: [
        "Apple slices with cinnamon",
        "Oatmeal with berries",
        "Baked pear",
        "Fruit smoothie (low-fat)",
        "Berry parfait (low-fat yogurt)"
      ],
      savoryCrunchy: [
        "Air-popped popcorn (unsalted)",
        "Carrot sticks",
        "Celery sticks",
        "Baked veggie chips",
        "Rice cakes (unsalted)"
      ],
      lightGentle: [
        "Applesauce (unsweetened)",
        "Steamed veggies",
        "Fruit cup",
        "Plain yogurt (low-fat)",
        "Veggie broth"
      ],
      proteinEnergy: [
        "Grilled chicken strips (no salt)",
        "Egg white bites",
        "Tofu cubes",
        "Lentil salad",
        "Low-fat protein shake"
      ],
      drinkables: [
        "Green smoothie",
        "Beet juice (small portion)",
        "Herbal tea (dandelion or milk thistle)",
        "Low-fat fruit smoothie",
        "Vegetable juice (low sodium)"
      ],
      dessertBites: [
        "Baked apple chips",
        "Frozen fruit pops",
        "Oat energy ball (low-fat)",
        "Berry sorbet (no sugar)",
        "Date energy ball (no nuts)"
      ]
    }
  }
};
