import { ResolvedConstraints } from '../../shared/types/profile';

export type MedicalBadge =
  | 'type1_safe' | 'type2_safe' | 'gluten_free' | 'dairy_free'
  | 'low_glycemic' | 'shellfish_free' | 'peanut_free' | 'nut_free' | 'soy_free';

export function computeMedicalBadges(constraints: ResolvedConstraints, ingredients: string[]): MedicalBadge[] {
  const set = new Set<MedicalBadge>();

  const names = ingredients.map(s => s.toLowerCase());
  const has = (kw: string) => names.some(n => n.includes(kw));

  // Allergens
  if (!has('gluten') && !has('wheat')) set.add('gluten_free');
  if (!has('milk') && !has('cheese') && !has('butter') && !has('cream')) set.add('dairy_free');
  if (!has('shellfish') && !has('shrimp') && !has('crab') && !has('lobster')) set.add('shellfish_free');
  if (!has('peanut')) set.add('peanut_free');
  if (!has('almond') && !has('walnut') && !has('pecan') && !has('cashew') && !has('hazelnut')) set.add('nut_free');
  if (!has('soy')) set.add('soy_free');

  // Conditions
  if (constraints.lowGlycemicMode) set.add('low_glycemic');
  if (constraints.conditions.includes('type1_diabetes')) set.add('type1_safe');
  if (constraints.conditions.includes('type2_diabetes')) set.add('type2_safe');

  return Array.from(set);
}
