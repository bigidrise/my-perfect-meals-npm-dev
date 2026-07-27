/**
 * OfficialJsonMenuProvider
 *
 * The first concrete MenuProvider implementation.
 * Loads menu items from JSON files stored in providers/official-json/data/.
 *
 * Each file contains NormalizedMenuItem[] sourced from a chain's
 * publicly available nutrition information.
 *
 * To add a new restaurant to this provider:
 *   1. Create providers/official-json/data/{brandSlug}.json
 *   2. Add "internal_canonical" to that brand's availableMenuSources in BrandRegistry.ts
 *   That's it. No code changes needed here.
 *
 * This provider caches loaded files in memory for the process lifetime.
 * In a future multi-instance deployment, this cache should move to Redis.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { RestaurantIdentity, NormalizedMenuItem } from "@shared/awayFromHome";
import type { MenuProvider, MenuProviderCapabilities, MenuProviderResult } from "../MenuProvider";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "data");

export class OfficialJsonMenuProvider implements MenuProvider {
  readonly capabilities: MenuProviderCapabilities = {
    source: "internal_canonical",
    requiresNetwork: false,
    supportsArbitraryRestaurants: false,
    description:
      "Loads menu items from locally stored JSON files sourced from official chain nutrition publications.",
  };

  private readonly cache = new Map<string, NormalizedMenuItem[]>();

  async getMenu(
    _restaurantName: string,
    identity?: RestaurantIdentity
  ): Promise<MenuProviderResult> {
    if (!identity) {
      return { ok: false, reason: "not_supported", message: "No brand identity provided" };
    }

    if (!identity.availableMenuSources.includes("internal_canonical")) {
      return { ok: false, reason: "not_supported", message: `Brand "${identity.brandSlug}" has no internal_canonical menu` };
    }

    const items = this.load(identity.brandSlug);
    if (!items) {
      return {
        ok: false,
        reason: "not_found",
        message: `No JSON file found for brand "${identity.brandSlug}" in providers/official-json/data/`,
      };
    }

    const lastVerifiedAt = items.reduce(
      (newest, item) =>
        item.lastVerifiedAt > newest ? item.lastVerifiedAt : newest,
      "2000-01-01"
    );

    return { ok: true, items, source: "internal_canonical", lastVerifiedAt };
  }

  async getMetadata(brandSlug: string): Promise<{
    version?: string;
    lastVerifiedAt: string;
    itemCount: number;
  } | null> {
    const items = this.load(brandSlug);
    if (!items) return null;

    const lastVerifiedAt = items.reduce(
      (newest, item) =>
        item.lastVerifiedAt > newest ? item.lastVerifiedAt : newest,
      "2000-01-01"
    );

    return { lastVerifiedAt, itemCount: items.length };
  }

  /** Cache statistics for health / debug. */
  getCacheStats(): { loadedBrands: string[]; totalItems: number } {
    const loadedBrands = [...this.cache.keys()];
    const totalItems = [...this.cache.values()].reduce(
      (sum, items) => sum + items.length,
      0
    );
    return { loadedBrands, totalItems };
  }

  /** Evict a brand from cache (development utility). */
  evict(brandSlug: string): void {
    this.cache.delete(brandSlug);
    console.log(`🔄 OfficialJsonMenuProvider: evicted "${brandSlug}" from cache`);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private load(brandSlug: string): NormalizedMenuItem[] | null {
    if (this.cache.has(brandSlug)) {
      return this.cache.get(brandSlug)!;
    }

    const filePath = path.join(DATA_DIR, `${brandSlug}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const items: NormalizedMenuItem[] = JSON.parse(raw);
      this.cache.set(brandSlug, items);
      console.log(
        `✅ OfficialJsonMenuProvider: loaded ${items.length} items for "${brandSlug}"`
      );
      return items;
    } catch (err) {
      console.error(
        `❌ OfficialJsonMenuProvider: failed to parse data/${brandSlug}.json:`,
        err
      );
      return null;
    }
  }
}
