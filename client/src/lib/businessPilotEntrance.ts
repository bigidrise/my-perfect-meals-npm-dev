// Navigation state only. These values never grant access or replace server checks.
import { BUSINESS_PARTNER_PILOT_TOKEN } from "@shared/businessPartnerPilot";
export const BUSINESS_PILOT_PATH = "/activate/business-pilot";
export const BUSINESS_PILOT_TOKEN_KEY = "mpm.founderBusinessPilotToken";
const RETURN_KEY = "mpm.founderBusinessPilotReturnTo";
const ORGANIZATION_ENTRY_KEY = "mpm.businessPilotOrganizationEntry";
type EntranceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const validToken = (value: string | null): value is string =>
  value !== null && (value === BUSINESS_PARTNER_PILOT_TOKEN || /^[a-f0-9]{64}$/.test(value));

export function captureBusinessPilotInvitation(
  storage: EntranceStorage,
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
) {
  const fragment = new URLSearchParams(location.hash.slice(1)).get("token");
  if (fragment !== null) {
    history.replaceState({}, "", location.pathname + location.search);
    if (!validToken(fragment)) {
      storage.removeItem(BUSINESS_PILOT_TOKEN_KEY);
      storage.removeItem(RETURN_KEY);
      throw new Error("This invitation link is invalid.");
    }
    storage.setItem(BUSINESS_PILOT_TOKEN_KEY, fragment);
    storage.setItem(RETURN_KEY, BUSINESS_PILOT_PATH);
    storage.removeItem(ORGANIZATION_ENTRY_KEY);
  }
  const token = storage.getItem(BUSINESS_PILOT_TOKEN_KEY);
  if (!validToken(token)) return null;
  storage.setItem(RETURN_KEY, BUSINESS_PILOT_PATH);
  return token;
}

export function businessPilotAuthDestination(mode: "login" | "signup") {
  return `/auth?mode=${mode}&returnTo=${encodeURIComponent(BUSINESS_PILOT_PATH)}`;
}

export function pendingBusinessPilotReturn(
  storage: EntranceStorage, development: boolean, explicitReturnTo: string | null,
) {
  if (!development || (explicitReturnTo && explicitReturnTo !== BUSINESS_PILOT_PATH)) return null;
  if (!validToken(storage.getItem(BUSINESS_PILOT_TOKEN_KEY))) return null;
  return explicitReturnTo === BUSINESS_PILOT_PATH || storage.getItem(RETURN_KEY) === BUSINESS_PILOT_PATH
    ? BUSINESS_PILOT_PATH : null;
}

export function clearBusinessPilotInvitation(storage: EntranceStorage) {
  storage.removeItem(BUSINESS_PILOT_TOKEN_KEY);
  storage.removeItem(RETURN_KEY);
}

export function startBusinessPilotOrganizationEntry(storage: EntranceStorage, userId: string) {
  // Short-lived, account-bound onboarding continuation, not cached permission.
  storage.setItem(ORGANIZATION_ENTRY_KEY, JSON.stringify({
    userId, expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  }));
}

export function isBusinessPilotOrganizationEntry(
  storage: EntranceStorage, development: boolean, path: string, userId?: string,
) {
  if (!development || path !== "/more" || !userId) return false;
  try {
    const value = JSON.parse(storage.getItem(ORGANIZATION_ENTRY_KEY) || "null");
    return value?.userId === userId && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now();
  } catch { return false; }
}

export function clearBusinessPilotOrganizationEntry(storage: EntranceStorage) {
  storage.removeItem(ORGANIZATION_ENTRY_KEY);
}
