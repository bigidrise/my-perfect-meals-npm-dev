/**
 * getDietBadges — single source of truth for dietary identity badges.
 *
 * Priority order (Tier 0 first):
 *   1. Dietary Identity  (Kosher, Halal, Vegan, Vegetarian, Pescatarian, …)
 *   2. Allergy / Safety
 *   3. Medical
 *   4. Preferences / Style
 *
 * Every UI surface must pull from this function — never implement inline badge logic.
 */

export interface DietBadgeEntry {
  key: string;
  label: string;
  color: string;
  tier: 0 | 1 | 2 | 3;
}

const IDENTITY_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  kosher:        { label: "Kosher ✓",        color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  halal:         { label: "Halal ✓",          color: "bg-teal-500/20 border-teal-400/40 text-teal-300" },
  vegan:         { label: "Vegan ✓",          color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:    { label: "Vegetarian ✓",     color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:   { label: "Pescatarian ✓",    color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean: { label: "Mediterranean ✓",  color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:         { label: "Paleo ✓",          color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  keto:          { label: "Keto ✓",           color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  "gluten-free": { label: "Gluten-Free ✓",   color: "bg-yellow-500/20 border-yellow-400/40 text-yellow-300" },
  "dairy-free":  { label: "Dairy-Free ✓",    color: "bg-cyan-500/20 border-cyan-400/40 text-cyan-300" },
  custom:        { label: "Custom Diet ✓",    color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

const IDENTITY_TIER_0 = new Set([
  "kosher", "halal", "vegan", "vegetarian", "pescatarian",
]);

const SKIP = new Set(["no-restriction", "no_restriction", "none", "omnivore", ""]);

/**
 * Returns a priority-ordered list of badge entries for a meal.
 *
 * @param serverBadges - The `medicalBadges` array from the server-validated meal.
 *                       When provided (even if []), this is the authority.
 *                       Pass undefined/null only for legacy meals with no server context.
 * @param userRestrictions - The user's dietaryRestrictions array from profile.
 * @param userDietType - The user's dietType string from profile.
 */
export function getDietBadges(
  serverBadges: string[] | null | undefined,
  userRestrictions: string[] = [],
  userDietType: string = "",
): DietBadgeEntry[] {
  let keys: string[];

  if (serverBadges != null) {
    keys = serverBadges
      .map((b) => b.toLowerCase().trim())
      .filter((b) => !SKIP.has(b) && IDENTITY_BADGE_CONFIG[b]);
  } else {
    const combined = [
      ...userRestrictions,
      ...(userDietType ? [userDietType] : []),
    ]
      .map((r) => r.toLowerCase().trim())
      .filter((r) => !SKIP.has(r) && IDENTITY_BADGE_CONFIG[r]);
    keys = [...new Set(combined)];
  }

  const entries: DietBadgeEntry[] = keys.map((key) => {
    const config = IDENTITY_BADGE_CONFIG[key];
    return {
      key,
      label: config.label,
      color: config.color,
      tier: IDENTITY_TIER_0.has(key) ? 0 : 3,
    };
  });

  entries.sort((a, b) => a.tier - b.tier);
  return entries;
}

/**
 * Returns whether a given diet string is a dietary identity protocol
 * (as opposed to a style preference like keto or mediterranean).
 */
export function isDietaryIdentity(diet: string): boolean {
  return IDENTITY_TIER_0.has(diet.toLowerCase().trim());
}

/**
 * Returns a human-readable description of the dietary identity protocol,
 * used for empty state messaging and search context labeling.
 */
export function getDietIdentityLabel(diet: string): string {
  const map: Record<string, string> = {
    kosher:      "kosher",
    halal:       "halal",
    vegan:       "vegan",
    vegetarian:  "vegetarian",
    pescatarian: "pescatarian",
    keto:        "keto",
    paleo:       "paleo",
    mediterranean: "mediterranean",
  };
  return map[diet.toLowerCase().trim()] ?? diet;
}
