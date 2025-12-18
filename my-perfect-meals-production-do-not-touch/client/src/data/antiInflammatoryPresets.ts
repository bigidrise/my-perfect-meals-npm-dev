export const ANTI_INFLAMMATORY_PRESETS = {
  "Inflammation Relief": {
    description:
      "General anti-inflammatory template focused on reducing systemic inflammation, supporting recovery, and balancing blood sugar.",
    limits: {
      caloriesMax: 650,
      saturatedFatMax: 8,
      sodiumMax: 600,
      sugarMax: 8,
      redMeatMax: 0,
    },
    avoid: [
      "Processed seed oils",
      "High-sodium meals",
      "Added sugars",
      "Refined grains",
      "Deep-fried items",
      "Artificial colors/additives",
    ],
    emphasize: [
      "Leafy greens",
      "Omega-3 fats",
      "Lean poultry/fish",
      "Whole-food carbohydrates",
      "Berries & antioxidants",
    ],
  },

  "Autoimmune Support": {
    description:
      "Designed for autoimmune conditions like lupus, RA, Hashimoto’s, Sjögren’s, and mixed connective tissue disorders.",
    limits: {
      caloriesMax: 600,
      saturatedFatMax: 6,
      sodiumMax: 550,
      sugarMax: 5,
      nightshadesMax: 0,
    },
    avoid: [
      "Tomatoes",
      "Peppers",
      "Eggplant",
      "Potatoes (white)",
      "Gluten-heavy foods",
      "Corn oils",
    ],
    emphasize: [
      "Omega-3 fats",
      "Low-glycemic carbs",
      "Lean proteins",
      "Anti-oxidant vegetables",
      "Turmeric/ginger/garlic",
    ],
  },

  "Joint Protection": {
    description:
      "Focused on lowering inflammation in connective tissues, supporting cartilage, and reducing flare-ups.",
    limits: {
      caloriesMax: 700,
      saturatedFatMax: 8,
      sodiumMax: 550,
      sugarMax: 6,
      redMeatMax: 0,
    },
    avoid: [
      "High-purine meats",
      "Processed pork",
      "Fried foods",
      "High-omega-6 oils",
      "Artificial sweeteners",
    ],
    emphasize: [
      "Collagen-supporting foods",
      "Bone broth",
      "Fatty fish",
      "Bright colored vegetables",
      "High fiber meals",
    ],
  },

  "Strict Anti-Inflammation": {
    description:
      "Highest level of inflammation control. Eliminates all known inflammatory triggers, ideal for severe autoimmune flares.",
    limits: {
      caloriesMax: 550,
      saturatedFatMax: 5,
      sodiumMax: 500,
      sugarMax: 4,
      redMeatMax: 0,
      dairyMax: 0,
      glutenMax: 0,
    },
    avoid: [
      "All dairy",
      "All gluten",
      "Nightshades",
      "Red meat",
      "Soy",
      "Corn",
      "Processed oils",
      "Added sugars",
      "Artificial anything",
    ],
    emphasize: [
      "Low-glycemic vegetables",
      "Wild-caught fish",
      "Fermented foods",
      "High magnesium foods",
      "Organic lean poultry",
    ],
  },
} as const;
