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

const NON_ACTIONABLE_HEAT_PREFERENCES = new Set([
  "unsure",
  "unknown",
]);

const NON_ACTIONABLE_BROAD_FLAVOR_PREFERENCES = new Set([
  "unsure",
  "unknown",
]);

function actionablePreference(
  value: unknown,
  nonActionableValues: ReadonlySet<string>,
): string | null {
  const cleaned = clean(value);
  return cleaned && !nonActionableValues.has(cleaned.toLowerCase())
    ? cleaned
    : null;
}

const actionableHeat = (value: unknown) =>
  actionablePreference(value, NON_ACTIONABLE_HEAT_PREFERENCES);

const actionableBroadFlavor = (value: unknown) =>
  actionablePreference(value, NON_ACTIONABLE_BROAD_FLAVOR_PREFERENCES);

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

function heatPreference(profile: ProfileFlavorFields): ResolvedFoodPreference {
  const current = clean(profile.heatPreference);
  if (current) {
    const actionable = actionableHeat(current);
    return actionable
      ? { value: actionable, source: "current_profile", available: true }
      : { value: null, source: "unavailable", available: false };
  }

  const legacy = actionableHeat(profile.palateSpiceTolerance);
  return legacy && legacy.toLowerCase() !== "mild"
    ? { value: legacy, source: "legacy_profile", available: true }
    : { value: null, source: "unavailable", available: false };
}

function broadFlavorPreference(profile: ProfileFlavorFields): ResolvedFoodPreference {
  const current = clean(profile.flavorPreference);
  if (!current) return { value: null, source: "unavailable", available: false };

  const actionable = actionableBroadFlavor(current);
  return actionable
    ? { value: actionable, source: "current_profile", available: true }
    : { value: null, source: "unavailable", available: false };
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
  const heat = requestFirst(actionableHeat(request.heat), heatPreference(profile));
  const seasoningIntensity = requestFirst(
    request.seasoningIntensity,
    // "balanced" is a database default, so it is not treated as explicit legacy intent.
    preference(null, profile.palateSeasoningIntensity, "balanced"),
  );
  const broadFlavor = requestFirst(
    actionableBroadFlavor(request.broadFlavor),
    broadFlavorPreference(profile),
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
