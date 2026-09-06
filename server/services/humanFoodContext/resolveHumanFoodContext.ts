import { createHmac, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
  type HumanFoodCreator,
} from "../../../shared/humanFoodContext";
import { db } from "../../db";
import { derivePreferenceProfile } from "../behavioralMemoryService";
import { resolveDailyNutritionState } from "../nutritionStateService";
import { resolveFlavorCompatibility } from "./flavorCompatibility";
import {
  claimAdvisoryOverrideToken,
  rollbackAdvisoryOverrideToken,
} from "../safetyPinService";

const CONTEXT_TTL_MS = 15 * 60 * 1000;

export interface ResolveHumanFoodContextInput {
  actorUserId: string;
  subjectUserId: string;
  creator: HumanFoodCreator;
  correlationId?: string | null;
  /**
   * User-local calendar date for this resolution. Weekly planning must supply
   * this explicitly; resolving "now" for every slot incorrectly shares one
   * day's reservations and clinical state across the week.
   */
  dateISO?: string;
  /** Board reservation being replaced; excluded only for its own date. */
  excludeItemId?: string;
  dietOverride?: string | null;
  cuisine?: string | null;
  cuisineIntensity?: string | null;
  heat?: string | null;
  seasoningIntensity?: string | null;
  broadFlavor?: string | null;
  flavorStyle?: string | null;
  /** Exact user request that the acknowledgement was issued for. */
  actionRequest?: string | null;
  /** Creator/action receiving the acknowledgement; defaults to this creator. */
  authorizationAction?: string | null;
  /** Server-issued acknowledgement token. Never trust client waiver fields. */
  advisoryOverrideToken?: string | null;
}

function localDate(timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function fingerprint(context: Omit<HumanFoodContext, "internalFingerprint">): string {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is required for Human Food Context");
  return createHmac("sha256", key)
    .update(JSON.stringify(context))
    .digest("base64url");
}

function normalizeRulePart(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
}

function resolveAdvisoryAuthorization(input: ResolveHumanFoodContextInput): HumanFoodContext["authorization"] {
  if (!input.advisoryOverrideToken || !input.actionRequest?.trim()) {
    return { status: "none", action: null, reservationId: null, waivers: [] };
  }
  const action = input.authorizationAction?.trim() || input.creator;
  const claim = claimAdvisoryOverrideToken(
    input.advisoryOverrideToken,
    input.actorUserId,
    input.actionRequest,
    action,
  );
  if (!claim) return { status: "none", action: null, reservationId: null, waivers: [] };

  const parsed = /^(dietary_identity|avoidance):(.+)$/i.exec(claim.reasonCode);
  const matchedTerm = normalizeRulePart(claim.matchedTerm);
  // A token can only waive one supported rule and one authoritative matched
  // term. For dietary identity the rule subject (for example "vegan") is
  // intentionally distinct from the conflicting food (for example "steak").
  if (!parsed || !normalizeRulePart(parsed[2]) || !matchedTerm) {
    // This reservation cannot safely authorize anything. Return it so an
    // invalid/tampered shape does not burn an otherwise retryable token.
    rollbackAdvisoryOverrideToken(input.advisoryOverrideToken);
    return { status: "none", action: null, reservationId: null, waivers: [] };
  }
  return {
    status: "authorized",
    action,
    reservationId: randomUUID(),
    waivers: [{
      dimension: parsed[1].toLowerCase() as "dietary_identity" | "avoidance",
      ruleCode: `${parsed[1].toLowerCase()}:${normalizeRulePart(parsed[2])}`,
      matchedTerm,
    }],
  };
}

export function freezeHumanFoodContext<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      freezeHumanFoodContext(nested);
    }
  }
  return value;
}

export async function resolveHumanFoodContext(
  input: ResolveHumanFoodContextInput,
): Promise<HumanFoodContext> {
  if (!input.actorUserId || !input.subjectUserId) {
    throw Object.assign(new Error("Authenticated food context is required"), { status: 401 });
  }

  const [profile] = await db
    .select({
      id: users.id,
      dietaryRestrictions: users.dietaryRestrictions,
      allergies: users.allergies,
      avoidedFoods: users.avoidedFoods,
      dislikedFoods: users.dislikedFoods,
      healthConditions: users.healthConditions,
      palateSpiceTolerance: users.palateSpiceTolerance,
      palateSeasoningIntensity: users.palateSeasoningIntensity,
      palateFlavorStyle: users.palateFlavorStyle,
      cuisinePreference: users.cuisinePreference,
      cuisineIntensity: users.cuisineIntensity,
      flavorPreference: users.flavorPreference,
      heatPreference: users.heatPreference,
      timezone: users.timezone,
    })
    .from(users)
    .where(eq(users.id, input.subjectUserId))
    .limit(1);

  if (!profile) {
    throw Object.assign(new Error("Food context subject was not found"), { status: 404 });
  }

  const gaps: string[] = [];
  const notices: string[] = [];
  let nutrition: HumanFoodContext["nutrition"] = null;
  let behavior: HumanFoodContext["behavior"] = null;
  let status: HumanFoodContext["status"] = "resolved";

  try {
    const dateISO = input.dateISO ?? localDate(profile.timezone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      throw new Error("dateISO must be a YYYY-MM-DD user-local calendar date");
    }
    nutrition = await resolveDailyNutritionState(input.subjectUserId, dateISO, input.excludeItemId);
  } catch {
    status = "review_required";
    gaps.push("daily_nutrition_state");
    notices.push("Daily nutrition context could not be resolved safely.");
  }

  try {
    const profileMemory = await derivePreferenceProfile(input.subjectUserId);
    if (profileMemory) {
      behavior = {
        preferredCuisines: profileMemory.patterns.prefersCuisines ?? [],
        preferredProteins: profileMemory.patterns.prefersProteins ?? [],
        preferredMethods: profileMemory.patterns.prefersCookingMethods ?? [],
        softAvoidances: profileMemory.avoids ?? [],
        profileVersion: profileMemory.auditMeta.profileHash ?? null,
      };
    } else {
      gaps.push("behavioral_history");
    }
  } catch {
    gaps.push("behavioral_history");
  }

  const flavor = resolveFlavorCompatibility(profile, {
    cuisine: input.cuisine,
    cuisineIntensity: input.cuisineIntensity,
    heat: input.heat,
    seasoningIntensity: input.seasoningIntensity,
    broadFlavor: input.broadFlavor,
    flavorStyle: input.flavorStyle,
  });
  for (const [key, value] of Object.entries(flavor)) {
    if (!value.available) gaps.push(`flavor.${key}`);
  }

  const storedDiet = profile.dietaryRestrictions ?? [];
  const requestDiet = input.dietOverride?.trim() || null;
  const effectiveDiet = requestDiet ? [requestDiet] : storedDiet;
  if (!effectiveDiet.length) gaps.push("diet.preference");
  if (status === "resolved" && gaps.length) status = "resolved_with_gaps";

  const authorization = resolveAdvisoryAuthorization(input);
  const base: Omit<HumanFoodContext, "internalFingerprint"> = {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status,
    creator: input.creator,
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    generationChainId: randomUUID(),
    correlationId: input.correlationId || randomUUID(),
    resolvedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CONTEXT_TTL_MS).toISOString(),
    diet: {
      stored: storedDiet,
      effective: effectiveDiet,
      source: requestDiet ? "request" : storedDiet.length ? "profile" : "unavailable",
      requestOverride: requestDiet,
      adaptationOutcome: requestDiet
        ? "request_override_applied"
        : storedDiet.length
          ? "not_needed"
          : "unavailable",
    },
    flavor,
    safety: {
      allergies: profile.allergies ?? [],
      avoidedFoods: profile.avoidedFoods ?? [],
      dislikedFoods: profile.dislikedFoods ?? [],
      healthConditions: profile.healthConditions ?? [],
    },
    authorization,
    nutrition,
    behavior,
    gaps: [...new Set(gaps)],
    notices,
    blockedReasons: [],
  };

  try {
    return freezeHumanFoodContext({ ...base, internalFingerprint: fingerprint(base) });
  } catch (error) {
    // A context that never resolved must not strand its claimed authorization.
    if (authorization.status === "authorized" && input.advisoryOverrideToken) {
      rollbackAdvisoryOverrideToken(input.advisoryOverrideToken);
    }
    throw error;
  }
}
