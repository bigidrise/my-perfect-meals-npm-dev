export interface PrivilegedMfaAuthority {
  isFounder: boolean | null;
  isAdmin: boolean | null;
  role: string | null;
  professionalRole: string | null;
  isBusinessOwner: boolean;
  isBusinessAdmin: boolean;
}

const PRIVILEGED_SYSTEM_ROLES = new Set(["admin", "coach"]);
const PRIVILEGED_PROFESSIONAL_ROLES = new Set([
  "physician",
  "trainer",
  "dietitian",
  "nurse_practitioner",
]);

/**
 * This intentionally does not inspect isTester. Test accounts receive the
 * same privileged MFA obligations as every other principal.
 */
export function requiresPrivilegedMfa(authority: PrivilegedMfaAuthority): boolean {
  return (
    authority.isFounder === true ||
    authority.isAdmin === true ||
    (authority.role != null && PRIVILEGED_SYSTEM_ROLES.has(authority.role)) ||
    (authority.professionalRole != null &&
      PRIVILEGED_PROFESSIONAL_ROLES.has(authority.professionalRole)) ||
    authority.isBusinessOwner ||
    authority.isBusinessAdmin
  );
}