
export type LifestyleDietKey =
  | "mediterranean"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "paleo"
  | "keto"
  | "flexitarian";

interface DietIngredients {
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

export const lifestyleDietPickerConfig: Record<LifestyleDietKey, DietIngredients> = {
  mediterranean: {
    proteins: [
      "Salmon",
      "Tuna",
      "Cod",
      "Shrimp",
      "Sardines",
      "Chicken Breast",
      "Turkey Breast",
      "Eggs",
      "Greek Yogurt",
      "Chickpeas",
      "Lentils",
      "White Beans",
      "Feta Cheese",
      "Halloumi"
    ],
    starchyCarbs: [
      "Quinoa",
      "Bulgur",
      "Farro",
      "Brown Rice",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Sweet Potato",
      "Chickpeas",
      "Lentils",
      "Pita Bread",
      "Couscous"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Arugula",
      "Tomatoes",
      "Cucumbers",
      "Bell Peppers",
      "Zucchini",
      "Eggplant",
      "Artichokes",
      "Olives",
      "Broccoli",
      "Cauliflower",
      "Asparagus",
      "Green Beans"
    ],
    fats: [
      "Olive Oil",
      "Avocado",
      "Almonds",
      "Walnuts",
      "Pine Nuts",
      "Tahini",
      "Olives",
      "Feta Cheese"
    ],
    fruit: [
      "Oranges",
      "Lemons",
      "Grapes",
      "Figs",
      "Dates",
      "Pomegranate",
      "Apples",
      "Pears",
      "Berries"
    ],
    snacks: {
      sweetTreats: [
        "Greek yogurt with honey and figs",
        "Date energy balls",
        "Fresh fruit with yogurt",
        "Almond fig bites",
        "Pomegranate parfait"
      ],
      savoryCrunchy: [
        "Hummus with veggie sticks",
        "Olives and cheese",
        "Roasted chickpeas",
        "Whole grain crackers with tzatziki",
        "Cucumber bites with feta"
      ],
      lightGentle: [
        "Tzatziki with pita",
        "Cottage cheese with tomatoes",
        "Melon slices",
        "Cucumber rounds with hummus",
        "Greek yogurt cup"
      ],
      proteinEnergy: [
        "Grilled chicken skewers",
        "Tuna on whole grain crackers",
        "Hard-boiled eggs",
        "Greek yogurt with nuts",
        "Edamame"
      ],
      drinkables: [
        "Green smoothie with spinach and banana",
        "Greek yogurt smoothie",
        "Fruit-infused water",
        "Herbal tea",
        "Lemon water"
      ],
      dessertBites: [
        "Frozen yogurt with berries",
        "Date and nut truffles",
        "Almond biscotti",
        "Fresh fruit sorbet",
        "Honey walnut bites"
      ]
    }
  },
  vegan: {
    proteins: [
      "Tofu",
      "Tempeh",
      "Seitan",
      "Lentils",
      "Chickpeas",
      "Black Beans",
      "Kidney Beans",
      "Edamame",
      "Peanut Butter",
      "Almond Butter",
      "Hemp Seeds",
      "Pea Protein",
      "Nutritional Yeast"
    ],
    starchyCarbs: [
      "Quinoa",
      "Brown Rice",
      "Oats",
      "Sweet Potato",
      "Regular Potato",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Barley",
      "Bulgur",
      "Corn",
      "Butternut Squash"
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
      "Mushrooms",
      "Carrots",
      "Celery",
      "Cucumber"
    ],
    fats: [
      "Avocado",
      "Olive Oil",
      "Coconut Oil",
      "Almonds",
      "Walnuts",
      "Cashews",
      "Chia Seeds",
      "Flax Seeds",
      "Pumpkin Seeds",
      "Tahini",
      "Almond Butter",
      "Peanut Butter"
    ],
    fruit: [
      "Bananas",
      "Apples",
      "Berries",
      "Oranges",
      "Mangoes",
      "Pineapple",
      "Kiwi",
      "Grapes",
      "Watermelon"
    ],
    snacks: {
      sweetTreats: [
        "Date energy balls",
        "Banana nice cream",
        "Chia pudding with coconut milk",
        "Apple slices with almond butter",
        "Fruit smoothie bowl"
      ],
      savoryCrunchy: [
        "Roasted chickpeas",
        "Hummus with carrots",
        "Trail mix with nuts and seeds",
        "Edamame",
        "Kale chips"
      ],
      lightGentle: [
        "Applesauce cup",
        "Fruit puree pouch",
        "Rice cakes with avocado",
        "Cucumber rounds with hummus",
        "Melon cup"
      ],
      proteinEnergy: [
        "Protein shake with pea protein",
        "Energy bites with oats and dates",
        "Tempeh strips",
        "Edamame bowl",
        "Vegan protein bar"
      ],
      drinkables: [
        "Green smoothie",
        "Protein shake with almond milk",
        "Coconut water",
        "Fruit smoothie",
        "Matcha latte with oat milk"
      ],
      dessertBites: [
        "Vegan brownie bite",
        "Frozen banana pops",
        "Coconut date balls",
        "Oatmeal cookie",
        "Dark chocolate squares"
      ]
    }
  },
  vegetarian: {
    proteins: [
      "Eggs",
      "Greek Yogurt",
      "Cottage Cheese",
      "Cheese",
      "Tofu",
      "Tempeh",
      "Lentils",
      "Chickpeas",
      "Black Beans",
      "Quinoa",
      "Edamame",
      "Milk",
      "Paneer"
    ],
    starchyCarbs: [
      "Quinoa",
      "Brown Rice",
      "Oats",
      "Sweet Potato",
      "Regular Potato",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Barley",
      "Bulgur",
      "Corn",
      "Couscous"
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
      "Mushrooms",
      "Carrots",
      "Celery",
      "Cucumber"
    ],
    fats: [
      "Avocado",
      "Olive Oil",
      "Butter",
      "Cheese",
      "Almonds",
      "Walnuts",
      "Cashews",
      "Chia Seeds",
      "Flax Seeds",
      "Pumpkin Seeds",
      "Tahini"
    ],
    fruit: [
      "Bananas",
      "Apples",
      "Berries",
      "Oranges",
      "Grapes",
      "Pears",
      "Peaches",
      "Plums",
      "Watermelon"
    ],
    snacks: {
      sweetTreats: [
        "Greek yogurt with berries",
        "Cottage cheese and peaches",
        "Fruit parfait",
        "Apple slices with peanut butter",
        "Yogurt bark with fruit"
      ],
      savoryCrunchy: [
        "String cheese",
        "Hard-boiled eggs",
        "Hummus and carrots",
        "Roasted chickpeas",
        "Cheese and crackers"
      ],
      lightGentle: [
        "Plain yogurt cup",
        "Cottage cheese cup",
        "Applesauce",
        "Fruit cup",
        "Mini quiche bite"
      ],
      proteinEnergy: [
        "Greek yogurt with granola",
        "Protein shake",
        "Egg bites",
        "Cottage cheese and pineapple",
        "Protein bar"
      ],
      drinkables: [
        "Fruit smoothie",
        "Protein shake",
        "Chocolate milk",
        "Kefir drink",
        "Green smoothie"
      ],
      dessertBites: [
        "Frozen yogurt bar",
        "Mini cookie",
        "Yogurt bark square",
        "Protein cheesecake square",
        "Oat bar mini"
      ]
    }
  },
  pescatarian: {
    proteins: [
      "Salmon",
      "Tuna",
      "Cod",
      "Tilapia",
      "Shrimp",
      "Scallops",
      "Sardines",
      "Eggs",
      "Greek Yogurt",
      "Cottage Cheese",
      "Tofu",
      "Lentils",
      "Chickpeas"
    ],
    starchyCarbs: [
      "Quinoa",
      "Brown Rice",
      "Oats",
      "Sweet Potato",
      "Regular Potato",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Barley",
      "Farro",
      "Couscous"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Asparagus",
      "Green Beans",
      "Zucchini",
      "Bell Peppers",
      "Tomatoes",
      "Cucumber",
      "Carrots",
      "Mushrooms",
      "Celery"
    ],
    fats: [
      "Olive Oil",
      "Avocado Oil",
      "Avocado",
      "Almonds",
      "Walnuts",
      "Chia Seeds",
      "Flax Seeds",
      "Tahini",
      "Butter",
      "Cheese"
    ],
    fruit: [
      "Berries",
      "Apples",
      "Oranges",
      "Bananas",
      "Grapes",
      "Pears",
      "Kiwi",
      "Mango",
      "Pineapple"
    ],
    snacks: {
      sweetTreats: [
        "Greek yogurt with berries",
        "Cottage cheese with fruit",
        "Fruit parfait",
        "Apple with almond butter",
        "Chia pudding"
      ],
      savoryCrunchy: [
        "Tuna packet with crackers",
        "Smoked salmon cucumber bites",
        "Hard-boiled eggs",
        "Hummus and veggie sticks",
        "Edamame"
      ],
      lightGentle: [
        "Plain yogurt cup",
        "Cottage cheese",
        "Fruit cup",
        "Cucumber with tzatziki",
        "Rice cakes"
      ],
      proteinEnergy: [
        "Smoked salmon roll",
        "Tuna salad cup",
        "Greek yogurt with granola",
        "Protein shake",
        "Egg bites"
      ],
      drinkables: [
        "Fruit smoothie",
        "Protein shake",
        "Green smoothie",
        "Kefir drink",
        "Berry smoothie"
      ],
      dessertBites: [
        "Frozen yogurt bar",
        "Protein ice cream cup",
        "Yogurt bark",
        "Mini protein cookie",
        "Fruit sorbet"
      ]
    }
  },
  paleo: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "Lean Beef",
      "Ground Beef",
      "Pork Tenderloin",
      "Salmon",
      "Tuna",
      "Shrimp",
      "Eggs",
      "Bison"
    ],
    starchyCarbs: [
      "Sweet Potato",
      "Regular Potato",
      "Butternut Squash",
      "Acorn Squash",
      "Plantains",
      "Cassava",
      "Parsnips"
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
      "Mushrooms",
      "Carrots",
      "Celery",
      "Cucumber"
    ],
    fats: [
      "Avocado",
      "Avocado Oil",
      "Coconut Oil",
      "Olive Oil",
      "Almonds",
      "Walnuts",
      "Pecans",
      "Macadamia Nuts",
      "Ghee"
    ],
    fruit: [
      "Berries",
      "Apples",
      "Bananas",
      "Oranges",
      "Grapes",
      "Mango",
      "Pineapple",
      "Melon",
      "Peaches"
    ],
    snacks: {
      sweetTreats: [
        "Apple slices with almond butter",
        "Date energy balls",
        "Banana coins with coconut",
        "Frozen fruit bites",
        "Berries with coconut cream"
      ],
      savoryCrunchy: [
        "Hard-boiled eggs",
        "Beef jerky",
        "Roasted nuts",
        "Turkey roll-ups",
        "Veggie sticks with guacamole"
      ],
      lightGentle: [
        "Applesauce (unsweetened)",
        "Fruit cup",
        "Cucumber rounds",
        "Melon slices",
        "Carrot sticks"
      ],
      proteinEnergy: [
        "Chicken breast bites",
        "Turkey jerky",
        "Hard-boiled eggs",
        "Tuna salad",
        "Beef stick"
      ],
      drinkables: [
        "Fruit smoothie with coconut milk",
        "Green smoothie",
        "Coconut water",
        "Almond milk smoothie",
        "Berry shake"
      ],
      dessertBites: [
        "Coconut date balls",
        "Almond butter cups",
        "Frozen banana bites",
        "Paleo brownie bite",
        "Fruit leather"
      ]
    }
  },
  keto: {
    proteins: [
      "Chicken Thighs",
      "Chicken Breast",
      "Ground Beef (80/20)",
      "Ribeye Steak",
      "Pork Chops",
      "Bacon",
      "Salmon",
      "Tuna",
      "Shrimp",
      "Eggs",
      "Turkey",
      "Cheese"
    ],
    starchyCarbs: [
      "Cauliflower Rice",
      "Zucchini Noodles",
      "Shirataki Noodles",
      "Spaghetti Squash"
    ],
    fibrousCarbs: [
      "Spinach",
      "Kale",
      "Broccoli",
      "Cauliflower",
      "Asparagus",
      "Zucchini",
      "Brussels Sprouts",
      "Green Beans",
      "Lettuce",
      "Arugula",
      "Celery",
      "Cucumber",
      "Mushrooms",
      "Bell Peppers"
    ],
    fats: [
      "Avocado",
      "Olive Oil",
      "Coconut Oil",
      "Butter",
      "Ghee",
      "Heavy Cream",
      "Cheese",
      "Cream Cheese",
      "Almonds",
      "Macadamia Nuts",
      "Pecans",
      "MCT Oil"
    ],
    fruit: [
      "Avocado",
      "Berries (small portions)",
      "Tomatoes",
      "Olives"
    ],
    snacks: {
      sweetTreats: [
        "Keto fat bombs",
        "Berries with whipped cream",
        "Cream cheese pancakes",
        "Keto chocolate mousse",
        "Almond butter fat bombs"
      ],
      savoryCrunchy: [
        "Cheese crisps",
        "Pork rinds",
        "Hard-boiled eggs",
        "Bacon strips",
        "Pepperoni slices"
      ],
      lightGentle: [
        "Cucumber with cream cheese",
        "Celery with almond butter",
        "Cheese cubes",
        "Olives",
        "Deviled eggs"
      ],
      proteinEnergy: [
        "Keto protein shake",
        "Chicken breast bites",
        "Tuna salad",
        "Beef jerky",
        "Egg bites"
      ],
      drinkables: [
        "Keto protein shake",
        "Bulletproof coffee",
        "Green smoothie with MCT oil",
        "Keto iced coffee",
        "Almond milk shake"
      ],
      dessertBites: [
        "Keto brownie bite",
        "Cream cheese fat bomb",
        "Chocolate peanut butter cup",
        "Keto cheesecake bite",
        "Coconut fat bomb"
      ]
    }
  },
  flexitarian: {
    proteins: [
      "Chicken Breast",
      "Turkey Breast",
      "Lean Beef (occasional)",
      "Salmon",
      "Tuna",
      "Shrimp",
      "Eggs",
      "Greek Yogurt",
      "Cottage Cheese",
      "Tofu",
      "Tempeh",
      "Lentils",
      "Chickpeas",
      "Black Beans"
    ],
    starchyCarbs: [
      "Quinoa",
      "Brown Rice",
      "Oats",
      "Sweet Potato",
      "Regular Potato",
      "Whole Wheat Pasta",
      "Whole Wheat Bread",
      "Barley",
      "Farro",
      "Couscous"
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
      "Mushrooms",
      "Carrots",
      "Celery",
      "Cucumber"
    ],
    fats: [
      "Avocado",
      "Olive Oil",
      "Avocado Oil",
      "Almonds",
      "Walnuts",
      "Cashews",
      "Chia Seeds",
      "Flax Seeds",
      "Tahini",
      "Butter",
      "Cheese"
    ],
    fruit: [
      "Berries",
      "Apples",
      "Bananas",
      "Oranges",
      "Grapes",
      "Pears",
      "Peaches",
      "Mango",
      "Pineapple"
    ],
    snacks: {
      sweetTreats: [
        "Greek yogurt with berries",
        "Fruit parfait",
        "Apple with almond butter",
        "Chia pudding",
        "Smoothie bowl"
      ],
      savoryCrunchy: [
        "Hummus and carrots",
        "Roasted chickpeas",
        "Edamame",
        "Trail mix",
        "Cheese and crackers"
      ],
      lightGentle: [
        "Plain yogurt cup",
        "Cottage cheese",
        "Fruit cup",
        "Rice cakes",
        "Veggie sticks"
      ],
      proteinEnergy: [
        "Greek yogurt with granola",
        "Protein shake",
        "Hard-boiled eggs",
        "Tuna on crackers",
        "Protein bar"
      ],
      drinkables: [
        "Fruit smoothie",
        "Protein shake",
        "Green smoothie",
        "Kefir drink",
        "Berry smoothie"
      ],
      dessertBites: [
        "Frozen yogurt bar",
        "Energy ball",
        "Protein cookie",
        "Yogurt bark",
        "Fruit sorbet"
      ]
    }
  }
};
