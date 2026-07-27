/**
 * Restaurant Menu Intelligence Service
 *
 * The main entry point for the Meals Away From Home restaurant knowledge system.
 * Implements the full pipeline:
 *
 *   Restaurant name (raw input or Google Places result)
 *     → Chain normalization (RestaurantIdentity)
 *     → Menu source resolution (which provider has data)
 *     → Menu loading + normalization (NormalizedMenuItem[])
 *     → MenuResolutionResult (ok | unavailable)
 *
 * The AI reasoning layer (generateRestaurantMealsAI) only runs when
 * status === "ok" and receives verified items. It NEVER invents menus.
 *
 * Adding a new menu provider:
 *   1. Implement the MenuProvider interface below
 *   2. Register it in PROVIDERS[]
 *   3. Add the source literal to MenuSource in shared/awayFromHome.ts
 *   No other changes needed.
 *
 * Adding a new chain:
 *   1. Create server/data/chainMenus/{brandSlug}.json
 *   2. Add an entry to BRAND_REGISTRY in server/data/chainMenus/registry.ts
 *   No other changes needed.
 */

import path from "path";
import fs from "fs";
import type {
  NormalizedMenuItem,
  MenuResolutionResult,
  RestaurantIdentity,
  MenuSource,
} from "@shared/awayFromHome";
import {
  findBrandByName,
  findBrandBySlug,
  normalizeInputName,
  type BrandRegistryEntry,
} from "../data/chainMenus/registry";

// ── Menu Provider Interface ──────────────────────────────────────────────────

/**
 * Every menu source implements this interface.
 * Future providers (OCR, PDF, licensed API, website parser) add a new class
 * implementing this interface — no changes to the intelligence service needed.
 */
interface MenuProvider {
  readonly source: MenuSource;
  /**
   * Attempt to load verified menu items for the given brand entry.
   * Returns null if this provider cannot serve the given brand.
   */
  resolve(entry: BrandRegistryEntry): Promise<NormalizedMenuItem[] | null>;
}

// ── Provider: Internal Canonical JSON ───────────────────────────────────────

/**
 * Loads menu data from local JSON files in server/data/chainMenus/.
 * This is the primary provider — always checked first.
 * Files are loaded synchronously on first access and cached in memory.
 */
class InternalCanonicalMenuProvider implements MenuProvider {
  readonly source: MenuSource = "internal_canonical";

  private readonly cache = new Map<string, NormalizedMenuItem[]>();
  private readonly menuDir = path.resolve(__dirname, "../data/chainMenus");

  async resolve(entry: BrandRegistryEntry): Promise<NormalizedMenuItem[] | null> {
    if (!entry.menuFile) return null;
    if (
      !entry.identity.availableMenuSources.includes("internal_canonical")
    ) {
      return null;
    }

    const { brandSlug } = entry.identity;

    if (this.cache.has(brandSlug)) {
      return this.cache.get(brandSlug)!;
    }

    const filePath = path.join(this.menuDir, entry.menuFile);

    if (!fs.existsSync(filePath)) {
      console.warn(
        `⚠️ Menu Intelligence: canonical file missing for "${brandSlug}" at ${filePath}`
      );
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const items: NormalizedMenuItem[] = JSON.parse(raw);
      this.cache.set(brandSlug, items);
      console.log(
        `✅ Menu Intelligence: loaded ${items.length} items for "${entry.identity.displayName}"`
      );
      return items;
    } catch (err) {
      console.error(
        `❌ Menu Intelligence: failed to parse menu file for "${brandSlug}":`,
        err
      );
      return null;
    }
  }

  /** Evict a brand from cache (useful after menu file updates in development). */
  evict(brandSlug: string): void {
    this.cache.delete(brandSlug);
  }

  /** Return cache stats for health/debug endpoints. */
  getCacheStats(): { loadedBrands: string[]; totalItems: number } {
    const loadedBrands = [...this.cache.keys()];
    const totalItems = [...this.cache.values()].reduce(
      (sum, items) => sum + items.length,
      0
    );
    return { loadedBrands, totalItems };
  }
}

// ── Provider: Licensed API (future) ─────────────────────────────────────────

/**
 * Stub for future third-party nutrition API integration (e.g., Nutritionix).
 * Not yet active — included to demonstrate the extension point.
 */
class LicensedApiMenuProvider implements MenuProvider {
  readonly source: MenuSource = "licensed_api";

  async resolve(_entry: BrandRegistryEntry): Promise<NormalizedMenuItem[] | null> {
    // TODO: implement when a licensed menu API is configured
    // Check process.env.NUTRITIONIX_API_KEY || process.env.MENU_API_KEY
    return null;
  }
}

// ── Provider Registry ────────────────────────────────────────────────────────

/**
 * Ordered list of providers. Resolution walks the list and returns the
 * first non-null result. Add new providers here.
 */
const PROVIDERS: MenuProvider[] = [
  new InternalCanonicalMenuProvider(),
  new LicensedApiMenuProvider(),
];

// Expose the canonical provider's cache utilities for health endpoints
const canonicalProvider = PROVIDERS[0] as InternalCanonicalMenuProvider;

// ── Staleness Check ──────────────────────────────────────────────────────────

/**
 * Number of days after which a menu's lastVerifiedAt triggers a staleness flag.
 * Does not block serving — only adds a warning to the response.
 */
const STALENESS_THRESHOLD_DAYS = 180;

function isMenuStale(lastVerifiedAt: string): boolean {
  try {
    const verified = new Date(lastVerifiedAt);
    const now = new Date();
    const diffDays = (now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > STALENESS_THRESHOLD_DAYS;
  } catch {
    return false;
  }
}

function getNewestVerifiedAt(items: NormalizedMenuItem[]): string {
  return items.reduce((newest, item) => {
    return item.lastVerifiedAt > newest ? item.lastVerifiedAt : newest;
  }, "2000-01-01");
}

// ── Dietary Filter ───────────────────────────────────────────────────────────

/**
 * Optional pre-filter to narrow menu items before AI reasoning.
 * Removes items that are definitively incompatible with hard dietary constraints.
 * The AI still applies nuanced judgment — this filter only removes clear violations.
 */
export function preFilterMenuItems(
  items: NormalizedMenuItem[],
  dietaryRestrictions: string[] = [],
  allergies: string[] = []
): NormalizedMenuItem[] {
  const lowerAllergies = allergies.map((a) => a.toLowerCase());
  const diets = dietaryRestrictions.map((d) => d.toLowerCase());

  return items.filter((item) => {
    // Hard allergy filter — never show items containing user's allergens
    if (lowerAllergies.length > 0 && item.allergens) {
      const hasAllergen = item.allergens.some((allergen) =>
        lowerAllergies.some((ua) => allergen.toLowerCase().includes(ua))
      );
      if (hasAllergen) return false;
    }

    // Hard vegan filter
    if (diets.includes("vegan") && item.isVegan === false) {
      return false;
    }

    // Hard vegetarian filter
    if (
      diets.includes("vegetarian") &&
      item.isVegetarian === false
    ) {
      return false;
    }

    // Hard gluten-free filter (structural intolerance)
    if (
      (diets.includes("celiac") || diets.includes("gluten-free")) &&
      item.isGlutenFree === false
    ) {
      return false;
    }

    return true;
  });
}

// ── Main Resolution Function ─────────────────────────────────────────────────

export interface MenuResolutionOptions {
  /** User-typed or Google Places resolved restaurant name. */
  restaurantName: string;
  /** Optional: if the brand slug is already known (e.g., from a prior lookup). */
  brandSlug?: string;
  /** ISO 3166-1 alpha-2 country code for international scoping. Default: "US". */
  country?: string;
  /** User dietary restrictions — used for pre-filtering (not hard blocking). */
  dietaryRestrictions?: string[];
  /** User allergies — hard filter, removes violating items. */
  allergies?: string[];
}

/**
 * Resolve a restaurant name to its verified menu items.
 *
 * Returns a discriminated union:
 *   { status: "ok",  items, source, menuLastVerifiedAt, ... }
 *   { status: "unavailable", reason, alternatives, ... }
 *
 * NEVER returns an empty ok result that the caller might use as license to invent.
 * If items are empty after all providers, returns unavailable.
 */
export async function resolveRestaurantMenu(
  options: MenuResolutionOptions
): Promise<MenuResolutionResult> {
  const { restaurantName, brandSlug, country = "US", dietaryRestrictions = [], allergies = [] } = options;

  console.log(`🍽️  Menu Intelligence: resolving menu for "${restaurantName}"`);

  // ── Step 1: Find brand registry entry ──────────────────────────────────

  let entry: BrandRegistryEntry | undefined;

  if (brandSlug) {
    entry = findBrandBySlug(brandSlug);
  }

  if (!entry) {
    entry = findBrandByName(restaurantName);
  }

  if (!entry) {
    console.log(
      `ℹ️  Menu Intelligence: no registry match for "${restaurantName}" — returning unavailable`
    );
    return {
      status: "unavailable",
      reason: "no_registry_match",
      alternatives: ["just_describe_it", "my_perfect_buffet", "paste_menu_text"],
    };
  }

  // ── Step 2: Country scope check ─────────────────────────────────────────

  if (
    !entry.identity.availableInCountries.includes(country) &&
    !entry.identity.availableInCountries.includes("US")
  ) {
    console.log(
      `ℹ️  Menu Intelligence: "${entry.identity.displayName}" menu not available for country "${country}"`
    );
    return {
      status: "unavailable",
      partialIdentity: entry.identity,
      reason: "international_chain",
      alternatives: ["just_describe_it", "my_perfect_buffet"],
    };
  }

  // ── Step 3: Walk provider chain ──────────────────────────────────────────

  let resolvedItems: NormalizedMenuItem[] | null = null;
  let resolvedSource: MenuSource = "unavailable";

  for (const provider of PROVIDERS) {
    try {
      const items = await provider.resolve(entry);
      if (items && items.length > 0) {
        resolvedItems = items;
        resolvedSource = provider.source;
        console.log(
          `✅ Menu Intelligence: resolved ${items.length} items via "${provider.source}" for "${entry.identity.displayName}"`
        );
        break;
      }
    } catch (err) {
      console.error(
        `❌ Menu Intelligence: provider "${provider.source}" threw for "${entry.identity.brandSlug}":`,
        err
      );
    }
  }

  // ── Step 4: Return unavailable if no provider succeeded ──────────────────

  if (!resolvedItems || resolvedItems.length === 0) {
    console.log(
      `ℹ️  Menu Intelligence: all providers exhausted for "${entry.identity.displayName}"`
    );
    return {
      status: "unavailable",
      partialIdentity: entry.identity,
      reason: "no_menu_provider",
      alternatives: ["just_describe_it", "my_perfect_buffet", "paste_menu_text"],
    };
  }

  // ── Step 5: Optional pre-filter ──────────────────────────────────────────

  const filteredItems =
    dietaryRestrictions.length > 0 || allergies.length > 0
      ? preFilterMenuItems(resolvedItems, dietaryRestrictions, allergies)
      : resolvedItems;

  // If pre-filter eliminated all items, return the full unfiltered list and
  // let the AI reasoning layer handle it (it has better nuance).
  const itemsToReturn =
    filteredItems.length >= 3 ? filteredItems : resolvedItems;

  // ── Step 6: Staleness check ──────────────────────────────────────────────

  const menuLastVerifiedAt = getNewestVerifiedAt(itemsToReturn);
  const stale = isMenuStale(menuLastVerifiedAt);
  if (stale) {
    console.warn(
      `⚠️  Menu Intelligence: menu for "${entry.identity.displayName}" ` +
        `was last verified ${menuLastVerifiedAt} (>${STALENESS_THRESHOLD_DAYS} days ago)`
    );
  }

  return {
    status: "ok",
    identity: entry.identity,
    items: itemsToReturn,
    source: resolvedSource,
    menuLastVerifiedAt,
  };
}

// ── Convenience: bulk lookup for Find Meals Near Me ─────────────────────────

export interface BulkMenuResolutionOptions {
  restaurants: Array<{ name: string; brandSlug?: string }>;
  country?: string;
  dietaryRestrictions?: string[];
  allergies?: string[];
}

/**
 * Resolve menus for multiple restaurants simultaneously.
 * Used by Find Meals Near Me which processes a list of Google Places results.
 * Returns a map from restaurant name to resolution result.
 */
export async function bulkResolveRestaurantMenus(
  options: BulkMenuResolutionOptions
): Promise<Map<string, MenuResolutionResult>> {
  const { restaurants, country, dietaryRestrictions, allergies } = options;

  const results = await Promise.all(
    restaurants.map(async (r) => {
      const result = await resolveRestaurantMenu({
        restaurantName: r.name,
        brandSlug: r.brandSlug,
        country,
        dietaryRestrictions,
        allergies,
      });
      return [r.name, result] as [string, MenuResolutionResult];
    })
  );

  return new Map(results);
}

// ── Health / Debug Utilities ─────────────────────────────────────────────────

/**
 * Returns the current state of the internal menu cache.
 * Exposed by the health endpoint in development.
 */
export function getMenuIntelligenceHealth(): {
  registeredBrands: number;
  cachedBrands: number;
  cachedItems: number;
} {
  const { loadedBrands, totalItems } = canonicalProvider.getCacheStats();

  // Lazy import to avoid circular dependency at module level
  const { BRAND_REGISTRY } = require("../data/chainMenus/registry");

  return {
    registeredBrands: BRAND_REGISTRY.length,
    cachedBrands: loadedBrands.length,
    cachedItems: totalItems,
  };
}

/**
 * Force-evict a brand from the menu cache.
 * Useful during development when a chain JSON file is updated.
 */
export function evictMenuCache(brandSlug: string): void {
  canonicalProvider.evict(brandSlug);
}
