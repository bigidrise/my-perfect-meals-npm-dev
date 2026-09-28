import { resolveAccessTier } from "../lib/accessTier";
import { canAccessProCareStudio, isProCarePlanKey } from "@shared/planFeatures";
import {
  computeEffectiveAccess,
  type EffectiveAccess,
} from "./effectiveAccess";
import { readIndependentStudioAccess } from "./independentStudioAccess";

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
    isInternalAccount:
      provider.isFounder === true ||
      provider.isSandbox === true ||
      provider.isTester === true,
  });
}

export async function providerHasProCareStudioAccess(
  provider: ProCareProviderSnapshot,
): Promise<boolean> {
  const independent = await readIndependentStudioAccess(provider.id);
  if (independent.hasSubscription) {
    if (independent.studioActive &&
        (independent.billing?.state === "active" || independent.billing?.state === "ending")) return true;
  }
  const effectiveAccess = await computeEffectiveAccess(provider);
  if (independent.hasSubscription && !provider.isFounder && !provider.isSandbox &&
      !provider.isTester && !effectiveAccess.sponsoredProCareAccess &&
      !effectiveAccess.pilotProCareAccess) return false;
  if (!independent.hasSubscription && !independent.legacyEligible &&
      isProCarePlanKey(effectiveAccess.planLookupKey) &&
      !effectiveAccess.sponsoredProCareAccess && !effectiveAccess.pilotProCareAccess &&
      !provider.isFounder && !provider.isSandbox && !provider.isTester) return false;
  if (!independent.hasSubscription &&
      effectiveAccess.planLookupKey === "clinical_business_monthly" &&
      !effectiveAccess.sponsoredProCareAccess && !effectiveAccess.pilotProCareAccess &&
      !provider.isFounder && !provider.isSandbox && !provider.isTester) return false;
  return canProviderAccessProCareStudio(
    provider,
    effectiveAccess,
    process.env.BILLING_ENFORCED === "true",
  );
}