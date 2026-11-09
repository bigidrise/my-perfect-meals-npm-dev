import axios from "axios";
import type { GetawayAvailability } from "../../shared/getawayAvailability";
import { restaurantEngine } from "./away-from-home/ProviderRegistry";
import { violatesDietaryConstraints } from "./allergyGuardrails";

type Preferences = GetawayAvailability["preferences"];
const clean = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 200) : "";

export function getawayPreferences(user: { cuisinePreference?: unknown }, diets: string[]): Preferences {
  const cuisine = clean(user.cuisinePreference);
  return {
    cuisine: cuisine && !/^(none|unsure|unknown|general|any|no preference)$/i.test(cuisine) ? cuisine : null,
    diets: [...new Set(diets.map(clean).filter(Boolean))],
  };
}

/** Search listings, then reuse Restaurant Assistant's menu provider chain.
 * A Places match never establishes terminal membership, cuisine or food safety.
 * No profile, menu or derived cache writes. Never send clinical data to Places. */
export async function checkGetawayAvailability(
  location: string,
  preferences: Preferences,
): Promise<GetawayAvailability> {
  const result = (status: GetawayAvailability["status"], summary: string,
    restaurants: GetawayAvailability["restaurants"] = []): GetawayAvailability =>
    ({ status, summary, preferences, restaurants });
  if (!location) return result("location_required", "Select a specific destination before looking for dining options.");
  const preferenceLabel = [preferences.cuisine, ...preferences.diets].filter(Boolean).join(", ");
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return result("unavailable", `Restaurant listings could not be checked at ${location}. Any meal ideas are general suggestions, not confirmed offerings.`);
  }
  try {
    const lookup = async (cuisine: string | null) => {
      const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
        params: {
          query: `${[cuisine, ...preferences.diets].filter(Boolean).join(" ")} restaurants inside ${location}`,
          key: process.env.GOOGLE_PLACES_API_KEY,
          type: "restaurant",
        },
        timeout: 4000,
      });
      const data = response.data;
      if (!["OK", "ZERO_RESULTS"].includes(data?.status)) throw new Error("listing_provider_unavailable");
      return (Array.isArray(data.results) ? data.results : []).filter((place: any) =>
        clean(place?.name) && place.business_status !== "CLOSED_PERMANENTLY" &&
        (!Array.isArray(place.types) || place.types.includes("restaurant"))).slice(0, 3);
    };
    let places = await lookup(preferences.cuisine);
    const preferredNotFound = !places.length;
    // Cuisine is flexible; never broaden away the saved dietary restrictions.
    if (!places.length && preferences.cuisine) places = await lookup(null);
    const restaurants = await Promise.all(places.map(async (place: any) => {
      const name = clean(place.name);
      const base = { name, address: clean(place.formatted_address), menuStatus: "unverified" as const,
        menuNote: "Current menu, dietary suitability and presence inside your selected area are not confirmed. Ask the restaurant." };
      try {
        // Do not use the engine's permissive dietary pre-filter as clearance.
        const menu = await restaurantEngine.resolve({ restaurantName: name });
        if (menu.status !== "ok") return base;
        const age = Date.now() - Date.parse(menu.menuLastVerifiedAt);
        if (!Number.isFinite(age) || age > 180 * 86400000 || age < 0) return {
          ...base, menuNote: "Published menu data is outdated or undated. Confirm current items and dietary details with this location.",
        };
        const compatible = menu.items.filter(item => {
          if (violatesDietaryConstraints(`${item.name} ${item.description ?? ""}`, preferences.diets).violates) return false;
          const diets = preferences.diets.map(diet => diet.toLowerCase());
          if (diets.includes("vegan") && item.isVegan !== true) return false;
          if (diets.includes("vegetarian") && item.isVegetarian !== true) return false;
          if (diets.some(diet => ["gluten-free", "celiac"].includes(diet)) && item.isGlutenFree !== true) return false;
          if (diets.some(diet => ["halal", "kosher"].includes(diet))) return false;
          return true;
        });
        return { ...base, menuStatus: "published" as const, menuNote: compatible.length
          ? `Published chain-menu candidates: ${compatible.slice(0, 3).map(item => item.name).join(", ")}. Ingredients, clinical suitability and availability at this outlet still need confirmation.`
          : "Published menu data was found, but no item could be confirmed against your saved dietary restrictions. Ask about suitable preparations; don't assume none exist." };
      } catch { return base; }
    }));
    if (preferredNotFound) return result("no_matches_found",
      `I couldn't find confirmed ${preferenceLabel || "matching"} dining options at ${location}.${restaurants.length ? " These other dining listings may be worth checking without changing your dietary restrictions." : ""} This is not a complete inventory; it does not mean no suitable food exists. Ask venue staff about options and ingredients.`, restaurants);
    return result("listings_found",
      `Found possible dining listings for ${preferenceLabel || "your search"} at ${location}. Search matches are not proof of the requested cuisine, dietary suitability, or access within your terminal or area. Menu evidence is shown for each restaurant.`, restaurants);
  } catch {
    // Provider failures are uncertainty, never evidence that a cuisine is absent.
    return result("unavailable", `Restaurant search is temporarily unavailable at ${location}. I couldn't check matching restaurants or menus. Any meal ideas are general suggestions to discuss with staff.`);
  }
}
