import { createHmac } from "node:crypto";
import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import type { OneTouchRequest } from "../../../shared/oneTouch";
import type { UserProtocolEnvelope } from "../protocolEnvelope";
import type { GLP1GlobalContext } from "../glp1/resolveGLP1GlobalContext";

// This is a display-freshness marker, not proof that a browser-supplied meal
// passed validation. Never accept the browser's marker as current authority.
const VOLATILE_KEYS = new Set([
  "resolvedAt", "expiresAt", "updatedAt", "createdAt", "generatedAt",
  "correlationId", "generationChainId", "internalFingerprint",
  "reservationId", "ageMinutes",
]);

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function oneTouchContextFingerprint(
  request: OneTouchRequest,
  context: HumanFoodContext,
  envelope: UserProtocolEnvelope,
  glp1: GLP1GlobalContext,
): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for One-Touch cache freshness.");
  const { userId: _userId, preferredLanguage: _language, measurementSystem: _units, ...foodProtocol } = envelope;
  const material = stable({
    version: 1,
    subjectUserId: context.subjectUserId,
    creator: request.creator,
    choices: { servings: request.servings, cuisine: request.cuisine, eatingStyle: request.eatingStyle },
    context: {
      version: context.version,
      status: context.status,
      diet: context.diet,
      flavor: context.flavor,
      safety: context.safety,
      authorization: {
        status: context.authorization.status,
        action: context.authorization.action,
        waivers: context.authorization.waivers,
      },
      nutrition: context.nutrition,
      behavior: context.behavior,
      foodsIEnjoy: context.foodsIEnjoy,
      nutritionPriorities: context.nutritionPriorities,
      sweeteners: context.sweeteners,
      diabetesFoodPreferences: context.diabetesFoodPreferences,
      gaps: context.gaps,
      blockedReasons: context.blockedReasons,
    },
    protocol: foodProtocol,
    glp1: {
      isActive: glp1.isActive,
      activationSources: glp1.activationSources,
      performanceActive: glp1.performanceActive,
      resolvedTargets: glp1.resolvedTargets,
      dailyNutritionState: glp1.dailyNutritionState,
      compositionNote: glp1.compositionNote,
    },
  });
  return createHmac("sha256", secret).update(JSON.stringify(material)).digest("base64url");
}