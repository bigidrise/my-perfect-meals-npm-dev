
export type AlcoholDrink = {
  id: string;
  name: string;
  description: string;
  image?: string;
  category: "Wine" | "Light Cocktail" | "Mixer";
  servingMl: number;
  abv_pct?: number;
  macros: {
    calories: number;
    carbs_g: number;
    sugars_g: number;
  };
  instructions?: string[];
  notes?: string[];
  ingredients?: Array<{
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
};

export const alcoholDrinks: AlcoholDrink[] = [
  {
    id: "vodka-soda-lime",
    name: "Vodka Soda + Lime",
    description: "Clean vodka with soda water and fresh lime",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 100,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour vodka over ice", "Top with soda water", "Squeeze lime wedges"],
    notes: ["Ask for extra lime", "No juice"],
    ingredients: [
      { name: "vodka", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "soda water", quantity: 6, unit: "oz", notes: undefined },
      { name: "lime wedge", quantity: 2, unit: "each", notes: undefined },
    ],
  },
  {
    id: "tequila-soda-lime",
    name: "Tequila Soda + Lime (Blanco)",
    description: "Blanco tequila with soda and lime",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 100,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour tequila over ice", "Add soda water", "Squeeze lime"],
    notes: ["Blanco tequila only", "Skip agave"],
    ingredients: [
      { name: "tequila", quantity: 1.5, unit: "oz", notes: "blanco" },
      { name: "soda water", quantity: 6, unit: "oz", notes: undefined },
      { name: "lime wedge", quantity: 1, unit: "each", notes: undefined },
    ],
  },
  {
    id: "gin-soda-cucumber",
    name: "Gin & Soda + Cucumber",
    description: "Refreshing gin with soda and cucumber",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 100,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Add gin to glass with ice", "Top with soda", "Add cucumber slices"],
    notes: ["Skip tonic", "Add cucumber"],
    ingredients: [
      { name: "gin", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "soda water", quantity: 6, unit: "oz", notes: undefined },
      { name: "cucumber", quantity: 3, unit: "slice", notes: undefined },
    ],
  },
  {
    id: "whiskey-neat-rocks",
    name: "Whiskey Neat/Rocks",
    description: "Simple whiskey served neat or on the rocks",
    category: "Light Cocktail",
    servingMl: 45,
    abv_pct: 40,
    macros: {
      calories: 105,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour whiskey into glass", "Add ice if desired"],
    notes: ["Optional splash of water"],
    ingredients: [
      { name: "whiskey", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "ice", quantity: 1, unit: "cup", notes: "optional" },
    ],
  },
  {
    id: "skinny-margarita",
    name: "Skinny Margarita",
    description: "Light margarita with tequila, lime, and soda",
    category: "Light Cocktail",
    servingMl: 180,
    abv_pct: 8,
    macros: {
      calories: 140,
      carbs_g: 5,
      sugars_g: 4,
    },
    instructions: ["Combine tequila and lime juice", "Add soda water", "Add bitters"],
    notes: ["No sour mix", "Add bitters for depth"],
    ingredients: [
      { name: "tequila", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "lime juice", quantity: 1, unit: "oz", notes: "fresh" },
      { name: "soda water", quantity: 2, unit: "oz", notes: undefined },
      { name: "angostura bitters", quantity: 2, unit: "dash", notes: undefined },
    ],
  },
  {
    id: "paloma-lite",
    name: "Paloma Lite",
    description: "Light paloma with tequila, grapefruit, and soda",
    category: "Light Cocktail",
    servingMl: 210,
    abv_pct: 7,
    macros: {
      calories: 120,
      carbs_g: 3,
      sugars_g: 2,
    },
    instructions: ["Add tequila to glass", "Muddle grapefruit", "Top with soda"],
    notes: ["No grapefruit soda", "Use fresh grapefruit"],
    ingredients: [
      { name: "tequila", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "grapefruit wedge", quantity: 2, unit: "each", notes: "fresh" },
      { name: "soda water", quantity: 4, unit: "oz", notes: undefined },
    ],
  },
  {
    id: "rum-diet-cola",
    name: "Rum & Diet Cola",
    description: "Classic rum and diet cola",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 100,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour rum over ice", "Add diet cola", "Squeeze lime"],
    notes: ["Add lime for diet Cuba Libre"],
    ingredients: [
      { name: "white rum", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "diet cola", quantity: 6, unit: "oz", notes: undefined },
      { name: "lime wedge", quantity: 1, unit: "each", notes: undefined },
    ],
  },
  {
    id: "vodka-unsweet-tea",
    name: "Vodka + Unsweet Iced Tea",
    description: "Vodka with unsweetened iced tea",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 110,
      carbs_g: 1,
      sugars_g: 0,
    },
    instructions: ["Pour vodka over ice", "Add unsweetened tea", "Squeeze lemon"],
    notes: ["Unsweet tea only"],
    ingredients: [
      { name: "vodka", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "iced tea", quantity: 6, unit: "oz", notes: "unsweetened" },
      { name: "lemon wedge", quantity: 1, unit: "each", notes: undefined },
    ],
  },
  {
    id: "dry-martini",
    name: "Dry Martini",
    description: "Classic dry martini with gin or vodka",
    category: "Light Cocktail",
    servingMl: 90,
    abv_pct: 30,
    macros: {
      calories: 190,
      carbs_g: 1.5,
      sugars_g: 0,
    },
    instructions: ["Stir spirit and vermouth with ice", "Strain into glass", "Garnish"],
    notes: ["Small serving", "Slow sip"],
    ingredients: [
      { name: "gin or vodka", quantity: 2.5, unit: "oz", notes: undefined },
      { name: "dry vermouth", quantity: 0.5, unit: "oz", notes: undefined },
      { name: "olives or lemon twist", quantity: 1, unit: "each", notes: "garnish" },
    ],
  },
  {
    id: "white-wine-spritzer",
    name: "Wine Spritzer (Dry White)",
    description: "Dry white wine with soda water",
    category: "Wine",
    servingMl: 300,
    abv_pct: 6,
    macros: {
      calories: 85,
      carbs_g: 2.5,
      sugars_g: 2,
    },
    instructions: ["Pour wine into tall glass", "Add soda water", "Add lemon slice"],
    notes: ["Tall glass", "More soda for lighter drink"],
    ingredients: [
      { name: "white wine", quantity: 5, unit: "oz", notes: "dry" },
      { name: "soda water", quantity: 5, unit: "oz", notes: undefined },
      { name: "lemon slice", quantity: 1, unit: "each", notes: undefined },
    ],
  },
  {
    id: "dry-white-wine",
    name: "Dry White Wine",
    description: "Dry white wine varietal",
    category: "Wine",
    servingMl: 150,
    abv_pct: 12,
    macros: {
      calories: 120,
      carbs_g: 3,
      sugars_g: 2,
    },
    instructions: ["Serve chilled in wine glass"],
    notes: ["Ask for dry varietals"],
    ingredients: [
      { name: "white wine", quantity: 5, unit: "oz", notes: "dry" },
    ],
  },
  {
    id: "dry-red-wine",
    name: "Dry Red Wine",
    description: "Dry red wine",
    category: "Wine",
    servingMl: 150,
    abv_pct: 13,
    macros: {
      calories: 125,
      carbs_g: 3.5,
      sugars_g: 3,
    },
    instructions: ["Serve in wine glass"],
    notes: ["Pick drier styles like Pinot Noir or Cabernet"],
    ingredients: [
      { name: "red wine", quantity: 5, unit: "oz", notes: "dry" },
    ],
  },
  {
    id: "brut-bubbles",
    name: "Brut Bubbles",
    description: "Brut prosecco or champagne",
    category: "Wine",
    servingMl: 150,
    abv_pct: 11,
    macros: {
      calories: 100,
      carbs_g: 3,
      sugars_g: 2,
    },
    instructions: ["Serve chilled in flute"],
    notes: ["Say brut for drier style"],
    ingredients: [
      { name: "prosecco or champagne", quantity: 5, unit: "oz", notes: "brut" },
    ],
  },
  {
    id: "light-beer",
    name: "Light Beer",
    description: "Light or session beer",
    category: "Light Cocktail",
    servingMl: 355,
    abv_pct: 4,
    macros: {
      calories: 100,
      carbs_g: 5,
      sugars_g: 0,
    },
    instructions: ["Serve cold"],
    notes: ["Ask for light or session style"],
    ingredients: [
      { name: "light beer", quantity: 12, unit: "oz", notes: undefined },
    ],
  },
  {
    id: "michelada-lite",
    name: "Michelada-Lite",
    description: "Light beer with lime and hot sauce",
    category: "Light Cocktail",
    servingMl: 355,
    abv_pct: 4,
    macros: {
      calories: 120,
      carbs_g: 5,
      sugars_g: 0,
    },
    instructions: ["Rim glass with salt", "Add lime juice and hot sauce", "Pour beer"],
    notes: ["No premade mix"],
    ingredients: [
      { name: "light beer", quantity: 12, unit: "oz", notes: undefined },
      { name: "lime juice", quantity: 1, unit: "oz", notes: "fresh" },
      { name: "hot sauce", quantity: 3, unit: "dash", notes: undefined },
      { name: "salt", quantity: 0.25, unit: "tsp", notes: undefined },
    ],
  },
  {
    id: "hard-seltzer-zero",
    name: "Hard Seltzer (Zero Sugar)",
    description: "Zero sugar hard seltzer",
    category: "Light Cocktail",
    servingMl: 355,
    abv_pct: 5,
    macros: {
      calories: 95,
      carbs_g: 2,
      sugars_g: 0,
    },
    instructions: ["Serve cold"],
    notes: ["Confirm zero sugar"],
    ingredients: [
      { name: "hard seltzer", quantity: 12, unit: "oz", notes: "zero sugar" },
    ],
  },
  {
    id: "tequila-rocks-orange-peel",
    name: "Tequila Rocks + Orange Peel",
    description: "Tequila on the rocks with aromatic orange peel",
    category: "Light Cocktail",
    servingMl: 45,
    abv_pct: 40,
    macros: {
      calories: 105,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour tequila over ice", "Express orange peel over glass"],
    notes: ["Aromatic without syrup"],
    ingredients: [
      { name: "tequila", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "orange peel", quantity: 1, unit: "twist", notes: undefined },
      { name: "ice", quantity: 1, unit: "cup", notes: undefined },
    ],
  },
  {
    id: "whiskey-highball",
    name: "Whiskey Highball",
    description: "Whiskey with soda water in a tall glass",
    category: "Light Cocktail",
    servingMl: 240,
    abv_pct: 5,
    macros: {
      calories: 105,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Pour whiskey over ice in tall glass", "Top with soda", "Stir gently"],
    notes: ["Tall glass", "Slow sip"],
    ingredients: [
      { name: "whiskey", quantity: 1.5, unit: "oz", notes: undefined },
      { name: "soda water", quantity: 6, unit: "oz", notes: undefined },
      { name: "ice", quantity: 1, unit: "cup", notes: undefined },
    ],
  },
  {
    id: "aperol-spritz-lite",
    name: "Aperol Spritz-Lite",
    description: "Lighter aperol spritz with extra soda",
    category: "Light Cocktail",
    servingMl: 210,
    abv_pct: 8,
    macros: {
      calories: 150,
      carbs_g: 12,
      sugars_g: 10,
    },
    instructions: ["Add Aperol to glass with ice", "Add prosecco", "Top with soda", "Garnish with orange"],
    notes: ["Extra soda", "Light Aperol"],
    ingredients: [
      { name: "aperol", quantity: 2, unit: "oz", notes: undefined },
      { name: "prosecco", quantity: 3, unit: "oz", notes: undefined },
      { name: "soda water", quantity: 2, unit: "oz", notes: undefined },
      { name: "orange slice", quantity: 1, unit: "each", notes: undefined },
    ],
  },
  {
    id: "na-saver-soda-bitters-lime",
    name: "NA Saver: Soda + Bitters + Lime",
    description: "Non-alcoholic soda with bitters and lime",
    category: "Mixer",
    servingMl: 420,
    abv_pct: 0,
    macros: {
      calories: 5,
      carbs_g: 0,
      sugars_g: 0,
    },
    instructions: ["Fill glass with ice and soda", "Add bitters", "Squeeze lime"],
    notes: ["No syrup", "Looks like a cocktail"],
    ingredients: [
      { name: "soda water", quantity: 14, unit: "oz", notes: undefined },
      { name: "angostura bitters", quantity: 4, unit: "dash", notes: undefined },
      { name: "lime wedge", quantity: 2, unit: "each", notes: undefined },
    ],
  },
];
