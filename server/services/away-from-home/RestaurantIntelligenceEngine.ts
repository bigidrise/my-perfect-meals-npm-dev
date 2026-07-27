/**
 * Restaurant Intelligence Engine
 *
 * The orchestrator for the Meals Away From Home platform.
 * Every feature (Restaurant Guide, Fast Food Guide, Find Meals Near Me,
 * My Perfect Buffet) runs through this engine to resolve menu data.
 *
 * What this engine knows:
 *   WHO a restaurant is      → BrandRegistry
 *   WHERE menu data lives    → MenuProvider chain (injected, not imported)
 *   WHAT items are available → NormalizedMenuItem[]
 *   HOW confident we are     → NutritionDataStatus
 *
 * What this engine does NOT know:
 *   - which concrete providers exist (see ProviderRegistry)
 *   - how any provider retrieves its data
 *   - how to generate AI recommendations
 *   - how to display a card or add to macros
 *
 * The engine is a pure class. It has no singleton logic and no
 * concrete provider imports. The production singleton lives in ProviderRegistry.
 *
 * Usage (production):
 *   import { restaurantEngine } from "./ProviderRegistry";
 *   const result = await restaurantEngine.resolve({ restaurantName: "Wendy's" });
 *
 * Usage (tests):
 *   const engine = new RestaurantIntelligenceEngine([mockProvider]);
 *   const result = await engine.resolve({ restaurantName: "Wendy's" });
 */

import type { MenuResolutionResult, NormalizedMenuItem, NutritionDataStatus } from "@shared/awayFromHome";
import { findBrandByName, findBrandBySlug, getBrandsWithMenuCoverage } from "./BrandRegistry";
import type { MenuProvider } from "./providers/MenuProvider";

// ── Staleness threshold ───────────────────────────────────────────────────────

const STALENESS_THRESHOLD_DAYS = 180;

function menuIsStale(lastVerifiedAt: string): boolean {
  try {
    const diffMs = Date.now() - new Date(lastVerifiedAt).getTime();
    return diffMs / (1000 * 60 * 60 * 24) > STALENESS_THRESHOLD_DAYS;
  } catch {
    return false;
  }
}

// ── Dietary pre-filter ────────────────────────────────────────────────────────

/**
 * Hard-remove items that violate the user's dietary constraints before
 * passing to the AI reasoning layer.
 *
 * The AI handles soft preferences and nuance. This filter removes
 * clear violations only (known allergens, vegan/vegetarian/gluten-free).
 *
 * If filtering eliminates all items, the full unfiltered list is returned
 * so the AI can still make its best attempt.
 */
export function applyDietaryPreFilter(
  items: NormalizedMenuItem[],
  dietaryRestrictions: string[] = [],
  allergies: string[] = []
): NormalizedMenuItem[] {
  if (dietaryRestrictions.length === 0 && allergies.length === 0) {
    return items;
  }

  const lowerAllergies = allergies.map((a) => a.toLowerCase());
  const diets = new Set(dietaryRestrictions.map((d) => d.toLowerCase()));

  const filtered = items.filter((item) => {
    if (lowerAllergies.length > 0 && item.allergens) {
      const hasAllergen = item.allergens.some((allergen) =>
        lowerAllergies.some((ua) => allergen.toLowerCase().includes(ua))
      );
      if (hasAllergen) return false;
    }

    if (diets.has("vegan") && item.isVegan === false) return false;
    if (diets.has("vegetarian") && item.isVegetarian === false) return false;
    if (
      (diets.has("celiac") || diets.has("gluten-free")) &&
      item.isGlutenFree === false
    )
      return false;

    return true;
  });

  return filtered.length >= 2 ? filtered : items;
}

// ── Resolution options ────────────────────────────────────────────────────────

export interface EngineResolutionOptions {
  /** Raw restaurant name — user-typed or Google Places resolved. */
  restaurantName: string;
  /** Optional: skip name lookup if brand slug is already known. */
  brandSlug?: string;
  /** ISO 3166-1 alpha-2 country code for international scoping. Default: "US". */
  country?: string;
  dietaryRestrictions?: string[];
  allergies?: string[];
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class RestaurantIntelligenceEngine {
  /** Injected provider chain — engine has no knowledge of concrete implementations. */
  private readonly providers: MenuProvider[];

  /**
   * Pass any MenuProvider[] — the engine treats them all identically
   * through the interface. It never inspects what a provider is.
   */
  constructor(providers: MenuProvider[]) {
    this.providers = providers;
    console.log(
      `🍽️  Restaurant Intelligence Engine initialized. ` +
        `Providers: ${providers.length} | ` +
        `Brands with menu coverage: ${getBrandsWithMenuCoverage().length}`
    );
  }

  /**
   * Core resolution method.
   *
   * Resolves a restaurant name to verified menu items, or returns an
   * explicit "unavailable" result with alternative actions for the user.
   *
   * NEVER returns an empty ok result. If all providers return nothing,
   * status is "unavailable" — the caller must never invent menu items.
   */
  async resolve(options: EngineResolutionOptions): Promise<MenuResolutionResult> {
    const {
      restaurantName,
      brandSlug,
      country = "US",
      dietaryRestrictions = [],
      allergies = [],
    } = options;

    console.log(`🍽️  Engine: resolving "${restaurantName}"`);

    // ── Step 1: Brand identity ───────────────────────────────────────────────
    const identity = brandSlug
      ? findBrandBySlug(brandSlug)
      : findBrandByName(restaurantName);

    if (!identity) {
      console.log(`ℹ️  Engine: no registry match for "${restaurantName}"`);
      return {
        status: "unavailable",
        reason: "no_registry_match",
        alternatives: ["just_describe_it", "my_perfect_buffet", "paste_menu_text"],
      };
    }

    // ── Step 2: Country scope ────────────────────────────────────────────────
    if (!identity.availableInCountries.includes(country)) {
      console.log(
        `ℹ️  Engine: "${identity.displayName}" has no menu for country "${country}"`
      );
      return {
        status: "unavailable",
        partialIdentity: identity,
        reason: "international_chain",
        alternatives: ["just_describe_it", "my_perfect_buffet"],
      };
    }

    // ── Step 3: Provider chain ───────────────────────────────────────────────
    // The engine iterates providers polymorphically via the MenuProvider interface.
    // It has no knowledge of what any provider is or how it retrieves data.
    for (const provider of this.providers) {
      try {
        const result = await provider.getMenu(restaurantName, identity);

        if (result.ok && result.items.length > 0) {
          console.log(
            `✅ Engine: "${identity.displayName}" resolved via source="${provider.capabilities.source}" ` +
              `(${result.items.length} items)`
          );

          // ── Step 4: Dietary pre-filter ─────────────────────────────────────
          const items = applyDietaryPreFilter(
            result.items,
            dietaryRestrictions,
            allergies
          );

          // ── Step 5: Staleness check ────────────────────────────────────────
          if (menuIsStale(result.lastVerifiedAt)) {
            console.warn(
              `⚠️  Engine: menu for "${identity.displayName}" last verified ` +
                `${result.lastVerifiedAt} (>${STALENESS_THRESHOLD_DAYS} days ago)`
            );
          }

          return {
            status: "ok",
            identity,
            items,
            source: result.source,
            menuLastVerifiedAt: result.lastVerifiedAt,
          };
        }
      } catch (err) {
        // Provider errors are isolated — one provider failure does not stop the chain.
        console.error(
          `❌ Engine: provider source="${provider.capabilities.source}" threw for "${identity.brandSlug}":`,
          err
        );
      }
    }

    // ── Step 6: All providers exhausted ─────────────────────────────────────
    console.log(
      `ℹ️  Engine: all ${this.providers.length} provider(s) exhausted for "${identity.displayName}"`
    );
    return {
      status: "unavailable",
      partialIdentity: identity,
      reason: "no_menu_provider",
      alternatives: ["just_describe_it", "my_perfect_buffet", "paste_menu_text"],
    };
  }

  /**
   * Bulk resolution for Find Meals Near Me, which receives a list of
   * Google Places results and needs to resolve each restaurant.
   */
  async resolveBulk(
    restaurants: Array<{ name: string; brandSlug?: string }>,
    sharedOptions: Omit<EngineResolutionOptions, "restaurantName" | "brandSlug"> = {}
  ): Promise<Map<string, MenuResolutionResult>> {
    const entries = await Promise.all(
      restaurants.map(async (r) => {
        const result = await this.resolve({
          restaurantName: r.name,
          brandSlug: r.brandSlug,
          ...sharedOptions,
        });
        return [r.name, result] as [string, MenuResolutionResult];
      })
    );
    return new Map(entries);
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /** Health summary — used by /api/health and debug endpoints. */
  getHealth(): {
    providers: Array<{ source: string; description: string; requiresNetwork: boolean }>;
    brandsWithCoverage: number;
  } {
    return {
      providers: this.providers.map((p) => ({
        source: p.capabilities.source,
        description: p.capabilities.description,
        requiresNetwork: p.capabilities.requiresNetwork,
      })),
      brandsWithCoverage: getBrandsWithMenuCoverage().length,
    };
  }

  /**
   * Determine the NutritionDataStatus for a recommendation.
   * Used by the shared card to select the right disclosure.
   */
  static getNutritionStatus(
    source: string,
    hasUserSubstitutions: boolean
  ): NutritionDataStatus {
    if (source === "internal_canonical" || source === "licensed_api") {
      return hasUserSubstitutions ? "mixed" : "official";
    }
    return "estimated";
  }
}

// No singleton here. Import restaurantEngine from ProviderRegistry for production use.
