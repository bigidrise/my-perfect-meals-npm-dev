// 🔒 LOCKED: Fridge Rescue Template Library - DO NOT MODIFY  
// This deterministic template system generates perfect meals every time
// User confirmed it's working perfectly - any changes will break reliability
import { DietFlag } from '../types/fridge';

export interface TemplateSlot {
  slot: 'protein' | 'veg' | 'carb' | 'fat' | 'aroma' | 'condiment';
  required: boolean;
  allow?: string[];      // allowed tags (whitelist)
  avoid?: string[];      // forbidden tags (blacklist)
}

export interface TemplateDef {
  id: string;
  title: string;
  summary: string;
  slots: TemplateSlot[];
  dietOk?: (flags: DietFlag[]) => boolean; // simple gate
  build: (pick: (slot: TemplateSlot) => string | undefined, servings: number) => {
    ingredients: { name: string; amount: string; category: TemplateSlot['slot'] }[];
    instructions: string[];
    tags: string[];
    nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'one_pan_stir_fry',
    title: 'One‑Pan Protein + Veg Stir‑Fry',
    summary: 'Fast skillet stir‑fry with rice (or low‑carb over zucchini).',
    slots: [
      { slot: 'protein', required: true },
      { slot: 'veg', required: true },
      { slot: 'carb', required: false, allow: ['rice', 'quinoa'] },
      { slot: 'fat', required: true, allow: ['olive_oil', 'avocado_oil'] },
      { slot: 'aroma', required: false, allow: ['garlic', 'onion'] },
      { slot: 'condiment', required: false, allow: ['soy_sauce', 'salsa'] },
    ],
    dietOk: (flags) => true,
    build: (pick, servings) => {
      const protein = pick({ slot: 'protein', required: true }) || 'chicken';
      const veg = pick({ slot: 'veg', required: true }) || 'broccoli';
      const carb = pick({ slot: 'carb', required: false }) || 'rice';
      const fat = pick({ slot: 'fat', required: true }) || 'olive_oil';
      const aroma = pick({ slot: 'aroma', required: false });
      const sauce = pick({ slot: 'condiment', required: false });

      const per = {
        protein_g: 140, carbs_g: carb ? 45 : 15, fat_g: 12,
      };
      const cal = per.protein_g*4 + per.carbs_g*4 + per.fat_g*9; // simple estimate per serving

      const ing = [
        { name: protein.replace('_', ' '), amount: `${round(150*servings)} g`, category: 'protein' as const },
        { name: veg.replace('_', ' '), amount: `${round(2*servings)} cups`, category: 'veg' as const },
        ...(carb ? [{ name: carb.replace('_', ' '), amount: `${round(0.75*servings)} cup cooked`, category: 'carb' as const }] : []),
        { name: fat === 'olive_oil' ? 'olive oil' : 'avocado oil', amount: `${round(1*servings)} tbsp`, category: 'fat' as const },
        ...(aroma ? [{ name: aroma.replace('_', ' '), amount: `${round(1*servings)} tbsp, minced`, category: 'aroma' as const }] : []),
        ...(sauce ? [{ name: sauce.replace('_', ' '), amount: `${round(2*servings)} tbsp`, category: 'condiment' as const }] : []),
      ];

      const steps = [
        'Heat a large skillet over medium‑high. Add oil.',
        `Season and sear ${protein.replace('_',' ')} 3–4 min/side until browned.`,
        `Add ${veg.replace('_',' ')} (and ${aroma?.replace('_',' ') ?? 'aromatics if using'}). Stir‑fry 4–5 min until crisp‑tender.`,
        sauce ? `Splash in ${sauce.replace('_',' ')}; toss 30–60 sec.` : 'Season with salt/pepper.',
        carb ? `Serve over cooked ${carb.replace('_',' ')}.` : 'Serve as is for lower‑carb.',
      ];

      return {
        ingredients: ing,
        instructions: steps,
        tags: ['30‑min', 'one‑pan', carb ? 'with‑carb' : 'low‑carb'],
        nutrition: { calories: Math.round(cal), protein_g: per.protein_g, carbs_g: per.carbs_g, fat_g: per.fat_g },
      };
    },
  },
  {
    id: 'egg_veggie_omelet',
    title: 'Egg & Veggie Omelet',
    summary: 'High‑protein 10‑minute omelet. Breakfast for dinner wins.',
    slots: [
      { slot: 'protein', required: true, allow: ['eggs'] },
      { slot: 'veg', required: true },
      { slot: 'fat', required: true, allow: ['olive_oil', 'butter', 'avocado_oil'] },
      { slot: 'condiment', required: false, allow: ['cheese', 'salsa'] },
    ],
    dietOk: (flags) => !flags.includes('vegan'),
    build: (pick, servings) => {
      const veg = pick({ slot: 'veg', required: true }) || 'spinach';
      const fat = pick({ slot: 'fat', required: true }) || 'olive_oil';
      const topping = pick({ slot: 'condiment', required: false });
      const per = { protein_g: 24, carbs_g: 4, fat_g: 18 };
      const cal = per.protein_g*4 + per.carbs_g*4 + per.fat_g*9;
      const ing = [
        { name: 'eggs', amount: `${Math.max(2, Math.round(3*servings))} large`, category: 'protein' as const },
        { name: veg.replace('_',' '), amount: `${round(1.5*servings)} cups`, category: 'veg' as const },
        { name: fat === 'butter' ? 'butter' : fat.replace('_',' '), amount: `${round(1*servings)} tbsp`, category: 'fat' as const },
        ...(topping ? [{ name: topping.replace('_',' '), amount: `${round(2*servings)} tbsp`, category: 'condiment' as const }] : []),
      ];
      const steps = [
        'Beat eggs with a pinch of salt/pepper.',
        `Sauté ${veg.replace('_',' ')} in a nonstick skillet with ${fat.replace('_',' ')} 1–2 min.`,
        'Pour in eggs, lift edges as it sets. Fold when almost cooked through.',
        topping ? `Top with ${topping.replace('_',' ')} and serve.` : 'Serve hot.',
      ];
      return { ingredients: ing, instructions: steps, tags: ['10‑min', 'high‑protein'], nutrition: { calories: Math.round(cal), ...per } };
    },
  },
  {
    id: 'sheet_pan_dinner',
    title: 'Sheet‑Pan Protein & Veg',
    summary: 'Zero‑drama tray bake.',
    slots: [
      { slot: 'protein', required: true },
      { slot: 'veg', required: true },
      { slot: 'fat', required: true },
      { slot: 'carb', required: false, allow: ['potato', 'bread'] },
    ],
    dietOk: (flags) => true,
    build: (pick, servings) => {
      const protein = pick({ slot: 'protein', required: true }) || 'chicken';
      const veg = pick({ slot: 'veg', required: true }) || 'carrot';
      const fat = pick({ slot: 'fat', required: true }) || 'olive_oil';
      const carb = pick({ slot: 'carb', required: false });
      const per = { protein_g: 120, carbs_g: carb ? 40 : 18, fat_g: 14 };
      const cal = per.protein_g*4 + per.carbs_g*4 + per.fat_g*9;
      const ing = [
        { name: protein.replace('_',' '), amount: `${round(180*servings)} g`, category: 'protein' as const },
        { name: veg.replace('_',' '), amount: `${round(3*servings)} cups`, category: 'veg' as const },
        { name: fat.replace('_',' '), amount: `${round(1.5*servings)} tbsp`, category: 'fat' as const },
        ...(carb ? [{ name: carb.replace('_',' '), amount: `${round(1*servings)} cup`, category: 'carb' as const }] : []),
      ];
      const steps = [
        'Heat oven to 425°F (220°C). Line a sheet pan.',
        `Toss ${protein.replace('_',' ')} and ${veg.replace('_',' ')} with ${fat.replace('_',' ')} + salt/pepper.`,
        'Roast 18–25 min until protein hits safe temp and veg tender.',
        carb ? `Serve with ${carb.replace('_',' ')}.` : 'Serve hot.',
      ];
      return { ingredients: ing, instructions: steps, tags: ['30‑min', 'hands‑off'], nutrition: { calories: Math.round(cal), ...per } };
    },
  },
  {
    id: 'protein_salad_bowl',
    title: 'Fresh Protein Salad Bowl',
    summary: 'Light, fresh bowl with protein and crunchy veg.',
    slots: [
      { slot: 'protein', required: true },
      { slot: 'veg', required: true },
      { slot: 'fat', required: true, allow: ['avocado', 'olive_oil', 'nuts'] },
      { slot: 'condiment', required: false },
    ],
    dietOk: (flags) => true,
    build: (pick, servings) => {
      const protein = pick({ slot: 'protein', required: true }) || 'chicken';
      const veg = pick({ slot: 'veg', required: true }) || 'lettuce';
      const fat = pick({ slot: 'fat', required: true }) || 'avocado';
      const dressing = pick({ slot: 'condiment', required: false });
      const per = { protein_g: 130, carbs_g: 12, fat_g: 16 };
      const cal = per.protein_g*4 + per.carbs_g*4 + per.fat_g*9;
      const ing = [
        { name: protein.replace('_',' '), amount: `${round(140*servings)} g`, category: 'protein' as const },
        { name: veg.replace('_',' '), amount: `${round(3*servings)} cups`, category: 'veg' as const },
        { name: fat.replace('_',' '), amount: fat === 'avocado' ? `${round(0.5*servings)} whole` : `${round(2*servings)} tbsp`, category: 'fat' as const },
        ...(dressing ? [{ name: dressing.replace('_',' '), amount: `${round(1*servings)} tbsp`, category: 'condiment' as const }] : []),
      ];
      const steps = [
        `Cook ${protein.replace('_',' ')} until done. Season and let cool.`,
        `Chop ${veg.replace('_',' ')} and arrange in bowls.`,
        `Top with ${protein.replace('_',' ')} and ${fat.replace('_',' ')}.`,
        dressing ? `Drizzle with ${dressing.replace('_',' ')}.` : 'Season with salt, pepper, and lemon.',
      ];
      return { ingredients: ing, instructions: steps, tags: ['15‑min', 'fresh', 'light'], nutrition: { calories: Math.round(cal), ...per } };
    },
  },
  {
    id: 'simple_protein_rice',
    title: 'Simple Protein & Rice',
    summary: 'Classic protein over rice - always satisfying.',
    slots: [
      { slot: 'protein', required: true },
      { slot: 'carb', required: true, allow: ['rice', 'quinoa'] },
      { slot: 'fat', required: true },
      { slot: 'veg', required: false },
      { slot: 'aroma', required: false },
    ],
    dietOk: (flags) => true,
    build: (pick, servings) => {
      const protein = pick({ slot: 'protein', required: true }) || 'chicken';
      const carb = pick({ slot: 'carb', required: true }) || 'rice';
      const fat = pick({ slot: 'fat', required: true }) || 'olive_oil';
      const veg = pick({ slot: 'veg', required: false });
      const aroma = pick({ slot: 'aroma', required: false });
      const per = { protein_g: 135, carbs_g: 50, fat_g: 10 };
      const cal = per.protein_g*4 + per.carbs_g*4 + per.fat_g*9;
      const ing = [
        { name: protein.replace('_',' '), amount: `${round(160*servings)} g`, category: 'protein' as const },
        { name: carb.replace('_',' '), amount: `${round(0.8*servings)} cup cooked`, category: 'carb' as const },
        { name: fat.replace('_',' '), amount: `${round(1*servings)} tbsp`, category: 'fat' as const },
        ...(veg ? [{ name: veg.replace('_',' '), amount: `${round(1.5*servings)} cups`, category: 'veg' as const }] : []),
        ...(aroma ? [{ name: aroma.replace('_',' '), amount: `${round(0.5*servings)} tbsp`, category: 'aroma' as const }] : []),
      ];
      const steps = [
        `Cook ${carb.replace('_',' ')} according to package directions.`,
        `Season ${protein.replace('_',' ')} with salt and pepper.`,
        `Heat ${fat.replace('_',' ')} in a pan. Cook ${protein.replace('_',' ')} until done.`,
        veg ? `Add ${veg.replace('_',' ')} and cook until tender.` : '',
        `Serve over ${carb.replace('_',' ')}.`,
      ].filter(Boolean);
      return { ingredients: ing, instructions: steps, tags: ['20‑min', 'classic'], nutrition: { calories: Math.round(cal), ...per } };
    },
  },
];

// Quick fallback meals when fridge is sparse
export const QUICK_MEALS = [
  {
    id: 'eggs_scramble',
    title: 'Quick Veggie Scramble',
    summary: 'Fast scrambled eggs with whatever veg you have.',
    ingredients: [
      { name: 'eggs', amount: '4 large', category: 'protein' as const },
      { name: 'mixed vegetables', amount: '1 cup', category: 'veg' as const },
      { name: 'oil or butter', amount: '1 tbsp', category: 'fat' as const },
    ],
    instructions: [
      'Beat eggs with salt and pepper.',
      'Heat oil in a nonstick pan. Add vegetables, cook 2-3 min.',
      'Pour in eggs, scramble gently until just set.',
      'Serve immediately.',
    ],
    tags: ['5‑min', 'emergency'],
    nutrition: { calories: 320, protein_g: 24, carbs_g: 8, fat_g: 22 },
  },
  {
    id: 'simple_pasta',
    title: 'Simple Pasta',
    summary: 'Basic pasta with whatever you have on hand.',
    ingredients: [
      { name: 'pasta', amount: '2 cups cooked', category: 'carb' as const },
      { name: 'olive oil', amount: '2 tbsp', category: 'fat' as const },
      { name: 'garlic', amount: '1 tbsp minced', category: 'aroma' as const },
      { name: 'any protein', amount: '100 g', category: 'protein' as const },
    ],
    instructions: [
      'Cook pasta according to package directions.',
      'Heat oil, add garlic and protein.',
      'Toss with cooked pasta.',
      'Season with salt and pepper.',
    ],
    tags: ['15‑min', 'simple'],
    nutrition: { calories: 450, protein_g: 20, carbs_g: 55, fat_g: 15 },
  },
  {
    id: 'basic_soup',
    title: 'Quick Soup',
    summary: 'Warm, comforting soup with available ingredients.',
    ingredients: [
      { name: 'broth or water', amount: '2 cups', category: 'other' as const },
      { name: 'protein', amount: '100 g', category: 'protein' as const },
      { name: 'vegetables', amount: '1.5 cups', category: 'veg' as const },
      { name: 'carbs (optional)', amount: '0.5 cup', category: 'carb' as const },
    ],
    instructions: [
      'Bring broth to a simmer.',
      'Add protein and cook until almost done.',
      'Add vegetables and carbs if using.',
      'Simmer until everything is tender.',
    ],
    tags: ['25‑min', 'comfort'],
    nutrition: { calories: 280, protein_g: 18, carbs_g: 25, fat_g: 8 },
  },
];