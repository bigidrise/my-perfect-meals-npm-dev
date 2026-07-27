/**
 * UploadedMenuProvider — user-uploaded PDF or text menu.
 *
 * When a user pastes menu text or uploads a PDF, this provider
 * normalizes that content into NormalizedMenuItem[] for the engine.
 *
 * Flow:
 *   User uploads PDF or pastes text
 *     → UploadedMenuProvider.ingest(text)
 *     → GPT-4o structured extraction → NormalizedMenuItem[]
 *     → stored in session (not persisted globally)
 *     → engine picks it up via getMenu()
 *
 * This is a stub. The extension point is here; the implementation
 * comes when the "paste your menu" feature is built.
 */

import type { RestaurantIdentity } from "@shared/awayFromHome";
import type { MenuProvider, MenuProviderCapabilities, MenuProviderResult } from "../MenuProvider";

export class UploadedMenuProvider implements MenuProvider {
  readonly capabilities: MenuProviderCapabilities = {
    source: "pdf_upload",
    requiresNetwork: false,
    supportsArbitraryRestaurants: true,
    description:
      "Extracts menu items from user-uploaded PDF or pasted menu text via AI structured extraction.",
  };

  async getMenu(
    _restaurantName: string,
    _identity?: RestaurantIdentity
  ): Promise<MenuProviderResult> {
    // TODO: implement session-scoped uploaded menu lookup
    return {
      ok: false,
      reason: "not_supported",
      message: "UploadedMenuProvider not yet implemented",
    };
  }

  async getMetadata(_brandSlug: string): Promise<null> {
    return null;
  }
}
