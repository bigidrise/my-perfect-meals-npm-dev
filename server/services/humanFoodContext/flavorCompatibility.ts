import type {
  HumanFoodFlavorContext,
  ResolvedFoodPreference,
} from "../../../shared/humanFoodContext";

type ProfileFlavorFields = {
  palateSpiceTolerance?: string | null;
  palateSeasoningIntensity?: string | null;
  palateFlavorStyle?: string | null;
  cuisinePreference?: string | null;
  cuisineIntensity?: string | null;
  flavorPreference?: string | null;
  heatPreference?: string | null;
};

type RequestFlavorFields = {
  cuisine?: string | null;
  cuisineIntensity?: string | null;
  heat?: string | null;
  seasoningIntensity?: string | null;
  broadFlavor?: string | null;
  flavorStyle?: string | null;
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function preference(
  current: unknown,
  legacy: unknown,
  defaultValue?: string,
): ResolvedFoodPreference {
  const currentValue = clean(current);
  if (currentValue) return { value: currentValue, source: "current_profile", available: true };

  const legacyValue = clean(legacy);
  if (legacyValue && legacyValue !== defaultValue) {
    return { value: legacyValue, source: "legacy_profile", available: true };
  }

  return { value: null, source: "unavailable", available: false };
}

function requestFirst(request: unknown, fallback: ResolvedFoodPreference): ResolvedFoodPreference {
  const value = clean(request);
  return value
    ? { value, source: "request", available: true }
    : fallback;
}

export function resolveFlavorCompatibility(
  profile: ProfileFlavorFields,
  request: RequestFlavorFields = {},
): HumanFoodFlavorContext {
  const heat = requestFirst(
    request.heat,
    preference(profile.heatPreference, profile.palateSpiceTolerance, "mild"),
  );
  const seasoningIntensity = requestFirst(
    request.seasoningIntensity,
    // "balanced" is a database default, so it is not treated as explicit legacy intent.
    preference(null, profile.palateSeasoningIntensity, "balanced"),
  );
  const broadFlavor = requestFirst(
    request.broadFlavor,
    preference(profile.flavorPreference, null),
  );
  const flavorStyle = requestFirst(
    request.flavorStyle,
    preference(null, profile.palateFlavorStyle, "classic"),
  );
  const cuisine = requestFirst(
    request.cuisine,
    preference(profile.cuisinePreference, null),
  );
  const cuisineIntensity = requestFirst(
    request.cuisineIntensity,
    preference(profile.cuisineIntensity, null),
  );

  return {
    heat,
    seasoningIntensity,
    broadFlavor,
    flavorStyle,
    cuisine,
    cuisineIntensity,
    spiceComplexity: {
      value: null,
      source: "unavailable",
      available: false,
      note: "Spice complexity has no approved deterministic v1 mapping.",
    },
  };
}
