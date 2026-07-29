/**
 * OCRMenuProvider — camera → menu photo → items.
 *
 * User opens camera, photographs a physical menu board.
 * OCR extracts text. This provider normalizes it into NormalizedMenuItem[]
 * for the engine. Same output as every other provider.
 *
 * Flow:
 *   Photo → OCR text extraction (Google Vision or GPT-4o vision)
 *     → structured menu item extraction
 *     → NormalizedMenuItem[] (source: "ocr")
 *     → engine processes identically to official JSON
 *
 * This unlocks the "camera → menu → recommendation" workflow
 * with zero changes to the engine or the UI card.
 * This is a stub pending camera integration.
 */

import type { RestaurantIdentity } from "@shared/awayFromHome";
import type { MenuProvider, MenuProviderCapabilities, MenuProviderResult } from "../MenuProvider";

export class OCRMenuProvider implements MenuProvider {
  readonly capabilities: MenuProviderCapabilities = {
    source: "ocr",
    requiresNetwork: true,
    supportsArbitraryRestaurants: true,
    description:
      "Extracts menu items from a camera photo of a physical menu board via OCR + AI structured extraction.",
  };

  async getMenu(
    _restaurantName: string,
    _identity?: RestaurantIdentity
  ): Promise<MenuProviderResult> {
    // TODO: implement when camera integration ships
    return {
      ok: false,
      reason: "not_supported",
      message: "OCRMenuProvider not yet implemented",
    };
  }

  async getMetadata(_brandSlug: string): Promise<null> {
    return null;
  }
}
