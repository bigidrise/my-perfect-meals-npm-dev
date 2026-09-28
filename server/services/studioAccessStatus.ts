import { isProCarePlanKey } from "@shared/planFeatures";
import type { StudioAccessSource, StudioAccessStatus } from "@shared/studioAccess";
import { isStudioProviderRole } from "./procareStudioReadiness";
import { canProviderAccessProCareStudio, type ProCareProviderSnapshot } from "./procareProviderAccess";
import type { EffectiveAccess } from "./effectiveAccess";

type StudioProviderSnapshot = ProCareProviderSnapshot & {
  professionalRole: string | null;
  isProCare: boolean | null;
};

export function resolveStudioAccessStatus(
  provider: StudioProviderSnapshot,
  effectiveAccess: EffectiveAccess,
  studioStatus: string | null,
  ownsOrganization: boolean,
  billingEnforced: boolean,
  studioReady: boolean,
): StudioAccessStatus {
  const sources: StudioAccessSource[] = [];
  if (isProCarePlanKey(provider.personalPlanLookupKey) ||
      (!effectiveAccess.sponsoredByBusinessId && isProCarePlanKey(provider.planLookupKey))) {
    sources.push("personal");
  }
  if (effectiveAccess.pilotProCareAccess) sources.push("pilot");
  if (effectiveAccess.sponsoredByBusinessId && effectiveAccess.sponsoredProCareAccess) sources.push("sponsored");
  if (provider.isFounder || provider.isSandbox || provider.isTester) sources.push("internal");

  const authorized = canProviderAccessProCareStudio(provider, effectiveAccess, billingEnforced);
  const studioActive = studioStatus === "active";
  const inconsistent = studioActive && (!authorized || sources.length === 0);
  const setupEligible = provider.isProCare === true && isStudioProviderRole(provider.professionalRole);
  const state: StudioAccessStatus["state"] = inconsistent
    ? "needs_review"
    : !authorized || sources.length === 0
      ? "inactive"
      : !studioActive
        ? studioStatus === null && setupEligible
          ? "setup_available"
          : "needs_review"
        : sources.includes("internal")
          ? "managed_access"
          : "active";

  return {
    state,
    sources,
    studioActive,
    studioReady: studioActive && studioReady,
    authorized,
    ownsOrganization,
    setupDestination: state === "setup_available" ? "/professional-dashboard" : null,
  };
}