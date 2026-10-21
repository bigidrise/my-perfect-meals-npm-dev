import { z } from "zod";
import type { SafetySourceKey } from "../../nutritionResolutionContext";
import type { ReadySafetyAuthority } from "../../../../shared/pairingAdvisor/contracts";
import { immutableCopy } from "./immutable";
import { ReadinessFailure } from "./execution";

export const CheckEnvelope = z.object({
  userId: z.string().min(1).refine(id => id !== "guest"),
  dietaryIdentity: z.array(z.string()), allergies: z.array(z.string()),
  avoidances: z.array(z.string()), medicalHardLimits: z.array(z.string()),
  medicalOptimization: z.array(z.string()), conditionGuidanceBlocks: z.array(z.string()),
  providerInterventions: z.array(z.unknown()),
  procedural: z.object({}).passthrough(), hasDiabetes: z.boolean(), thyroidSupport: z.boolean(),
  pregnancySupportContext: z.object({}).passthrough().nullable(),
  dailyNutritionState: z.object({}).passthrough().nullable(),
  glp1DailyTolerance: z.object({}).passthrough().nullable(),
}).passthrough();
export type CheckEnvelope = z.infer<typeof CheckEnvelope>;
export type OwnerAuthority = {
  kind: "strict_owner_authority";
  authority: ReadySafetyAuthority;
  envelope: CheckEnvelope;
  constraints: string;
};
/** Structural projection of the strict resolver result, not a synthetic fixture receipt.
 * Values stay unknown until checked below; importing this contract never loads the resolver.
 */
export type StrictOwnerReceipt =
  | {
    status: "complete"; ownerId: string; subjectId: string; scope: "account_owner";
    envelope: unknown; prescription: unknown;
    sources: Readonly<Partial<Record<SafetySourceKey, unknown>>>; persistence: "none";
  }
  | { status: "unavailable"; reasonCode: "STRICT_OWNER_UNAVAILABLE"; failedSources: SafetySourceKey[] };
export type StrictOwnerPort = {
  /** No import or default binding to the disconnected real entry point. */
  resolveOwner: (authenticatedOwnerId: string, signal: AbortSignal) => Promise<StrictOwnerReceipt>;
  requiresVerifiedIngredients: (envelope: CheckEnvelope) => boolean;
  consumptionGate: (envelope: CheckEnvelope) => "eligible" | "restricted" | "unavailable";
  constraints: (envelope: CheckEnvelope) => string;
};
const required: readonly SafetySourceKey[] = [
  "owner_profile", "timezone", "glp1_activation", "personal_supports", "provider_interventions",
  "diabetes_context", "glp1_tolerance", "competition", "condition_guidance", "daily_state",
  "prescription", "glp1_guardrails", "performance", "write_boundary",
];
const Outcome = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), value: z.unknown(), basis: z.enum(["stored", "calculated", "existing_default"]) }).strict(),
  z.object({ status: z.literal("not_applicable"), reasonCode: z.string().min(1) }).strict(),
  z.object({ status: z.literal("absent"), reasonCode: z.literal("successful_empty_read") }).strict(),
]);

/** Separately typed from synthetic-only adapters. Offline tests supply strict-result fixtures. */
export function createStrictOwnerAuthority(port: StrictOwnerPort) {
  return async (ownerId: string, signal: AbortSignal): Promise<OwnerAuthority> => {
    const fail = (): never => { throw new ReadinessFailure("AUTHORITY_UNAVAILABLE"); };
    try {
    if (!ownerId || ownerId === "guest" || signal.aborted) return fail();
    const result = await port.resolveOwner(ownerId, signal);
    if (signal.aborted || result?.status !== "complete" || result.ownerId !== ownerId
      || result.subjectId !== ownerId || result.scope !== "account_owner" || result.persistence !== "none") return fail();
    const envelope = CheckEnvelope.safeParse(result.envelope);
    if (!envelope.success || envelope.data.userId !== ownerId) return fail();
    if (!result.sources || required.some(key => {
      const source = Outcome.safeParse(result.sources[key]);
      return !source.success || (source.data.status === "success"
        && (!Object.prototype.hasOwnProperty.call(source.data, "value") || source.data.value === undefined));
    })) return fail();
    const profile = z.object({ status: z.literal("success"), value: z.object({ id: z.literal(ownerId) }) })
      .safeParse(result.sources.owner_profile);
    const timezone = z.discriminatedUnion("status", [
      z.object({
        status: z.literal("success"),
        value: z.object({ timezone: z.string().min(1), localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      }),
      z.object({ status: z.literal("not_applicable"), reasonCode: z.string().min(1) }),
    ]).safeParse(result.sources.timezone);
    const boundary = z.object({ status: z.literal("success"), value: z.literal("none") }).safeParse(result.sources.write_boundary);
    const prescription = Outcome.safeParse(result.sources.prescription);
    if (!profile.success || !timezone.success || !boundary.success || !prescription.success
      || !["success", "not_applicable"].includes(prescription.data.status)
      || (prescription.data.status === "success" && (result.prescription == null
        || JSON.stringify(prescription.data.value) !== JSON.stringify(result.prescription)))) return fail();
    // Preserve the real resolver's established non-applicability for healthy owners.
    // A date-sensitive prescription may never use that exemption.
    if (timezone.data.status === "success") {
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone.data.value.timezone });
    } else if (prescription.data.status !== "not_applicable") return fail();
    const verified = port.requiresVerifiedIngredients(envelope.data);
    const gate = port.consumptionGate(envelope.data);
    const constraints = port.constraints(envelope.data);
    if (typeof verified !== "boolean" || !["eligible", "restricted"].includes(gate)
      || typeof constraints !== "string") return fail();
    return immutableCopy({
      kind: "strict_owner_authority", envelope: envelope.data, constraints,
      authority: {
        status: "ready", actorId: ownerId, subjectId: ownerId, scope: "account_owner",
        requiredSafetyComplete: true, requiresVerifiedIngredients: verified,
        consumptionGate: gate as "eligible" | "restricted",
      },
    });
    } catch { return fail(); }
  };
}
