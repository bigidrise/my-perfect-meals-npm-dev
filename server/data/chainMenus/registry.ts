/**
 * Restaurant Brand Registry
 *
 * The single source of truth for which restaurant brands have verified menu
 * data and where to find it. Designed to scale to hundreds of chains without
 * architecture changes.
 *
 * Adding a new chain:
 *   1. Create server/data/chainMenus/{brandSlug}.json with NormalizedMenuItem[]
 *   2. Add an entry to BRAND_REGISTRY below
 *   3. No other changes needed — the menu intelligence service picks it up automatically
 *
 * Provider interface:
 *   Currently only "internal_canonical" (local JSON) is implemented.
 *   Future providers (licensed_api, ocr, pdf_upload) implement the same
 *   MenuProvider interface and register alongside the JSON loader.
 */

import type { RestaurantIdentity, MenuSource } from "@shared/awayFromHome";

export interface BrandRegistryEntry {
  identity: RestaurantIdentity;
  /** Relative path from this file to the canonical menu JSON. */
  menuFile?: string;
  /** Future: API provider config when source is licensed_api. */
  apiProvider?: string;
}

/**
 * Name normalization helper.
 * Converts any user-typed restaurant name into a lowercase slug
 * suitable for matching against alias lists.
 */
export function normalizeInputName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[''`]/g, "")     // strip apostrophes
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

export const BRAND_REGISTRY: BrandRegistryEntry[] = [
  // ── McDonald's ────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "mcdonalds",
      displayName: "McDonald's",
      aliases: ["mcdonalds", "mcdonald", "mcd", "mickey ds", "mickey d", "mcds", "golden arches"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_food_burger",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "mcdonalds.json",
  },

  // ── Wendy's ───────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "wendys",
      displayName: "Wendy's",
      aliases: ["wendys", "wendy", "wendies"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_food_burger",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "wendys.json",
  },

  // ── Burger King ───────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "burgerking",
      displayName: "Burger King",
      aliases: ["burger king", "burgerking", "bk", "the king"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_food_burger",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "burgerking.json",
  },

  // ── Chick-fil-A ───────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "chickfila",
      displayName: "Chick-fil-A",
      aliases: ["chick fil a", "chick-fil-a", "chickfila", "cfa", "chick fila"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_food_chicken",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "chickfila.json",
  },

  // ── Taco Bell ─────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "tacobell",
      displayName: "Taco Bell",
      aliases: ["taco bell", "tacobell", "tb", "the bell"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_food_mexican",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "tacobell.json",
  },

  // ── Subway ────────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "subway",
      displayName: "Subway",
      aliases: ["subway", "sub way", "subways"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "sandwich",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "subway.json",
  },

  // ── Chipotle ──────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "chipotle",
      displayName: "Chipotle",
      aliases: ["chipotle", "chipotle mexican grill"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_casual_mexican",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "chipotle.json",
  },

  // ── Panda Express ─────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "pandaexpress",
      displayName: "Panda Express",
      aliases: ["panda express", "pandaexpress", "panda", "panda express restaurant"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_casual_chinese",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "pandaexpress.json",
  },

  // ── Panera Bread ──────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "panerabread",
      displayName: "Panera Bread",
      aliases: ["panera bread", "panerabread", "panera", "st. louis bread"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "fast_casual_american",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "panerabread.json",
  },

  // ── Starbucks ─────────────────────────────────────────────────────────────
  {
    identity: {
      brandSlug: "starbucks",
      displayName: "Starbucks",
      aliases: ["starbucks", "sbux", "starbucks coffee"],
      isChain: true,
      isNationalChain: true,
      cuisineType: "cafe",
      availableInCountries: ["US"],
      availableMenuSources: ["internal_canonical"],
    },
    menuFile: "starbucks.json",
  },
];

/**
 * Attempt to match a user-typed restaurant name to a registered brand.
 * Returns the matching entry or undefined if no match.
 *
 * Matching is alias-based (not Google Places ID) so it works for both
 * user-typed input and Google Places resolved names.
 */
export function findBrandByName(restaurantName: string): BrandRegistryEntry | undefined {
  const normalized = normalizeInputName(restaurantName);

  return BRAND_REGISTRY.find((entry) =>
    entry.identity.aliases.some((alias) => {
      // Exact match
      if (normalized === alias) return true;
      // Contains match (e.g., "McDonald's on Main St" still matches "mcdonalds")
      if (normalized.includes(alias)) return true;
      if (alias.includes(normalized)) return true;
      return false;
    })
  );
}

/**
 * Lookup by brand slug directly (used when the caller already resolved the slug).
 */
export function findBrandBySlug(brandSlug: string): BrandRegistryEntry | undefined {
  return BRAND_REGISTRY.find((e) => e.identity.brandSlug === brandSlug);
}
