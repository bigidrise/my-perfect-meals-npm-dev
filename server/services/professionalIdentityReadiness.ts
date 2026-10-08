import { eq } from "drizzle-orm";
import { users, studios } from "@shared/schema";
import { isCanonicalPractitionerRole, isClinicalPractitionerRole } from "@shared/professionalRoles";
import type { ProfessionalReadiness, ProfessionalReadinessCheck } from "@shared/professionalOnboarding";
import { db } from "../db";
import { getAcademyProgression } from "./academyProgression";
import { checkLegalAcceptance } from "./legalCheck";
import { providerHasProCareStudioAccess } from "./procareProviderAccess";
import { getCurrentCredentialReview } from "./professionalIdentityCredentialBoundary";
import { requiresPrivilegedMfa } from "../lib/privilegedMfaPolicy";
import { ProfessionalRequestError } from "./professionalOnboardingService";

export interface ReadinessSubject {
  id: string; professionalRole: string | null; isProCare: boolean | null;
  professionalCategory: string | null; credentialBody: string | null; credentialNumber: string | null;
  mfaEnabled: boolean; email: string;
}
export interface ReadinessDependencies {
  account(id: string): Promise<ReadinessSubject | null>;
  credentials(account: ReadinessSubject): Promise<boolean>;
  training(id: string): Promise<{ phase1: { complete: boolean }; proCare: { complete: boolean } }>;
  agreements(id: string, flow: "professional" | "physician"): Promise<boolean>;
  entitlement(account: ReadinessSubject): Promise<boolean>;
  mfaRequired(account: ReadinessSubject): boolean;
}
const check = (status: ProfessionalReadinessCheck["status"], code: string): ProfessionalReadinessCheck => ({ status, code });
async function independent(work: () => Promise<ProfessionalReadinessCheck>, failure: string) {
  try { return await work(); } catch { return check("unavailable", failure); }
}
export function createProfessionalReadinessService(deps: ReadinessDependencies) {
  return async (id: string, subjectSessionMfa?: boolean): Promise<ProfessionalReadiness> => {
    const account = await deps.account(id);
    if (!account) throw new ProfessionalRequestError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
    const clinical = isClinicalPractitionerRole(account.professionalRole);
    const [credentials, training, agreements, entitlement] = await Promise.all([
      clinical ? independent(async () => (await deps.credentials(account)) ? check("ready", "CREDENTIALS_VERIFIED") : check("blocked", "INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED"), "CREDENTIAL_VERIFICATION_UNAVAILABLE") : Promise.resolve(check("not_applicable", "LICENSED_CREDENTIAL_NOT_REQUIRED")),
      independent(async () => {
        const evidence = await deps.training(id);
        return evidence.phase1.complete && evidence.proCare.complete ? check("ready", "ACADEMY_EVIDENCE_COMPLETE") : check("blocked", !evidence.phase1.complete ? "ACADEMY_PHASE1_REQUIRED" : "ACADEMY_PROCARE_TRAINING_REQUIRED");
      }, "ACADEMY_EVIDENCE_UNAVAILABLE"),
      independent(async () => (await deps.agreements(id, account.professionalRole === "physician" ? "physician" : "professional")) ? check("ready", "CURRENT_AGREEMENTS_ACCEPTED") : check("blocked", "CURRENT_AGREEMENTS_REQUIRED"), "LEGAL_EVIDENCE_UNAVAILABLE"),
      independent(async () => (await deps.entitlement(account)) ? check("ready", "PROCARE_ACCESS_ESTABLISHED") : check("blocked", "PROCARE_ENTITLEMENT_REQUIRED"), "ENTITLEMENT_UNAVAILABLE"),
    ]);
    const checks: ProfessionalReadiness["checks"] = {
      identity: isCanonicalPractitionerRole(account.professionalRole) ? check("ready", "CANONICAL_IDENTITY_ESTABLISHED") : check("blocked", "CANONICAL_IDENTITY_REQUIRED"),
      credentials, training, agreements, entitlement,
      mfa: !deps.mfaRequired(account) ? check("not_applicable", "MFA_NOT_REQUIRED_BY_CURRENT_POLICY")
        : !account.mfaEnabled ? check("blocked", "MFA_ENROLLMENT_REQUIRED")
        : subjectSessionMfa === undefined ? check("not_evaluated", "SUBJECT_SESSION_NOT_EVALUATED")
        : subjectSessionMfa ? check("ready", "CURRENT_SESSION_MFA_VERIFIED") : check("blocked", "CURRENT_SESSION_MFA_REQUIRED"),
      organizationLocation: check("not_evaluated", "EXACT_ORGANIZATION_LOCATION_CONTEXT_REQUIRED"),
      relationshipConsent: check("not_evaluated", "EXACT_CLIENT_RELATIONSHIP_AND_CONSENT_REQUIRED"),
    };
    return { scope: "account", checks, accountPrerequisitesReady: Object.entries(checks).filter(([key]) => !["organizationLocation", "relationshipConsent"].includes(key)).every(([, value]) => ["ready", "not_applicable"].includes(value.status)), clientAccessEvaluated: false };
  };
}
const accountFields = {
  id: users.id, email: users.email, professionalRole: users.professionalRole, professionalCategory: users.professionalCategory,
  credentialBody: users.credentialBody, credentialNumber: users.credentialNumber, isProCare: users.isProCare,
  mfaEnabled: users.mfaEnabled, role: users.role, isFounder: users.isFounder, isSandbox: users.isSandbox,
  isTester: users.isTester, planLookupKey: users.planLookupKey, personalPlanLookupKey: users.personalPlanLookupKey,
  trialEndsAt: users.trialEndsAt,
};
export const getProfessionalIdentityReadiness = createProfessionalReadinessService({
  account: async id => (await db.select(accountFields).from(users).where(eq(users.id, id)).limit(1))[0] ?? null,
  async credentials(account) {
    const review = await getCurrentCredentialReview(account.id);
    if (review?.required) return review.status === "verified";
    const [studio] = await db.select({ verification: studios.verificationStatus }).from(studios).where(eq(studios.ownerUserId, account.id)).limit(1);
    if (studio?.verification !== "verified") return false;
    // Reuse the existing clinical-evidence rule; do not invent NP verification.
    return account.professionalRole === "physician" || (account.professionalRole === "dietitian" && account.professionalCategory === "certified" && !!account.credentialBody?.trim() && !!account.credentialNumber?.trim());
  },
  training: getAcademyProgression,
  async agreements(id, flow) {
    const [attestation, professional] = await Promise.all([checkLegalAcceptance(id, "attestation"), checkLegalAcceptance(id, flow)]);
    return attestation.allAccepted && professional.allAccepted;
  },
  async entitlement(account) {
    const [provider] = await db.select(accountFields).from(users).where(eq(users.id, account.id)).limit(1);
    return !!provider?.isProCare && await providerHasProCareStudioAccess(provider);
  },
  mfaRequired: account => account.mfaEnabled || requiresPrivilegedMfa({ email: account.email }),
});
