export const PROCARE_INVITATION_VALIDITY_DAYS = 14;

export function createProCareInvitationExpiry(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PROCARE_INVITATION_VALIDITY_DAYS);
  return expiresAt;
}