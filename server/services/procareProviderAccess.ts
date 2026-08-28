import { resolveAccessTier } from "../lib/accessTier";
import { canAccessProCareStudio } from "@shared/planFeatures";
import {
  computeEffectiveAccess,
  type EffectiveAccess,
} from "./effectiveAccess";

/**
 * Fields needed to resolve a provider's actual Studio access. Provider-facing
 * invitation flows must use this instead of their raw users.planLookupKey:
 * sponsored Clinical Business professionals keep their subscription on the
 * business membership, not on their personal user record.
 */
export interface ProCareProviderSnapshot {
  id: string;
  planLookupKey: string | null;
  personalPlanLookupKey?: string | null;
  isFounder?: boolean | null;
  isSandbox?: boolean | null;
  isTester?: boolean | null;
  trialEndsAt?: Date | string | null;
}

export function canProviderAccessProCareStudio(
  provider: ProCareProviderSnapshot,
  effectiveAccess: EffectiveAccess,
  billingEnforced: boolean,
): boolean {
  const accessTier = resolveAccessTier(
    {
      ...provider,
      planLookupKey: effectiveAccess.planLookupKey,
      hasPilotProCareAccess: effectiveAccess.pilotProCareAccess,
    },
    new Date(),
  );

  return canAccessProCareStudio({
    billingEnforced,
    accessTier,
    planLookupKey: effectiveAccess.planLookupKey,
    sponsoredByBusinessId: effectiveAccess.sponsoredByBusinessId,
    sponsoredProCareAccess: effectiveAccess.sponsoredProCareAccess,
    pilotProCareAccess: effectiveAccess.pilotProCareAccess,
    isInternalAccount: provider.isFounder === true,
  });
}

export async function providerHasProCareStudioAccess(
  provider: ProCareProviderSnapshot,
): Promise<boolean> {
  const effectiveAccess = await computeEffectiveAccess(provider);
  return canProviderAccessProCareStudio(
    provider,
    effectiveAccess,
    process.env.BILLING_ENFORCED === "true",
  );
}