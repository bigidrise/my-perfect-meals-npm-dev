/**
 * NutritionixMenuProvider — future licensed API provider.
 *
 * Nutritionix has a branded food / restaurant endpoint that covers
 * hundreds of chains with item-level nutrition data.
 *
 * This stub exists to demonstrate the extension point.
 * Activating it requires: NUTRITIONIX_APP_ID + NUTRITIONIX_API_KEY env vars
 * and a license agreement with Nutritionix.
 *
 * When activated, this provider slots into the engine's provider chain
 * with no changes to any other file.
 */

import type { RestaurantIdentity } from "@shared/awayFromHome";
import type { MenuProvider, MenuProviderCapabilities, MenuProviderResult } from "../MenuProvider";

export class NutritionixMenuProvider implements MenuProvider {
  readonly capabilities: MenuProviderCapabilities = {
    source: "licensed_api",
    requiresNetwork: true,
    supportsArbitraryRestaurants: true,
    description:
      "Licensed Nutritionix API — provides item-level nutrition for hundreds of chains. Requires NUTRITIONIX_APP_ID and NUTRITIONIX_API_KEY.",
  };

  private get isConfigured(): boolean {
    return (
      !!process.env.NUTRITIONIX_APP_ID && !!process.env.NUTRITIONIX_API_KEY
    );
  }

  async getMenu(
    restaurantName: string,
    _identity?: RestaurantIdentity
  ): Promise<MenuProviderResult> {
    if (!this.isConfigured) {
      return {
        ok: false,
        reason: "not_supported",
        message: "Nutritionix API credentials not configured",
      };
    }

    // TODO: implement when licensed
    // GET https://trackapi.nutritionix.com/v2/search/item?branded=true&brand_name={restaurantName}
    return {
      ok: false,
      reason: "not_supported",
      message: "NutritionixMenuProvider not yet implemented",
    };
  }

  async getMetadata(_brandSlug: string): Promise<null> {
    return null;
  }
}
