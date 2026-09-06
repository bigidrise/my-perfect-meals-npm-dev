export interface PrivilegedMfaAuthority {
  email: string | null;
}

const REQUIRED_MFA_EMAILS = new Set(["bigidrise@gmail.com"]);

/**
 * MFA is currently mandatory only for explicitly allowlisted accounts.
 */
export function requiresPrivilegedMfa(authority: PrivilegedMfaAuthority): boolean {
  const email = authority.email?.trim().toLowerCase();
  return email != null && REQUIRED_MFA_EMAILS.has(email);
}