/**
 * Input is the server-built authUser, never body/query data. This is personal
 * product access only; professional, MFA, consent and tenant gates still run.
 */
export function hasPersonalClinicalReconciliationAccess(user: {
  accessTier?: string;
  personalClinicalReconciliationEndsAt?: Date | string | null;
}, now = new Date()): boolean {
  if (user.accessTier !== "PAID_FULL" || !user.personalClinicalReconciliationEndsAt) return false;
  const end = new Date(user.personalClinicalReconciliationEndsAt).getTime();
  return Number.isFinite(end) && now.getTime() < end;
}
