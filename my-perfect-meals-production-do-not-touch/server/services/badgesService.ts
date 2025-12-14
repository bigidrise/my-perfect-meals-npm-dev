export type Profile = {
  allergies?: string[];                // ['peanuts','shellfish',...]
  conditions?: string[];               // ['type-1-diabetes','crohns',...]
  lowGICarbsPreferred?: boolean;
};

export type Recipe = {
  ingredients: Array<{ name: string }>;
  nutrition?: { sugar?: number; fiber?: number; carbs?: number };
  tags?: string[]; // e.g., ['gluten-free','dairy-free']
};

export type BadgeItem = { 
  key: string; 
  label: string; 
  description: string; 
};

export function computeMedicalBadges(profile: Profile, recipe: Recipe): BadgeItem[] {
  const badges: BadgeItem[] = [];
  const has = (tag:string)=> recipe.tags?.includes(tag);

  // Allergens
  const allergens = (profile.allergies||[]).map(a=>a.toLowerCase());
  const containsAllergen = recipe.ingredients.some(i =>
    allergens.some(a => i.name.toLowerCase().includes(a))
  );
  if (!containsAllergen && allergens.length) {
    badges.push({ key:'allergy-safe', label:'Allergy-Safe', description:'Excludes your listed allergens.'});
  }

  // Diabetes friendliness (simple heuristic – you likely already have something better)
  const sugar = recipe.nutrition?.sugar ?? 0;
  const carbs = recipe.nutrition?.carbs ?? 0;
  if (profile.conditions?.includes('type-1-diabetes') || profile.conditions?.includes('type-2-diabetes')) {
    if (sugar <= 8 && carbs <= 45) {
      badges.push({ key:'t1d-friendly', label:'Diabetes-Friendly', description:'Lower sugar and moderate carbs.'});
    } else {
      badges.push({ key:'carb-caution', label:'Carb Caution', description:'Higher sugar or carbs—monitor portion/insulin.'});
    }
  }

  // Low-GI preference
  if (profile.lowGICarbsPreferred) {
    if (has('low-gi') || (carbs <= 40 && sugar <= 8)) {
      badges.push({ key:'low-gi', label:'Low‑GI Choice', description:'Carbs lean lower glycemic.'});
    }
  }

  // Common dietary flags from tags
  if (has('gluten-free')) badges.push({ key:'gluten-free', label:'Gluten‑Free', description:'Contains no gluten ingredients.'});
  if (has('dairy-free'))  badges.push({ key:'dairy-free',  label:'Dairy‑Free',  description:'Contains no dairy ingredients.'});
  if (has('nut-free'))    badges.push({ key:'nut-free',    label:'Nut‑Free',    description:'Contains no nuts.'});

  // Crohn's (simple: avoid trigger tags)
  if (profile.conditions?.includes('crohns')) {
    if (!has('high-fat') && !has('very-spicy')) {
      badges.push({ key:'crohns-considerate', label:'Crohns-Considerate', description:'Avoids common trigger tags.'});
    }
  }

  return badges;
}