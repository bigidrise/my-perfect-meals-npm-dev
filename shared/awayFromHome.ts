/**
 * Meals Away From Home — Shared Domain Model
 *
 * Phase 0: Core type contracts for the entire Meals Away From Home platform.
 * Every backend service and frontend component that touches restaurant
 * recommendations, fast food, meal finder, or buffet plates speaks this language.
 *
 * Pipeline:
 *   Restaurant / Buffet input
 *     → RestaurantIdentity (normalization)
 *     → MenuResolutionResult (menu retrieval)
 *     → AI reasoning over NormalizedMenuItem[]
 *     → AwayFromHomeRecommendation (single shared model)
 *     → AwayFromHomeMealCard (single shared UI component)
 */

// ── Menu Source ─────────────────────────────────────────────────────────────

/**
 * Where the menu data came from.
 * New providers (OCR, PDF upload, website parser) add a new literal here —
 * no other architecture changes required.
 */
export type MenuSource =
  | "internal_canonical"   // JSON file in server/data/chainMenus/
  | "licensed_api"         // Third-party menu/nutrition API (e.g., Nutritionix)
  | "ocr"                  // Camera → OCR → extracted menu text
  | "pdf_upload"           // User-uploaded PDF menu
  | "website_parser"       // Scraped/parsed restaurant website
  | "user_description"     // User described the food (Just Describe It / buffet)
  | "unavailable";         // No verified source found

// ── Nutrition Confidence ────────────────────────────────────────────────────

/**
 * How reliable are the nutrition values on a recommendation card.
 * The card uses this to auto-select the correct disclosure text.
 *
 * official  — Chain-published nutrition for a defined item and serving size.
 *             Display values without "approximately". One compact disclosure.
 * estimated — AI-estimated (buffet, unverified restaurant, Just Describe It).
 *             Label each macro "Estimated". Values must be editable before logging.
 * mixed     — Published base item + user-requested substitutions or unknown mods.
 *             Disclose that modifications affect the original published values.
 */
export type NutritionDataStatus = "official" | "estimated" | "mixed";

// ── Restaurant Identity ──────────────────────────────────────────────────────

/**
 * Normalized identity for a restaurant or chain.
 * Produced by the chain normalization layer before menu retrieval.
 */
export interface RestaurantIdentity {
  /** Stable internal key used in registries, filenames, and routes. */
  brandSlug: string;
  /** Display name shown to users. */
  displayName: string;
  /**
   * Name patterns used for text-matching (all lowercase).
   * Add common misspellings, abbreviations, and alternate spellings.
   */
  aliases: string[];
  /** True when this is a franchise/chain with consistent menus. */
  isChain: boolean;
  /** True when the chain has 100+ locations in the detected country. */
  isNationalChain: boolean;
  /** Cuisine archetype ID that maps to the existing archetype system. */
  cuisineType: string;
  /**
   * ISO 3166-1 alpha-2 country codes where menu data is available.
   * Used to prevent showing US chain menus to users in other countries.
   */
  availableInCountries: string[];
  /** Which providers can supply verified menu data for this restaurant. */
  availableMenuSources: MenuSource[];
  /**
   * How the menu data was obtained. Omit when no menu data is available yet.
   *
   * official_website       — Hand-curated from the chain's own published nutrition page.
   *                          Macros are chain-official, not estimated.
   * licensed_api           — Sourced via a paid/licensed nutrition API (e.g., Nutritionix).
   * partner_feed           — Received from a partner integration or data agreement.
   * ocr_scan               — Extracted from a photographed menu; values may vary by item.
   * user_uploaded          — User-uploaded PDF or image menu; values unverified.
   * hand_curated_estimated — Hand-entered without an official source; values are estimates.
   */
  dataOrigin?: "official_website" | "licensed_api" | "partner_feed" | "ocr_scan" | "user_uploaded" | "hand_curated_estimated";
  /**
   * Canonical URL for this brand's official nutrition/allergen information.
   * Used by the staleness checker and data-update workflow.
   */
  sourceUrl?: string;
  /**
   * ISO-8601 date string (YYYY-MM-DD) when the menu dataset was last verified
   * against the source. Required when dataOrigin is "official_website".
   * Used by MenuFreshnessService to flag aging or stale datasets.
   */
  verifiedAt?: string;
  /**
   * Optional version tag, revision, or API snapshot ID for this dataset.
   * Increment whenever items are added, removed, or nutrition values corrected.
   * Examples: "v1.0", "2025-Q1", "nutritionix-snapshot-2025-01"
   */
  sourceVersion?: string;
  /**
   * Who verified this menu data. Useful when partner-maintained menus or
   * an internal nutrition review team are introduced.
   * Examples: "MyPerfectMeals", "Nutritionix", "PartnerChainName"
   */
  verifiedBy?: string;
  /**
   * How this dataset gets refreshed.
   *
   * manual    — Human review required to update (official JSON, OCR scans).
   * scheduled — Automated re-import on a fixed schedule (future cron job).
   * provider  — Provider refreshes data on their side (licensed API, partner feed).
   */
  refreshPolicy?: "manual" | "scheduled" | "provider";
}

// ── Normalized Menu Item ─────────────────────────────────────────────────────

/**
 * Canonical item schema shared by all menu providers.
 * All providers (internal JSON, licensed API, OCR) normalize into this shape
 * before the AI reasoning layer receives them.
 */
export interface NormalizedMenuItem {
  /** Globally unique within the system: "{brandSlug}_{item_key}" */
  id: string;
  brandSlug: string;
  name: string;
  description?: string;
  /** Grouping within the menu (e.g., "burgers", "salads", "breakfast"). */
  category: string;
  /** Human-readable serving description (e.g., "1 sandwich (213g)"). */
  servingSize?: string;

  // ── Macros (all required for verified items) ─────────────────────────────
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;

  // ── Extended nutrition (available from official sources) ─────────────────
  saturatedFatGrams?: number;
  sodiumMg?: number;
  fiberGrams?: number;
  sugarGrams?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;

  // ── Dietary flags ────────────────────────────────────────────────────────
  isVegetarian?: boolean;
  isVegan?: boolean;
  /** Gluten-free as prepared (not cross-contamination safe). */
  isGlutenFree?: boolean;

  /**
   * Known allergens present in this item.
   * Use standard labels: "milk", "eggs", "fish", "shellfish", "tree nuts",
   * "peanuts", "wheat", "soybeans", "sesame".
   */
  allergens?: string[];

  /**
   * Common modifications available for this item.
   * Used by the AI to suggest realistic customizations.
   * Examples: ["no bun", "grilled instead of fried", "dressing on the side"]
   */
  customizationOptions?: string[];

  // ── Availability ─────────────────────────────────────────────────────────
  availability?: {
    breakfastOnly?: boolean;
    lunchDinnerOnly?: boolean;
    limitedTime?: boolean;
    regional?: boolean;
    seasonal?: boolean;
  };

  // ── Provenance ───────────────────────────────────────────────────────────
  source: MenuSource;
  /**
   * ISO date string (YYYY-MM-DD) when this item's nutrition was last
   * confirmed against an official source. Drives staleness warnings.
   */
  lastVerifiedAt: string;
}

// ── Menu Resolution Result ───────────────────────────────────────────────────

/**
 * Discriminated union returned by the menu resolution step.
 *
 * ok         — verified menu items are available; pass to AI reasoning layer
 * unavailable — no verified source found; surface alternatives to user, NEVER invent
 */
export type MenuResolutionResult =
  | {
      status: "ok";
      identity: RestaurantIdentity;
      items: NormalizedMenuItem[];
      source: MenuSource;
      /** ISO date of the newest item's lastVerifiedAt */
      menuLastVerifiedAt: string;
    }
  | {
      status: "unavailable";
      /**
       * Partial identity still populated for display purposes
       * (we know the restaurant name and cuisine even if we have no menu).
       */
      partialIdentity?: Partial<RestaurantIdentity>;
      reason: "no_registry_match" | "no_menu_provider" | "provider_error" | "international_chain";
      /**
       * Features the user can fall back to when no verified menu is available.
       */
      alternatives: Array<
        | "just_describe_it"
        | "my_perfect_buffet"
        | "paste_menu_text"
      >;
    };

// ── Medical Badge ────────────────────────────────────────────────────────────

export interface MedicalBadge {
  condition: string;
  compatible: boolean;
  reason: string;
  /** Tailwind color token for the badge background. */
  color: string;
}

// ── Away From Home Recommendation ────────────────────────────────────────────

/**
 * The single shared model that every away-from-home feature produces
 * before reaching the UI. The AwayFromHomeMealCard renders only this shape.
 *
 * Restaurant Guide, Fast Food Guide, Find Meals Near Me, and My Perfect Buffet
 * each produce their own internal data, then map it into AwayFromHomeRecommendation
 * before returning results to the client.
 */
export interface AwayFromHomeRecommendation {
  id: string;

  /** Which feature generated this recommendation. */
  source: "restaurant_guide" | "fast_food_guide" | "meal_finder" | "buffet";

  // ── Venue ─────────────────────────────────────────────────────────────────
  restaurantName: string;
  restaurantAddress?: string;
  restaurantCuisine?: string;
  restaurantRating?: number;
  restaurantPhotoUrl?: string;
  /** How closely this restaurant matches the user's craving or dietary needs. */
  matchLabel?: "Exact match" | "Matches your diet" | "Limited match";

  // ── Nutrition confidence ──────────────────────────────────────────────────
  nutritionStatus: NutritionDataStatus;
  /**
   * Auto-generated disclosure text based on nutritionStatus.
   * The card uses this verbatim — no per-feature wording.
   *
   * official: "Based on published nutrition. May vary by location, customization, or preparation."
   * estimated: "Estimates are based on typical preparation and serving size."
   * mixed: "Based on published nutrition with requested modifications applied."
   */
  menuSourceDisclosure?: string;

  // ── Meal / Plate ──────────────────────────────────────────────────────────
  meal: {
    name: string;
    description?: string;
    category?: string;
    imageUrl?: string;

    // Integer values — the primary display numbers
    calories?: number;
    proteinGrams?: number;
    carbohydrateGrams?: number;
    fatGrams?: number;

    /**
     * Carbohydrate breakdown — null means unknown, not zero.
     * fibrousCarbs is derived server-side from fiberGrams (= fiberGrams).
     * AI supplies totalCarbohydrateGrams, fiberGrams, starchyCarbGrams.
     */
    fiberGrams?: number | null;
    starchyCarbGrams?: number | null;
    fibrousCarbGrams?: number | null;

    /**
     * Range values for estimated nutrition (buffet / unverified).
     * The card displays the estimate value; range is kept for the
     * confirmation sheet so the user understands the uncertainty.
     */
    caloriesRange?: { low: number; high: number };
    proteinRange?: { low: number; high: number };
    carbsRange?: { low: number; high: number };
    fatRange?: { low: number; high: number };

    ingredients?: string[];
  };

  // ── Recommendation intelligence ───────────────────────────────────────────
  recommendation: {
    /** Why this meal fits the user's profile ("why this is healthy"). */
    reason?: string;
    /** General modification note displayed in a compact block. */
    modifications?: string;
    /**
     * Structured ordering instructions for the server/staff.
     * askFor: the item to request by name
     * modify: changes to make ("grilled not fried", "dressing on the side")
     * swap: component substitutions ("fries → side salad")
     */
    howToOrder?: {
      askFor: string;
      modify: string[];
      swap: string[];
    };
    /**
     * A complete, natural-language sentence the user can read to their server.
     * Medical conditions drive this field — see restaurantMealGeneratorAI.ts.
     */
    medicalWaiterScript?: string;
    portionGuidance?: string;
    optionalAdjustments?: string[];
    cautionNotes?: string[];
  };

  // ── Protocol alignment ────────────────────────────────────────────────────
  protocol: {
    badges?: MedicalBadge[];
    alignmentSummary?: string;
  };

  // ── Buffet-specific ───────────────────────────────────────────────────────
  /**
   * Present when source === "buffet".
   * The individual plates and portions that make up the recommendation.
   */
  buffetItems?: Array<{
    food: string;
    portion: string;
    note?: string;
  }>;
}

// ── Disclosure text helpers ──────────────────────────────────────────────────

export const NUTRITION_DISCLOSURE: Record<NutritionDataStatus, string> = {
  official:
    "Based on published nutrition. May vary by location, customization, or preparation.",
  estimated:
    "Estimates are based on typical preparation and serving size.",
  mixed:
    "Based on published nutrition with requested modifications applied.",
};

export function getNutritionDisclosure(status: NutritionDataStatus): string {
  return NUTRITION_DISCLOSURE[status];
}
