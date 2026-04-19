/**
 * Restaurant Scoring Engine
 *
 * Scores Google Places restaurant results against the user's dietary identity.
 * Returns score (0-100), tier classification, badges, and human-readable reasons.
 */

export type ScoredTier = "HIGH_MATCH" | "ADAPTABLE" | "BLOCKED";

export interface ScoredRestaurant {
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
  placeId?: string;
  score: number;
  tier: ScoredTier;
  badges: string[];
  reasons: string[];
}

export interface RawPlaceResult {
  name: string;
  formatted_address?: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  editorial_summary?: { overview?: string };
  reviews?: Array<{ text?: string }>;
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
  place_id?: string;
}

const KOSHER_POSITIVE   = ["kosher", "glatt kosher", "kosher deli", "glatt", "kosher certified"];
const HALAL_POSITIVE    = ["halal", "zabiha", "halal certified", "halal food"];
const VEGAN_POSITIVE    = ["vegan", "plant-based", "plant based", "vegan friendly", "vegan restaurant", "100% vegan"];
const VEGETARIAN_POSITIVE = ["vegetarian", "veggie", "veg friendly", "vegetarian friendly"];
const PESCATARIAN_POSITIVE = ["seafood", "fish", "sushi", "pescatarian"];

const PORK_TERMS    = ["pork", "bacon", "ham", "bbq pork", "pork ribs", "pulled pork", "carnitas", "lard", "pig roast"];
const ALCOHOL_TERMS = ["wine bar", "cocktail", "brewery", "pub", "bar & grill", "sports bar", "taproom", "gastropub"];
const SEAFOOD_TERMS = ["seafood", "oyster", "lobster", "crab", "shrimp", "clam", "shellfish"];
const STEAK_TERMS   = ["steakhouse", "chophouse", "steak house", "chop house"];

type SupportedDiet =
  | "kosher"
  | "halal"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "keto"
  | "general";

function textHits(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

function countHits(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.filter((t) => lower.includes(t)).length;
}

function getPhotoUrl(photoReference: string | undefined): string | undefined {
  if (!photoReference) return undefined;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return undefined;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
}

function buildSearchText(place: RawPlaceResult): string {
  const parts: string[] = [
    place.name,
    place.editorial_summary?.overview || "",
    ...(place.reviews?.map((r) => r.text || "") ?? []),
    ...(place.types ?? []),
  ];
  return parts.join(" ").toLowerCase();
}

function computeRatingBoost(rating?: number, totalRatings?: number): number {
  const r = rating ?? 0;
  const t = totalRatings && totalRatings > 0 ? Math.log(totalRatings) : 0;
  return r * 5 + t;
}

function scorePlaceForDiet(
  place: RawPlaceResult,
  diet: SupportedDiet
): { score: number; tier: ScoredTier; badges: string[]; reasons: string[] } {
  const text = buildSearchText(place);
  const base = 50;
  const ratingBoost = computeRatingBoost(place.rating, place.user_ratings_total);
  let boost = 0;
  let penalty = 0;
  const badges: string[] = [];
  const reasons: string[] = [];
  let hardBlocked = false;

  const hasPork    = textHits(text, PORK_TERMS);
  const hasAlcohol = textHits(text, ALCOHOL_TERMS);
  const hasSeafood = textHits(text, SEAFOOD_TERMS);
  const hasSteak   = textHits(text, STEAK_TERMS);

  if (diet === "kosher") {
    const hasKosherSignal = textHits(text, KOSHER_POSITIVE);
    if (hasKosherSignal) {
      boost += 50;
      badges.push("Kosher Certified");
      reasons.push("Kosher-certified restaurant");
    } else {
      hardBlocked = true;
      reasons.push("No kosher certification found");
    }
  }

  else if (diet === "halal") {
    const hasHalalSignal = textHits(text, HALAL_POSITIVE);
    if (hasHalalSignal) {
      boost += 40;
      badges.push("Halal Certified");
      reasons.push("Halal-certified restaurant");
      if (hasPork) {
        penalty += 20;
        reasons.push("Contains pork items — ask about specific dishes");
      }
      if (hasAlcohol) {
        penalty += 15;
        reasons.push("Alcohol-focused venue — may require careful ordering");
      }
    } else {
      hardBlocked = true;
      reasons.push("No halal certification found");
    }
  }

  else if (diet === "vegan") {
    if (textHits(text, VEGAN_POSITIVE)) {
      boost += 40;
      badges.push("Vegan");
      reasons.push("Vegan-friendly options available");
    }
    if (hasSteak) {
      penalty += 10;
      reasons.push("Steakhouse — vegan options may be limited");
    }
    if (hasPork && countHits(text, PORK_TERMS) >= 2) {
      penalty += 10;
      reasons.push("Heavy meat focus — request plant-based modifications");
    }
    if (boost === 0) {
      reasons.push("May work with adjustments — confirm plant-based options");
    }
  }

  else if (diet === "vegetarian") {
    if (textHits(text, VEGETARIAN_POSITIVE)) {
      boost += 35;
      badges.push("Vegetarian");
      reasons.push("Vegetarian-friendly options available");
    } else if (textHits(text, VEGAN_POSITIVE)) {
      boost += 35;
      badges.push("Vegetarian");
      reasons.push("Vegan options indicate strong vegetarian support");
    }
    if (boost === 0) {
      reasons.push("May work with modifications — confirm meat-free options");
    }
  }

  else if (diet === "pescatarian") {
    if (textHits(text, PESCATARIAN_POSITIVE)) {
      boost += 35;
      badges.push("Seafood");
      reasons.push("Seafood options available");
    }
    if (textHits(text, VEGETARIAN_POSITIVE) || textHits(text, VEGAN_POSITIVE)) {
      boost += 15;
      reasons.push("Plant-based options available alongside seafood");
    }
    if (hasPork && countHits(text, PORK_TERMS) >= 2 && !textHits(text, PESCATARIAN_POSITIVE)) {
      penalty += 10;
      reasons.push("Heavy meat focus — seafood options may be limited");
    }
    if (boost === 0) {
      reasons.push("May work with careful selection — confirm fish options");
    }
  }

  else {
    if (boost === 0) {
      reasons.push("General options available");
    }
  }

  if (reasons.length === 0) {
    reasons.push("Options available based on your profile");
  }

  if (hardBlocked) {
    return { score: 0, tier: "BLOCKED", badges, reasons };
  }

  const raw = base + boost - penalty + ratingBoost;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let tier: ScoredTier;
  if (score >= 75) {
    tier = "HIGH_MATCH";
  } else if (score >= 40) {
    tier = "ADAPTABLE";
  } else {
    tier = "BLOCKED";
  }

  return { score, tier, badges, reasons };
}

export function scoreRestaurantsForDiet(
  places: RawPlaceResult[],
  diet: string
): ScoredRestaurant[] {
  const normalizedDiet = diet?.toLowerCase().trim() as SupportedDiet;
  const validDiets: SupportedDiet[] = ["kosher", "halal", "vegan", "vegetarian", "pescatarian", "keto"];
  const effectiveDiet: SupportedDiet = validDiets.includes(normalizedDiet) ? normalizedDiet : "general";

  return places.map((place) => {
    const { score, tier, badges, reasons } = scorePlaceForDiet(place, effectiveDiet);
    return {
      name: place.name,
      address: place.formatted_address || place.vicinity || "Address not available",
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      photoUrl: place.photos?.[0]?.photo_reference
        ? getPhotoUrl(place.photos[0].photo_reference)
        : undefined,
      placeId: place.place_id,
      score,
      tier,
      badges,
      reasons,
    };
  });
}

export function buildDietQuery(diet: string, fallback: boolean): string {
  const d = diet?.toLowerCase().trim();
  if (fallback) return "restaurants near me";
  if (d === "kosher")       return "kosher restaurant near me";
  if (d === "halal")        return "halal food near me";
  if (d === "vegan")        return "vegan restaurant near me";
  if (d === "vegetarian")   return "vegetarian restaurant near me";
  if (d === "pescatarian")  return "seafood restaurant near me";
  if (d === "keto")         return "healthy restaurant near me";
  return "restaurants near me";
}
