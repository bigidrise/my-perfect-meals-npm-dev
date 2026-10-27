/** Server-issued authority only. Never infer pilot enrollment from a plan or role. */
export function hasActiveBusinessPilotAccess(user: {
  businessPilotUnifiedAccess?: boolean;
  businessPilotClinicalAccessEndsAt?: Date | string | null;
  accessTier?: string | null;
} | null | undefined, now = Date.now()): boolean {
  if (!user?.businessPilotUnifiedAccess || user.accessTier !== "PAID_FULL") return false;
  const end = user.businessPilotClinicalAccessEndsAt;
  const timestamp = end instanceof Date ? end.getTime()
    : typeof end === "string" && end.trim() ? Date.parse(end) : NaN;
  return Number.isFinite(timestamp) && now < timestamp;
}
