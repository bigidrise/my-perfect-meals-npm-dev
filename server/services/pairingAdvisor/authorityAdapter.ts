import { z } from "zod";
import type { SafetyAuthority } from "../../../shared/pairingAdvisor/contracts";

const Snapshot = z.object({
  source: z.literal("synthetic_fixture"),
  ownerId: z.string().min(1),
  subjectId: z.string().min(1),
  scope: z.literal("account_owner"),
  required: z.object({
    allergies: z.literal(true),
    protocols: z.literal(true),
    clinical: z.literal(true),
    nestedResolution: z.literal(true),
  }).strict(),
  sideEffects: z.literal("none"),
  envelope: z.object({ userId: z.string().min(1) }).passthrough(),
  constraints: z.string(),
  consumptionGate: z.enum(["eligible", "restricted"]),
  optionalPreferences: z.record(z.string()).optional(),
}).strict();

export type AuthorityResolution = {
  authority: SafetyAuthority;
  safetyContext?: unknown;
  constraints?: string;
};
export type SyntheticAuthorityPorts = {
  mode: "synthetic_test_only";
  loadOwner: (options: { userId: string; personalSubject: true }) => Promise<unknown>;
  requiresVerifiedIngredients: (envelope: unknown) => boolean;
};
export type ResolveAuthority = (accountId: string) => Promise<AuthorityResolution>;

/**
 * No real loader is imported. A non-null envelope alone never supplies completeness.
 * Live loading remains blocked: existing nested catches and indirect writes require review.
 */
export function createAuthorityAdapter(ports?: SyntheticAuthorityPorts): ResolveAuthority {
  return async accountId => {
    const unavailable = (): AuthorityResolution => ({ authority: { status: "unavailable" } });
    if (!accountId || ports?.mode !== "synthetic_test_only") return unavailable();
    try {
      const snapshot = Snapshot.safeParse(await ports.loadOwner({ userId: accountId, personalSubject: true }));
      if (!snapshot.success) return unavailable();
      const data = snapshot.data;
      if (data.ownerId !== accountId || data.subjectId !== accountId || data.envelope.userId !== accountId) return unavailable();
      const requiresVerifiedIngredients = ports.requiresVerifiedIngredients(data.envelope);
      if (typeof requiresVerifiedIngredients !== "boolean") return unavailable();
      return {
        authority: {
          status: "ready", actorId: accountId, subjectId: accountId, scope: "account_owner",
          requiredSafetyComplete: true, requiresVerifiedIngredients,
          consumptionGate: data.consumptionGate, optionalPreferences: data.optionalPreferences,
        },
        safetyContext: data.envelope,
        constraints: data.constraints,
      };
    } catch {
      return unavailable();
    }
  };
}
