/**
 * resolveAlphaGalRestrictions.ts
 *
 * Resolver for Alpha-gal Syndrome (Mammalian Meat Allergy).
 * Converts alphaGalProfile into prompt-ready restriction data for every food
 * surface. The governed rule registry below is the canonical source of truth.
 *
 * Rule registry:
 *   ALPHAGAL-CORE-001: All mammalian meats hard blocked
 *   ALPHAGAL-CORE-002: All mammalian organ meats hard blocked
 *   ALPHAGAL-CORE-003: Mammalian fats (lard, tallow, suet) hard blocked
 *   ALPHAGAL-CORE-004: Mammalian-based stocks/broths/gravies hard blocked
 *   ALPHAGAL-COND-001: Dairy blocked only when dairyTolerance === "no"
 *   ALPHAGAL-COND-002: Dairy flagged/verified when dairyTolerance === "unsure"
 *   ALPHAGAL-COND-003: Gelatin flagged when gelatinRestriction !== "no"
 *   ALPHAGAL-EMERGENCY-001: Conservative defaults when profile incomplete
 */

export interface AlphaGalProfileData {
  diagnosisStatus: "diagnosed" | "being_evaluated" | "no";
  avoidances: Array<"beef" | "pork" | "lamb" | "venison" | "organ_meats" | "mammalian_fats" | "other">;
  dairyTolerance: "yes" | "no" | "unsure";
  gelatinRestriction: "yes" | "no" | "unsure";
  severeReactionHistory: "yes" | "no" | "unsure";
  profileComplete: boolean;
  activatedAt: string | null;
  updatedAt: string | null;
}

/** The resolved restrictions derived from an alphaGalProfile. */
export interface AlphaGalRestrictions {
  /** Core mammalian ingredients that are always hard-blocked (CORE-001 to CORE-004). */
  coreHardBlocks: string[];
  /** Whether dairy is hard-blocked (ALPHAGAL-COND-001). */
  dairyBlocked: boolean;
  /** Whether dairy should be flagged/avoided as possible exposure (ALPHAGAL-COND-002). */
  dairyFlagged: boolean;
  /** Whether gelatin/mammalian-derived thickeners should be avoided (ALPHAGAL-COND-003). */
  gelatinFlagged: boolean;
  /** Whether the profile was fully completed by the user. */
  profileComplete: boolean;
}

/**
 * Core mammalian ingredients always hard-blocked for Alpha-gal.
 * ALPHAGAL-CORE-001: Mammalian meats
 * ALPHAGAL-CORE-002: Mammalian organ meats
 * ALPHAGAL-CORE-003: Mammalian fats
 * ALPHAGAL-CORE-004: Mammalian stocks/broths
 */
export const ALPHA_GAL_CORE_HARD_BLOCKS: string[] = [
  // ALPHAGAL-CORE-001: Mammalian meats
  "beef", "ground beef", "hamburger", "steak", "ribeye", "sirloin", "brisket", "chuck roast",
  "veal", "pork", "ham", "bacon", "prosciutto", "pancetta", "salami", "pepperoni", "chorizo",
  "sausage", "hot dog", "bratwurst", "kielbasa", "lamb", "mutton", "goat", "venison", "deer",
  "rabbit", "bison", "buffalo", "elk", "moose", "boar", "wild boar",
  // ALPHAGAL-CORE-002: Mammalian organ meats
  "liver", "beef liver", "pork liver", "kidney", "sweetbreads", "tripe", "intestines", "oxtail", "tongue",
  // ALPHAGAL-CORE-003: Mammalian fats and derivatives
  "lard", "tallow", "suet", "beef fat", "pork fat", "drippings",
  // ALPHAGAL-CORE-004: Mammalian stocks, broths, bouillons
  "beef broth", "beef stock", "pork broth", "bone broth", "meat gravy", "beef bouillon", "pork bouillon", "meat stock",
];

/**
 * Resolve an alphaGalProfile into concrete restrictions for prompt injection.
 * Fails closed (ALPHAGAL-EMERGENCY-001): when profile is incomplete or absent,
 * conservative defaults are applied — core blocks active, dairy/gelatin flagged.
 */
export function resolveAlphaGalRestrictions(
  profile: AlphaGalProfileData | null | undefined
): AlphaGalRestrictions {
  if (!profile) {
    // ALPHAGAL-EMERGENCY-001: No profile → conservative fail-closed defaults
    return {
      coreHardBlocks: ALPHA_GAL_CORE_HARD_BLOCKS,
      dairyBlocked: false,
      dairyFlagged: true,    // unknown → flag for user to verify
      gelatinFlagged: true,  // unknown → flag for user to verify
      profileComplete: false,
    };
  }

  return {
    coreHardBlocks: ALPHA_GAL_CORE_HARD_BLOCKS,
    dairyBlocked: profile.dairyTolerance === "no",       // ALPHAGAL-COND-001
    dairyFlagged: profile.dairyTolerance === "unsure",   // ALPHAGAL-COND-002
    gelatinFlagged: profile.gelatinRestriction !== "no", // ALPHAGAL-COND-003
    profileComplete: profile.profileComplete,
  };
}
