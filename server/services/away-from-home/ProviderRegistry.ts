/**
 * ProviderRegistry
 *
 * The ONLY file in the system that knows which concrete providers exist.
 * Also owns the production singleton of RestaurantIntelligenceEngine.
 *
 * This separation is intentional:
 *   - RestaurantIntelligenceEngine is a pure class — it knows nothing about
 *     what providers exist or how to bootstrap itself.
 *   - ProviderRegistry assembles the chain and injects it.
 *   - Adding, removing, or reordering providers happens ONLY here.
 *     The engine is never touched.
 *
 * To add a new provider:
 *   1. Implement the MenuProvider interface in providers/<name>/<Name>MenuProvider.ts
 *   2. Import it here
 *   3. Append it to the array in buildProviderChain()
 *   Done — no other file changes required.
 */

import type { MenuProvider } from "./providers/MenuProvider";
import { OfficialJsonMenuProvider } from "./providers/official-json/OfficialJsonMenuProvider";
import { NutritionixMenuProvider } from "./providers/nutritionix/NutritionixMenuProvider";
import { UploadedMenuProvider } from "./providers/uploaded-menu/UploadedMenuProvider";
import { OCRMenuProvider } from "./providers/ocr/OCRMenuProvider";
import { RestaurantIntelligenceEngine } from "./RestaurantIntelligenceEngine";

/**
 * Assemble the ordered provider chain.
 * Priority: first provider to return ok:true wins.
 * Place higher-confidence sources earlier.
 */
export function buildProviderChain(): MenuProvider[] {
  return [
    new OfficialJsonMenuProvider(),   // highest confidence: official chain data
    new NutritionixMenuProvider(),    // licensed API (stub until licensed)
    new UploadedMenuProvider(),       // user-uploaded PDF/text (stub)
    new OCRMenuProvider(),            // camera OCR (stub)
  ];
}

/**
 * Production singleton.
 * Import this wherever the engine is needed in application code.
 *
 * For tests, construct directly:
 *   new RestaurantIntelligenceEngine([mockProvider])
 */
export const restaurantEngine = new RestaurantIntelligenceEngine(buildProviderChain());

/**
 * Direct reference to the OfficialJsonMenuProvider singleton.
 * Used by the development debug endpoint to report item counts and cache stats.
 * Not for use in application logic — go through restaurantEngine instead.
 */
export const officialJsonProvider = new OfficialJsonMenuProvider();
