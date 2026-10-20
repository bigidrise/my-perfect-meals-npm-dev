import { createSafetyAdapter, type InputSafety } from "./safetyAdapter";

type Envelope = {
  userId: string;
  dietaryIdentity: string[];
  allergies: string[];
  avoidances: string[];
  medicalHardLimits: string[];
  medicalOptimization: string[];
  conditionGuidanceBlocks: string[];
  procedural: object;
};
type Food = {
  name: string;
  description: string;
  ingredients: Array<{ name: string }>;
  instructions: string[];
};
export type ExistingDeterministicChecks = {
  requiresVerifiedIngredientEvidence: (envelope: unknown) => boolean;
  enforceSafetyProfileSync: (profile: {
    userId: string; allergies: string[]; dietaryRestrictions: string[];
    healthConditions: string[]; avoidIngredients: string[];
  }, input: string) => { result: string };
  scanGeneratedOutput: (food: Food, envelope: unknown, context: { generatorName: "pairings_ai" }) => { passed: boolean };
  containsAlcoholContent: (food: { ingredients: Array<{ name: string }> }) => boolean;
};

function envelopeForChecks(raw: unknown): Envelope {
  if (!raw || typeof raw !== "object") throw new Error("Safety context unavailable");
  const value = raw as Record<string, unknown>;
  if (typeof value.userId !== "string" || !value.userId || value.userId === "guest") {
    throw new Error("Account-owner safety context unavailable");
  }
  for (const key of [
    "dietaryIdentity", "allergies", "avoidances", "medicalHardLimits",
    "medicalOptimization", "conditionGuidanceBlocks", "providerInterventions",
  ]) {
    if (!Array.isArray(value[key])) throw new Error("Incomplete safety context");
    if (key !== "providerInterventions" && !(value[key] as unknown[]).every(item => typeof item === "string")) {
      throw new Error("Invalid safety context");
    }
  }
  for (const key of ["pregnancySupportContext", "dailyNutritionState", "glp1DailyTolerance"]) {
    if (!Object.prototype.hasOwnProperty.call(value, key)
      || (value[key] !== null && (typeof value[key] !== "object" || Array.isArray(value[key])))) {
      throw new Error("Missing or invalid nested safety result");
    }
  }
  if (!value.procedural || typeof value.procedural !== "object"
    || typeof value.hasDiabetes !== "boolean" || typeof value.thyroidSupport !== "boolean") {
    throw new Error("Incomplete protocol context");
  }
  // This validates the adapter's input shape, NOT clinical completeness. The existing
  // authority receipt is still required; no real profile loader is installed here.
  return raw as Envelope;
}

function actionableText(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { recommendations?: unknown }).recommendations)) {
    throw new Error("Invalid actionable response");
  }
  const text: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string") text.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") {
      for (const [key, field] of Object.entries(value)) {
        if (!["id", "listEntryId", "recommendationIds", "alternativeIds", "claims", "bestChoiceId"].includes(key)) {
          collect(field);
        }
      }
    }
  };
  collect(raw);
  if (!text.length) throw new Error("No actionable fields");
  return text;
}

function food(text: string[]): Food {
  return {
    name: "Pairing advisor recommendation", description: text.join("\n"),
    ingredients: text.map(name => ({ name })), instructions: text,
  };
}

/**
 * Synthetic verification bridge to unchanged real functions supplied explicitly by tests.
 * No runtime scanner imports, authority loading, audit, overrides, or provider fallback.
 */
export function createSyntheticDeterministicBridge(checks: ExistingDeterministicChecks) {
  return {
    requiresVerifiedIngredients(raw: unknown): boolean {
      return checks.requiresVerifiedIngredientEvidence(envelopeForChecks(raw));
    },
    safety: createSafetyAdapter({
      mode: "synthetic_test_only",
      async checkInput({ request, safetyContext }): Promise<InputSafety> {
        let envelope: Envelope;
        try { envelope = envelopeForChecks(safetyContext); }
        catch { return "unavailable"; }
        if (checks.requiresVerifiedIngredientEvidence(envelope)) return "restricted";
        // Avoid the asynchronous service's SAFE-on-profile-load-failure behavior.
        // Only an already-resolved owner profile may reach the existing pure check.
        const result = checks.enforceSafetyProfileSync({
          userId: envelope.userId, allergies: envelope.allergies,
          dietaryRestrictions: envelope.dietaryIdentity,
          healthConditions: envelope.medicalHardLimits,
          avoidIngredients: envelope.avoidances,
        }, request.message);
        return result.result === "SAFE" || result.result === "ADVISORY" ? "pass" : "restricted";
      },
      async scanGeneratedOutput({ actionable, safetyContext }) {
        const envelope = envelopeForChecks(safetyContext);
        if (checks.requiresVerifiedIngredientEvidence(envelope)) return false;
        const fields = actionableText(actionable);
        // Aggregate checks retain cross-field conflicts; individual checks prevent a
        // safe-variant phrase in one field from masking unsafe advice in another.
        return [fields, ...fields.map(field => [field])].every(parts =>
          checks.scanGeneratedOutput(food(parts), envelope, { generatorName: "pairings_ai" }).passed === true);
      },
      async scanAlcohol({ actionable, safetyContext }) {
        const envelope = envelopeForChecks(safetyContext);
        const forbidden = envelope.dietaryIdentity.some(identity => identity.trim().toLowerCase() === "halal");
        if (!forbidden) return true;
        return actionableText(actionable).every(field =>
          // Detector true means alcohol FOUND, whereas the adapter true means SAFE.
          !checks.containsAlcoholContent({ ingredients: [{ name: field }] }));
      },
    }),
  };
}
