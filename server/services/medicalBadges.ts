import { ResolvedConstraints } from '../../shared/types/profile';

// ── Alpha-gal Syndrome badge ──────────────────────────────────────────────────
export interface AlphaGalBadge {
  condition: "Alpha-gal";
  status: "protected" | "verify" | "incompatible";
  color: "green" | "yellow" | "red";
  label: string;
  reason: string;
}

const ALPHA_GAL_CONDITION_KEYS = [
  "alpha-gal-syndrome", "alpha-gal syndrome", "alpha gal syndrome", "alpha-gal", "alpha gal",
];
const ALPHA_GAL_BLOCKED = [
  "beef", "steak", "pork", "bacon", "ham", "lamb", "veal", "venison", "bison",
  "hamburger", "burger", "meatball", "short rib", "ribeye", "sirloin",
  "tenderloin", "prime rib", "t-bone", "ground beef", "lard", "tallow", "suet",
  "carnitas", "chorizo", "salami", "pepperoni", "prosciutto", "pancetta",
];
const ALPHA_GAL_VERIFY = [
  "broth", "stock", "gravy", "au jus", "demi-glace", "consommé", "bisque",
  "sauce", "worcestershire", "gelatin", "risotto", "stew", "soup",
];

/**
 * Evaluates a generated meal against Alpha-gal Syndrome restrictions.
 * Returns null when alpha-gal is not active for this user.
 * Pass either conditions[] (checks activation) or isActive=true (skip activation check).
 */
export function computeAlphaGalBadge(
  mealText: string,
  ingredients: string[],
  conditionsOrActive: string[] | boolean
): AlphaGalBadge | null {
  const isActive =
    typeof conditionsOrActive === "boolean"
      ? conditionsOrActive
      : conditionsOrActive.some(c =>
          ALPHA_GAL_CONDITION_KEYS.includes(c.trim().toLowerCase())
        );
  if (!isActive) return null;

  const all = `${mealText} ${ingredients.join(" ")}`.toLowerCase();
  const isBlocked = ALPHA_GAL_BLOCKED.some(t => all.includes(t));
  const needsVerify = !isBlocked && ALPHA_GAL_VERIFY.some(t => all.includes(t));

  if (isBlocked) {
    return {
      condition: "Alpha-gal",
      status: "incompatible",
      color: "red",
      label: "🚫 Not Compatible",
      reason: "Contains mammalian meat or fat — not safe for Alpha-gal Syndrome.",
    };
  }
  if (needsVerify) {
    return {
      condition: "Alpha-gal",
      status: "verify",
      color: "yellow",
      label: "⚠ Verify Source",
      reason: "May contain mammalian-sourced broth, stock, or sauce — confirm ingredients before eating.",
    };
  }
  return {
    condition: "Alpha-gal",
    status: "protected",
    color: "green",
    label: "🛡 Alpha-gal Protected",
    reason: "No mammalian meat or fat detected. This meal passed Alpha-gal restrictions.",
  };
}

export type MedicalBadge =
  | 'type1_safe' | 'type2_safe' | 'gluten_free' | 'dairy_free'
  | 'low_glycemic' | 'shellfish_free' | 'peanut_free' | 'nut_free' | 'soy_free';

export function computeMedicalBadges(constraints: ResolvedConstraints, ingredients: string[]): MedicalBadge[] {
  const set = new Set<MedicalBadge>();

  const names = ingredients.map(s => s.toLowerCase());
  const has = (kw: string) => names.some(n => n.includes(kw));

  const NUT_BUTTER_RE = /\b(peanut|almond|cashew|sunflower|apple|pumpkin)[\s-]*butter\b/;
  const hasDairyButter = names.some(n => {
    if (NUT_BUTTER_RE.test(n)) return false;
    return n.includes('butter');
  });

  const NON_DAIRY_MILK_RE = /\b(almond|oat|soy|coconut|cashew|pea)[\s-]*milk\b/;
  const hasDairyMilk = names.some(n => {
    if (NON_DAIRY_MILK_RE.test(n)) return false;
    return n.includes('milk');
  });

  // Allergens
  if (!has('gluten') && !has('wheat')) set.add('gluten_free');
  if (!hasDairyMilk && !has('cheese') && !hasDairyButter && !has('cream')) set.add('dairy_free');
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
