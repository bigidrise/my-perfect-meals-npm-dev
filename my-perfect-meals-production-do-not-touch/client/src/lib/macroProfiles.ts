export type MacroProfile = 'whey' | 'chicken' | 'turkey' | 'fish' | 'beef' | 'rice' | 'oats' | 'veggies' | 'oil';

export interface MacroProfileInfo {
  id: MacroProfile;
  label: string;
  hint: string;
  category: 'protein' | 'carb' | 'fat';
}

export const MACRO_PROFILES: MacroProfileInfo[] = [
  { id: 'whey', label: 'Whey / Isolate', hint: 'Protein shake', category: 'protein' },
  { id: 'chicken', label: 'Chicken', hint: 'Lean protein', category: 'protein' },
  { id: 'turkey', label: 'Turkey', hint: 'Lean protein', category: 'protein' },
  { id: 'fish', label: 'White Fish', hint: 'Lean protein', category: 'protein' },
  { id: 'beef', label: 'Red Meat', hint: 'Beef/steak', category: 'protein' },
  { id: 'rice', label: 'Rice', hint: 'Starchy carb', category: 'carb' },
  { id: 'oats', label: 'Oats', hint: 'Carb + fiber', category: 'carb' },
  { id: 'veggies', label: 'Fibrous Veggies', hint: 'Low-cal carb', category: 'carb' },
  { id: 'oil', label: 'Olive Oil', hint: 'Healthy fat', category: 'fat' },
];

export interface ComputedMacros {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export function computeMacrosFromProfile(
  proteinGrams: number,
  carbsGrams: number,
  fatGrams: number,
  profile: MacroProfile
): ComputedMacros {
  const P = proteinGrams || 0;
  const C = carbsGrams || 0;
  const F = fatGrams || 0;

  let finalP = P;
  let finalC = C;
  let finalF = F;

  switch (profile) {
    case 'whey':
      break;
    case 'chicken':
      finalF = F + Math.round(P * 0.12);
      break;
    case 'turkey':
      finalF = F + Math.round(P * 0.08);
      break;
    case 'fish':
      finalF = F + Math.round(P * 0.10);
      break;
    case 'beef':
      finalF = F + Math.round(P * 0.25);
      break;
    case 'rice':
      finalP = P + Math.round(C * 0.05);
      break;
    case 'oats':
      finalP = P + Math.round(C * 0.20);
      finalF = F + Math.round(C * 0.12);
      break;
    case 'veggies':
      finalP = P + Math.round(C * 0.15);
      break;
    case 'oil':
      break;
  }

  const calories = Math.round((finalP * 4) + (finalC * 4) + (finalF * 9));

  return {
    protein: finalP,
    carbs: finalC,
    fat: finalF,
    calories,
  };
}

export function getProfileById(id: MacroProfile): MacroProfileInfo | undefined {
  return MACRO_PROFILES.find(p => p.id === id);
}
