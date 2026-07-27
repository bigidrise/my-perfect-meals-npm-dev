/**
 * MenuProvider — the interface every menu source implements.
 *
 * The Restaurant Intelligence Engine only ever sees this interface.
 * It does not know or care whether a menu came from a local JSON file,
 * a licensed API, an OCR scan, a partner feed, or a user-uploaded PDF.
 *
 * Adding a new data source means implementing this interface.
 * Nothing else in the system changes.
 */

import type { NormalizedMenuItem, MenuSource, RestaurantIdentity } from "@shared/awayFromHome";

// ── What a provider knows about itself ──────────────────────────────────────

export interface MenuProviderCapabilities {
  /** Which MenuSource literal this provider produces. */
  source: MenuSource;
  /**
   * True if this provider requires an external API call.
   * Affects timeout behavior and fallback ordering.
   */
  requiresNetwork: boolean;
  /**
   * True if this provider can serve any restaurant by name lookup
   * (e.g., a licensed API). False if it only serves pre-registered brands.
   */
  supportsArbitraryRestaurants: boolean;
  /** Human-readable description shown in health / debug output. */
  description: string;
}

// ── Result of a provider lookup ──────────────────────────────────────────────

export type MenuProviderResult =
  | {
      ok: true;
      items: NormalizedMenuItem[];
      source: MenuSource;
      /** ISO date of the newest item's lastVerifiedAt in this result. */
      lastVerifiedAt: string;
    }
  | {
      ok: false;
      /** Why the provider could not serve this restaurant. */
      reason: "not_supported" | "network_error" | "parse_error" | "not_found";
      message?: string;
    };

// ── The interface ────────────────────────────────────────────────────────────

export interface MenuProvider {
  readonly capabilities: MenuProviderCapabilities;

  /**
   * Attempt to retrieve menu items for the given restaurant.
   *
   * @param restaurantName  Raw restaurant name as resolved (e.g., "Wendy's")
   * @param identity        Normalized brand identity — may be undefined for
   *                        providers that do their own name resolution.
   *
   * Returns { ok: true, items } when menu data is available,
   * or    { ok: false, reason } when this provider cannot serve the request.
   * Never throws — all errors are captured in the result.
   */
  getMenu(
    restaurantName: string,
    identity?: RestaurantIdentity
  ): Promise<MenuProviderResult>;

  /**
   * Return the version/last-updated metadata for a specific brand,
   * without loading the full menu.
   * Used by staleness checks and health endpoints.
   * Returns null if the provider has no metadata for this brand.
   */
  getMetadata(brandSlug: string): Promise<{
    version?: string;
    lastVerifiedAt: string;
    itemCount: number;
  } | null>;
}
