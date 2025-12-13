/**
 * HORMONE & LIFE STAGES PRESETS
 * Medical-grade nutrition presets with clinical references
 * 
 * ⚠️ BETA - Doctor Review Required
 * Educational content only. Not medical care. Consult clinician.
 */

export type HormonePresetId = 
  | "menopause-support"
  | "pcos-ir-support"
  | "testosterone-friendly"
  | "cortisol-sleep-support";

export type HormonePresetAudience = "women" | "men" | "all";

export interface HormonePreset {
  id: HormonePresetId;
  name: string;
  category: "specialty";
  subCategory: "hormone-life-stages";
  audience: HormonePresetAudience;
  
  // Educational content
  intent: string; // Plain language explanation
  whyItMatters: string; // Educational "why" for doctors to review
  
  // Nutrient emphasis (tags for future meal filtering)
  nutrientEmphasisTags: string[];
  
  // Food guidance (educational, not prescriptive)
  foodsToFavor: string[];
  foodTimingHabits: string[];
  
  // Clinical references
  disclaimer: string;
  references: {
    title: string;
    url: string;
    source: string;
  }[];
  
  // Macro guidance (use Balanced default for v1)
  macroGuidance: {
    note: string;
    useBalancedDefault: boolean;
  };
  
  // Status flags
  status: "beta";
  doctorReviewRequired: true;
  isActive: boolean;
  
  // Menu structure (empty for scaffold)
  menus: {
    status: "coming-soon";
    message: string;
  };
  
  // Sample 2-day outline (for doctor review, not implementation yet)
  sampleOutline?: {
    dayA: {
      breakfast: string;
      lunch: string;
      snack: string;
      dinner: string;
    };
    dayB: {
      breakfast: string;
      lunch: string;
      snack: string;
      dinner: string;
    };
  };
}

export const HORMONE_LIFE_STAGES_PRESETS: Record<HormonePresetId, HormonePreset> = {
  "menopause-support": {
    id: "menopause-support",
    name: "Menopause Support",
    category: "specialty",
    subCategory: "hormone-life-stages",
    audience: "women",
    
    intent: "Support steady energy, weight stability, muscle/bone health, and healthy cardiometabolic profile during menopause and perimenopause.",
    
    whyItMatters: "Hormonal changes during menopause affect metabolism, bone density, muscle mass, and cardiovascular health. Evidence-based nutrition focuses on adequate protein distribution, calcium/vitamin D awareness, fiber, and healthy fats to support these physiological changes.",
    
    nutrientEmphasisTags: [
      "protein-forward",
      "calcium-aware",
      "vitamin-D-aware",
      "omega-3",
      "high-fiber",
      "potassium-rich",
      "magnesium-aware"
    ],
    
    foodsToFavor: [
      "Fatty fish (salmon, sardines) for omega-3 and vitamin D",
      "Greek yogurt/skyr (fortified) for protein and calcium",
      "Eggs for protein and nutrients",
      "Tofu/tempeh for plant protein and isoflavones",
      "Beans/lentils for fiber and protein",
      "Leafy greens for calcium, magnesium, potassium",
      "Cruciferous vegetables for fiber and nutrients",
      "Berries for antioxidants",
      "Whole grains (oats, barley) for fiber",
      "Nuts/seeds for healthy fats and minerals",
      "Extra-virgin olive oil for heart health"
    ],
    
    foodTimingHabits: [
      "Distribute protein across all meals (aim for 25-30g per meal)",
      "Pair carbohydrates with protein and fiber to support blood sugar stability",
      "Limit alcohol intake (impacts bone health and hot flashes)",
      "Prioritize strength training + walking (copy kept generic for safety)"
    ],
    
    disclaimer: "Educational content. Not medical care. Consult your clinician. (Beta - Doctor Review Required)",
    
    references: [
      {
        title: "Menopause weight gain: Stop the middle age spread",
        url: "https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/menopause-weight-gain/art-20046058",
        source: "Mayo Clinic"
      },
      {
        title: "Menopause and healthy lifestyle",
        url: "https://www.mayoclinic.org/diseases-conditions/menopause/in-depth/menopause/art-20047587",
        source: "Mayo Clinic"
      }
    ],
    
    macroGuidance: {
      note: "Using Balanced macro default until clinical review. Protein distribution is key.",
      useBalancedDefault: true
    },
    
    status: "beta",
    doctorReviewRequired: true,
    isActive: true,
    
    menus: {
      status: "coming-soon",
      message: "Menus are being developed with clinical oversight. You can explore the nutritional framework and references below."
    },
    
    sampleOutline: {
      dayA: {
        breakfast: "Greek yogurt + berries + oats; green tea",
        lunch: "Lentil-veggie bowl + olive oil vinaigrette",
        snack: "Cottage cheese + sliced kiwi",
        dinner: "Salmon, roasted broccoli, quinoa"
      },
      dayB: {
        breakfast: "Veggie omelet + whole-grain toast",
        lunch: "Tofu stir-fry, brown rice, edamame",
        snack: "Apple + peanut butter",
        dinner: "Chicken or chickpea piccata, spinach, potatoes"
      }
    }
  },

  "pcos-ir-support": {
    id: "pcos-ir-support",
    name: "PCOS / Insulin-Resistance Support",
    category: "specialty",
    subCategory: "hormone-life-stages",
    audience: "women",
    
    intent: "Support insulin sensitivity with steady-carb, high-fiber pattern for stable energy and hormonal balance.",
    
    whyItMatters: "PCOS and insulin resistance benefit from complex carbohydrates paired with protein and fiber to minimize blood sugar spikes. Evidence suggests focusing on low-glycemic foods and consistent meal timing supports metabolic and hormonal health.",
    
    nutrientEmphasisTags: [
      "high-fiber",
      "low-GI-emphasis",
      "protein-anchor",
      "omega-3",
      "magnesium-aware",
      "potassium-rich",
      "added-sugar-light"
    ],
    
    foodsToFavor: [
      "Non-starchy vegetables for fiber and low glycemic load",
      "Beans/lentils for fiber and plant protein",
      "Whole grains (oats, quinoa, barley) for complex carbs",
      "Berries for antioxidants and lower sugar",
      "Nuts/seeds for healthy fats and fiber",
      "Fish for omega-3 fatty acids",
      "Eggs for protein",
      "Greek yogurt/skyr for protein",
      "Tofu/tempeh for plant protein",
      "Minimize refined sweets and sugary drinks"
    ],
    
    foodTimingHabits: [
      "Keep carbs complex and paired with protein/fat",
      "Space meals to avoid large blood sugar spikes",
      "Focus on fiber at each meal (vegetables, whole grains, legumes)",
      "Limit ultra-processed foods and added sugars"
    ],
    
    disclaimer: "Educational content. Not medical care. Consult your clinician. (Beta - Doctor Review Required)",
    
    references: [
      {
        title: "PCOS - Diagnosis and treatment",
        url: "https://www.mayoclinic.org/diseases-conditions/pcos/diagnosis-treatment/drc-20353443",
        source: "Mayo Clinic"
      },
      {
        title: "What is insulin resistance? Mayo Clinic expert explains",
        url: "https://www.mayoclinic.org/diseases-conditions/obesity/multimedia/vid-20536756",
        source: "Mayo Clinic"
      },
      {
        title: "PCOS Diet: What to eat and avoid",
        url: "https://www.hopkinsmedicine.org/health/wellness-and-prevention/pcos-diet",
        source: "Johns Hopkins Medicine"
      }
    ],
    
    macroGuidance: {
      note: "Using Balanced macro default until clinical review. Carb quality (complex, high-fiber) is priority.",
      useBalancedDefault: true
    },
    
    status: "beta",
    doctorReviewRequired: true,
    isActive: true,
    
    menus: {
      status: "coming-soon",
      message: "Menus are being developed with clinical oversight. You can explore the nutritional framework and references below."
    },
    
    sampleOutline: {
      dayA: {
        breakfast: "Veggie scramble + avocado + black beans",
        lunch: "Chickpea-quinoa salad (olive oil, herbs)",
        snack: "Skyr + chia seeds",
        dinner: "Baked cod, asparagus, farro"
      },
      dayB: {
        breakfast: "Overnight oats (oats/chia/berries/Greek yogurt)",
        lunch: "Turkey or tofu lettuce wraps + crunchy veg",
        snack: "Handful of almonds + clementine",
        dinner: "Lentil bolognese over zucchini & whole-grain pasta mix"
      }
    }
  },

  "testosterone-friendly": {
    id: "testosterone-friendly",
    name: "Testosterone-Friendly / Andropause Support",
    category: "specialty",
    subCategory: "hormone-life-stages",
    audience: "men",
    
    intent: "Support weight management, muscle maintenance, and cardiometabolic health through lifestyle-first nutrition.",
    
    whyItMatters: "Age-related testosterone changes affect muscle mass, body composition, and metabolic health. Evidence-based nutrition emphasizes adequate protein, healthy fats, fiber, and whole foods to support these physiological needs. Lifestyle factors (weight, activity) relate to testosterone levels.",
    
    nutrientEmphasisTags: [
      "protein-forward",
      "high-fiber",
      "unsat-fat-focus",
      "omega-3",
      "vegetable-rich",
      "added-sugar-light"
    ],
    
    foodsToFavor: [
      "Fish (fatty and white) for protein and omega-3",
      "Poultry for lean protein",
      "Legumes for plant protein and fiber",
      "Soy foods (edamame, tofu) for protein",
      "Eggs for protein and nutrients",
      "Greek yogurt for protein",
      "Nuts/seeds for healthy fats and minerals",
      "Extra-virgin olive oil for heart health",
      "Whole grains for fiber and sustained energy",
      "Colorful vegetables and fruits for nutrients"
    ],
    
    foodTimingHabits: [
      "Protein at each meal to support muscle maintenance",
      "Limit ultra-processed foods and excess alcohol",
      "Focus on unsaturated fats over saturated fats",
      "Prioritize strength training + aerobic activity (copy generic)"
    ],
    
    disclaimer: "Educational content. Not medical care. Consult your clinician. (Beta - Doctor Review Required)",
    
    references: [
      {
        title: "Lifestyle strategies for testosterone health",
        url: "https://www.health.harvard.edu/mens-health/lifestyle-strategies-to-help-prevent-natural-age-related-decline-in-testosterone",
        source: "Harvard Health"
      },
      {
        title: "Testosterone therapy: Potential benefits and risks",
        url: "https://www.mayoclinic.org/healthy-lifestyle/sexual-health/in-depth/testosterone-therapy/art-20045728",
        source: "Mayo Clinic"
      }
    ],
    
    macroGuidance: {
      note: "Using Balanced macro default until clinical review. Adequate protein is key for muscle maintenance.",
      useBalancedDefault: true
    },
    
    status: "beta",
    doctorReviewRequired: true,
    isActive: true,
    
    menus: {
      status: "coming-soon",
      message: "Menus are being developed with clinical oversight. You can explore the nutritional framework and references below."
    },
    
    sampleOutline: {
      dayA: {
        breakfast: "Omelet + mushrooms/spinach; fruit",
        lunch: "Grilled chicken, wild rice, mixed greens",
        snack: "Yogurt + walnuts",
        dinner: "Trout, sweet potato, green beans"
      },
      dayB: {
        breakfast: "Protein smoothie (yogurt, berries, oats)",
        lunch: "Lentil chili + side salad",
        snack: "Hummus + carrots/peppers",
        dinner: "Tofu/veggie stir-fry, soba noodles"
      }
    }
  },

  "cortisol-sleep-support": {
    id: "cortisol-sleep-support",
    name: "Stress, Cortisol & Sleep Support",
    category: "specialty",
    subCategory: "hormone-life-stages",
    audience: "all",
    
    intent: "Stabilize energy and support sleep hygiene through food timing and gentle nutrition patterns.",
    
    whyItMatters: "Chronic stress and poor sleep affect cortisol patterns, energy levels, and overall health. Evidence-based approaches focus on meal timing, limiting evening caffeine/heavy meals, and emphasizing nutrients that support relaxation and sleep quality.",
    
    nutrientEmphasisTags: [
      "high-fiber",
      "protein-anchor",
      "magnesium-aware",
      "tryptophan-source",
      "caffeine-smart",
      "evening-light-meal"
    ],
    
    foodsToFavor: [
      "Leafy greens for magnesium",
      "Legumes for fiber and magnesium",
      "Whole grains for complex carbs and B vitamins",
      "Nuts/seeds for magnesium and healthy fats",
      "Milk/yogurt for calcium and tryptophan",
      "Turkey/eggs for tryptophan",
      "Bananas/kiwi/berries for nutrients",
      "Chamomile or herbal teas (non-caffeinated)"
    ],
    
    foodTimingHabits: [
      "Avoid heavy/large meals close to bedtime (Mayo Clinic - sleep tips)",
      "Limit caffeine in afternoon/evening (Mayo Clinic - sleep tips)",
      "Avoid nicotine and limit alcohol (can disrupt sleep quality)",
      "Magnesium is essential for nerve/muscle function (NIH ODS - prefer food sources)",
      "Consider lighter dinner to support better sleep quality"
    ],
    
    disclaimer: "Educational content. Not medical care. Consult your clinician. (Beta - Doctor Review Required)",
    
    references: [
      {
        title: "Sleep tips: 6 steps to better sleep",
        url: "https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/sleep/art-20048379",
        source: "Mayo Clinic"
      },
      {
        title: "Magnesium - Health Professional Fact Sheet",
        url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/",
        source: "NIH Office of Dietary Supplements"
      },
      {
        title: "Sleep and caffeine",
        url: "https://www.cdc.gov/sleep/about_sleep/sleep_hygiene.html",
        source: "CDC"
      }
    ],
    
    macroGuidance: {
      note: "Using Balanced macro default until clinical review. Meal timing and light evening meals are key.",
      useBalancedDefault: true
    },
    
    status: "beta",
    doctorReviewRequired: true,
    isActive: true,
    
    menus: {
      status: "coming-soon",
      message: "Menus are being developed with clinical oversight. You can explore the nutritional framework and references below."
    },
    
    sampleOutline: {
      dayA: {
        breakfast: "Oats + milk/yogurt, walnuts, blueberries",
        lunch: "Turkey & avocado whole-grain wrap + side salad",
        snack: "Banana + pumpkin seeds",
        dinner: "Farro + chickpeas + roasted veg (lighter); chamomile tea later"
      },
      dayB: {
        breakfast: "Scrambled eggs + sautéed greens; whole-grain toast",
        lunch: "Salmon salad bowl (olive oil, quinoa)",
        snack: "Kiwi + cottage cheese",
        dinner: "Lentil soup + side spinach salad (lighter); tart-cherry or herbal tea"
      }
    }
  }
};

// Helper to get preset by ID
export function getHormonePreset(id: HormonePresetId): HormonePreset | undefined {
  return HORMONE_LIFE_STAGES_PRESETS[id];
}

// Helper to get all presets as array
export function getAllHormonePresets(): HormonePreset[] {
  return Object.values(HORMONE_LIFE_STAGES_PRESETS);
}

// Helper to get presets by audience
export function getHormonePresetsByAudience(audience: HormonePresetAudience): HormonePreset[] {
  return getAllHormonePresets().filter(p => p.audience === audience || p.audience === "all");
}
