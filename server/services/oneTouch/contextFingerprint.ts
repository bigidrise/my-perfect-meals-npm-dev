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

function stable(value: unknown, path = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => stable(item, path))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_KEYS.has(key) &&
        !(path === "context.nutrition.provenance" && key === "calculationTimestamp"))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item, path ? `${path}.${key}` : key)]));
  }
  return value;
}

function authorityMaterial(
  request: OneTouchRequest,
  context: HumanFoodContext,
  envelope: UserProtocolEnvelope,
  glp1: GLP1GlobalContext,
): Record<string, unknown> {
  const { userId: _userId, preferredLanguage: _language, measurementSystem: _units, ...foodProtocol } = envelope;
  return stable({
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
  }) as Record<string, unknown>;
}

export function oneTouchContextFingerprint(
  request: OneTouchRequest,
  context: HumanFoodContext,
  envelope: UserProtocolEnvelope,
  glp1: GLP1GlobalContext,
): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for One-Touch cache freshness.");
  const material = authorityMaterial(request, context, envelope, glp1);
  return createHmac("sha256", secret).update(JSON.stringify(material)).digest("base64url");
}

/** Diagnostic names only; never emit profile, nutrition, or medical values. */
export function oneTouchChangedAuthorityBranches(
  before: { request: OneTouchRequest; context: HumanFoodContext; envelope: UserProtocolEnvelope; glp1: GLP1GlobalContext },
  after: { request: OneTouchRequest; context: HumanFoodContext; envelope: UserProtocolEnvelope; glp1: GLP1GlobalContext },
): string[] {
  const left = authorityMaterial(before.request, before.context, before.envelope, before.glp1);
  const right = authorityMaterial(after.request, after.context, after.envelope, after.glp1);
  const changed: string[] = [];
  for (const field of ["version", "subjectUserId", "creator"]) {
    if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) changed.push(field);
  }
  for (const group of ["choices", "context", "protocol", "glp1"] as const) {
    const a = left[group] as Record<string, unknown> | undefined;
    const b = right[group] as Record<string, unknown> | undefined;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    // Material object keys are fixed code-owned fields. Arrays and their
    // contents are never logged, even if a nested profile value changes.
    if (!a || !b || Array.isArray(a) || Array.isArray(b)) {
      changed.push(group);
      continue;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        if (group === "context" && key === "nutrition" &&
            a[key] && b[key] && typeof a[key] === "object" && typeof b[key] === "object") {
          const beforeNutrition = a[key] as Record<string, unknown>;
          const afterNutrition = b[key] as Record<string, unknown>;
          for (const field of new Set([...Object.keys(beforeNutrition), ...Object.keys(afterNutrition)])) {
            if (JSON.stringify(beforeNutrition[field]) !== JSON.stringify(afterNutrition[field])) {
              changed.push(`context.nutrition.${/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field) ? field : "<field>"}`);
            }
          }
        } else {
          changed.push(`${group}.${key}`);
        }
      }
    }
  }
  return changed;
}