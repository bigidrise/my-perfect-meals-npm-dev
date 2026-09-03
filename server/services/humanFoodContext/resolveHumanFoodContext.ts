import { createHmac, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
  type HumanFoodContextPublicMeta,
  type HumanFoodCreator,
} from "../../../shared/humanFoodContext";
import { db } from "../../db";
import { derivePreferenceProfile } from "../behavioralMemoryService";
import { resolveDailyNutritionState } from "../nutritionStateService";
import { resolveFlavorCompatibility } from "./flavorCompatibility";
import {
  issueHumanFoodContextReceipt,
  redeemHumanFoodContextReceipt,
} from "./contextReceipt";

const CONTEXT_TTL_MS = 15 * 60 * 1000;

export interface ResolveHumanFoodContextInput {
  actorUserId: string;
  subjectUserId: string;
  creator: HumanFoodCreator;
  correlationId?: string | null;
  receipt?: string | null;
  generationChainId?: string | null;
  dietOverride?: string | null;
  cuisine?: string | null;
  cuisineIntensity?: string | null;
  heat?: string | null;
  seasoningIntensity?: string | null;
  broadFlavor?: string | null;
  flavorStyle?: string | null;
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

export async function resolveHumanFoodContext(
  input: ResolveHumanFoodContextInput,
): Promise<HumanFoodContext> {
  if (!input.actorUserId || !input.subjectUserId) {
    throw Object.assign(new Error("Authenticated food context is required"), { status: 401 });
  }

  if (input.receipt) {
    const existing = redeemHumanFoodContextReceipt({
      receipt: input.receipt,
      actorUserId: input.actorUserId,
      subjectUserId: input.subjectUserId,
      creator: input.creator,
      generationChainId: input.generationChainId,
    });
    if (existing) return existing;
    throw Object.assign(new Error("Food context receipt is invalid or expired"), {
      status: 409,
      code: "HUMAN_FOOD_CONTEXT_RECEIPT_INVALID",
    });
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
    nutrition = await resolveDailyNutritionState(
      input.subjectUserId,
      localDate(profile.timezone),
    );
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

  const base: Omit<HumanFoodContext, "internalFingerprint"> = {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status,
    creator: input.creator,
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    generationChainId: input.generationChainId || randomUUID(),
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
    nutrition,
    behavior,
    gaps: [...new Set(gaps)],
    notices,
    blockedReasons: [],
    rejectedCandidateSignatures: [],
  };

  return { ...base, internalFingerprint: fingerprint(base) };
}

export function issueHumanFoodContextMeta(
  context: HumanFoodContext,
): HumanFoodContextPublicMeta {
  const receipt = issueHumanFoodContextReceipt(context);
  return {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: context.status,
    receipt: receipt.receipt,
    expiresAt: receipt.expiresAt,
    generationChainId: receipt.generationChainId,
    correlationId: receipt.correlationId,
    gaps: context.gaps,
    notices: context.notices,
  };
}
