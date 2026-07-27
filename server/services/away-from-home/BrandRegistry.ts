/**
 * Brand Registry
 *
 * Maps raw restaurant names (user-typed or Google Places resolved) to
 * normalized RestaurantIdentity objects.
 *
 * This registry knows WHO a restaurant is.
 * It does not know what is on their menu — that is the MenuProvider's job.
 *
 * Adding a new brand:
 *   Add one entry to REGISTRY below.
 *   No other changes needed anywhere in the system.
 */

import type { RestaurantIdentity } from "@shared/awayFromHome";

// ── Name normalization ────────────────────────────────────────────────────────

/**
 * Normalize a raw restaurant name for alias matching.
 * Strips apostrophes, punctuation, and extra whitespace so
 * "Wendy's", "Wendys", and "WENDYS" all match the same entry.
 */
export function normalizeRestaurantName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Registry entries ─────────────────────────────────────────────────────────

const REGISTRY: RestaurantIdentity[] = [
  // ── Wendy's ── (proof-of-concept brand; first to be fully wired)
  {
    brandSlug: "wendys",
    displayName: "Wendy's",
    aliases: ["wendys", "wendy", "wendies"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_food_burger",
    availableInCountries: ["US"],
    availableMenuSources: ["internal_canonical"],
  },

  // ── McDonald's ── (registered, menu file not yet seeded)
  {
    brandSlug: "mcdonalds",
    displayName: "McDonald's",
    aliases: ["mcdonalds", "mcdonald", "mcd", "mickey ds", "mickey d", "mcds", "golden arches"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_food_burger",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Burger King ── (registered, menu not yet seeded)
  {
    brandSlug: "burgerking",
    displayName: "Burger King",
    aliases: ["burger king", "burgerking", "bk", "the king"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_food_burger",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Chick-fil-A ── (registered, menu not yet seeded)
  {
    brandSlug: "chickfila",
    displayName: "Chick-fil-A",
    aliases: ["chick fil a", "chick-fil-a", "chickfila", "cfa", "chick fila"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_food_chicken",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Taco Bell ── (registered, menu not yet seeded)
  {
    brandSlug: "tacobell",
    displayName: "Taco Bell",
    aliases: ["taco bell", "tacobell", "tb", "the bell"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_food_mexican",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Subway ── (registered, menu not yet seeded)
  {
    brandSlug: "subway",
    displayName: "Subway",
    aliases: ["subway", "sub way", "subways"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "sandwich",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Chipotle ── (registered, menu not yet seeded)
  {
    brandSlug: "chipotle",
    displayName: "Chipotle",
    aliases: ["chipotle", "chipotle mexican grill"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_casual_mexican",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Panda Express ── (registered, menu not yet seeded)
  {
    brandSlug: "pandaexpress",
    displayName: "Panda Express",
    aliases: ["panda express", "pandaexpress", "panda"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_casual_chinese",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Panera Bread ── (registered, menu not yet seeded)
  {
    brandSlug: "panerabread",
    displayName: "Panera Bread",
    aliases: ["panera bread", "panerabread", "panera", "st. louis bread"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "fast_casual_american",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },

  // ── Starbucks ── (registered, menu not yet seeded)
  {
    brandSlug: "starbucks",
    displayName: "Starbucks",
    aliases: ["starbucks", "sbux", "starbucks coffee"],
    isChain: true,
    isNationalChain: true,
    cuisineType: "cafe",
    availableInCountries: ["US"],
    availableMenuSources: [],
  },
];

// ── Lookup functions ──────────────────────────────────────────────────────────

/**
 * Attempt to match a raw restaurant name to a registered brand.
 * Uses alias matching so "Wendy's on Main St" still matches "wendys".
 * Returns undefined for independent / unregistered restaurants.
 */
export function findBrandByName(
  restaurantName: string
): RestaurantIdentity | undefined {
  const normalized = normalizeRestaurantName(restaurantName);

  return REGISTRY.find((identity) =>
    identity.aliases.some((alias) => {
      if (normalized === alias) return true;
      if (normalized.includes(alias)) return true;
      if (alias.includes(normalized)) return true;
      return false;
    })
  );
}

/** Look up by stable brand slug. */
export function findBrandBySlug(
  brandSlug: string
): RestaurantIdentity | undefined {
  return REGISTRY.find((r) => r.brandSlug === brandSlug);
}

/** All registered brands — used by health checks and admin tools. */
export function getAllBrands(): RestaurantIdentity[] {
  return REGISTRY;
}

/** How many brands currently have at least one menu source available. */
export function getBrandsWithMenuCoverage(): RestaurantIdentity[] {
  return REGISTRY.filter((r) => r.availableMenuSources.length > 0);
}
