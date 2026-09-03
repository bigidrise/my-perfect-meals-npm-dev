export type ProfessionalGlucoseAccessReason =
  | "allowed"
  | "authentication_required"
  | "professional_account_inactive"
  | "clinical_role_not_approved"
  | "credential_not_verified"
  | "organization_mismatch"
  | "relationship_not_active"
  | "patient_mismatch"
  | "clinical_consent_missing"
  | "authorization_check_failed";

export interface ProfessionalGlucoseAccessFacts {
  authenticated: boolean;
  professionalAccountActive: boolean;
  professionalRole: string | null;
  credentialVerified: boolean;
  sameOrganization: boolean;
  activeExactRelationship: boolean;
  patientMatchesRelationship: boolean;
  clinicalConsentActive: boolean;
}

export interface ProfessionalGlucoseAccessDecision {
  allowed: boolean;
  reason: ProfessionalGlucoseAccessReason;
  professionalRole: string | null;
}

const RAW_GLUCOSE_ROLES = new Set(["physician", "dietitian"]);

export function evaluateProfessionalGlucoseAccess(
  facts: ProfessionalGlucoseAccessFacts,
): ProfessionalGlucoseAccessDecision {
  const deny = (
    reason: Exclude<ProfessionalGlucoseAccessReason, "allowed">,
  ): ProfessionalGlucoseAccessDecision => ({
    allowed: false,
    reason,
    professionalRole: facts.professionalRole,
  });

  if (!facts.authenticated) return deny("authentication_required");
  if (!facts.professionalAccountActive) {
    return deny("professional_account_inactive");
  }
  if (
    !facts.professionalRole ||
    !RAW_GLUCOSE_ROLES.has(facts.professionalRole)
  ) {
    return deny("clinical_role_not_approved");
  }
  if (!facts.credentialVerified) return deny("credential_not_verified");
  if (!facts.sameOrganization) return deny("organization_mismatch");
  if (!facts.activeExactRelationship) {
    return deny("relationship_not_active");
  }
  if (!facts.patientMatchesRelationship) return deny("patient_mismatch");
  if (!facts.clinicalConsentActive) return deny("clinical_consent_missing");

  return {
    allowed: true,
    reason: "allowed",
    professionalRole: facts.professionalRole,
  };
}