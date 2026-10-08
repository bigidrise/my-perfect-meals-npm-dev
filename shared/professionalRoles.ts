/**
 * Persisted identity is exact and canonical. Boundary aliases are request or
 * display metadata only and must NEVER be used to authorize stored accounts.
 */
export const CANONICAL_PRACTITIONER_ROLES = [
  "trainer",
  "physician",
  "dietitian",
  "nurse_practitioner",
] as const;

export type CanonicalPractitionerRole = (typeof CANONICAL_PRACTITIONER_ROLES)[number];
export type AccountProfessionalRole = CanonicalPractitionerRole | "business";

export const CLINICAL_PRACTITIONER_ROLES = [
  "physician",
  "dietitian",
  "nurse_practitioner",
] as const satisfies readonly CanonicalPractitionerRole[];

export function isCanonicalPractitionerRole(value: unknown): value is CanonicalPractitionerRole {
  return typeof value === "string"
    && (CANONICAL_PRACTITIONER_ROLES as readonly string[]).includes(value);
}

export function isClinicalPractitionerRole(value: unknown): value is (typeof CLINICAL_PRACTITIONER_ROLES)[number] {
  return typeof value === "string"
    && (CLINICAL_PRACTITIONER_ROLES as readonly string[]).includes(value);
}

export function requiresProfessionalRoleReview(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "" && value !== "business"
    && !isCanonicalPractitionerRole(value);
}

export function practitionerRelationshipType(value: unknown): "coaching" | "clinical" | "unsupported" {
  // A server-verified Studio operating context is nonclinical, not an occupation.
  // It is never accepted by isCanonicalPractitionerRole or stored on users.
  if (value === "trainer" || value === "studio_operator") return "coaching";
  if (isClinicalPractitionerRole(value)) return "clinical";
  return "unsupported";
}

/** Care Team dropdown aliases only; never apply this to users.professionalRole. */
export function resolveCareTeamRequestedRole(value: unknown): CanonicalPractitionerRole | null {
  if (isCanonicalPractitionerRole(value)) return value;
  if (value === "doctor") return "physician";
  if (value === "np") return "nurse_practitioner";
  return null;
}

/** Existing friendly UI keys; this function has no authorization meaning. */
export function careTeamRoleDisplayKey(value: string): string {
  if (value === "physician") return "doctor";
  if (value === "nurse_practitioner") return "np";
  return value;
}
