import { useCallback, useEffect, useMemo, useState } from "react";

export const ORGANIZATION_QUICK_START_VERSION = 1;

type QuickStartStorage = Pick<Storage, "getItem" | "setItem">;
type JourneyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ORGANIZATION_QUICK_START_JOURNEY_VERSION = 1;
export const ORGANIZATION_QUICK_START_JOURNEY_TTL_MS = 2 * 60 * 60 * 1000;

export type OrganizationQuickStartJourney = {
  version: 1;
  userId: string;
  organizationId: string;
  originStep: number;
  continuationStep: number;
  destinationPath: string;
  startedAt: number;
  expiresAt: number;
};

export function organizationQuickStartDismissKey(userId: string) {
  return `mpm.dismiss.organizationQuickStart.v${ORGANIZATION_QUICK_START_VERSION}::${userId}`;
}

export function organizationQuickStartSessionKey(userId: string) {
  return `mpm.session.organizationQuickStart.v${ORGANIZATION_QUICK_START_VERSION}::${userId}`;
}

export function organizationQuickStartJourneyKey(userId: string, organizationId: string) {
  return `mpm.session.organizationQuickStartJourney.v${ORGANIZATION_QUICK_START_JOURNEY_VERSION}::${userId}::${organizationId}`;
}

export function startOrganizationQuickStartJourney(
  storage: JourneyStorage,
  input: Omit<OrganizationQuickStartJourney, "version" | "startedAt" | "expiresAt">,
  now = Date.now(),
) {
  const journey: OrganizationQuickStartJourney = {
    ...input,
    version: ORGANIZATION_QUICK_START_JOURNEY_VERSION,
    startedAt: now,
    expiresAt: now + ORGANIZATION_QUICK_START_JOURNEY_TTL_MS,
  };
  storage.setItem(organizationQuickStartJourneyKey(input.userId, input.organizationId), JSON.stringify(journey));
  return journey;
}

export function readOrganizationQuickStartJourney(
  storage: JourneyStorage,
  userId: string,
  organizationId: string,
  destinationPath?: string,
  now = Date.now(),
) {
  const key = organizationQuickStartJourneyKey(userId, organizationId);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const journey = JSON.parse(raw) as Partial<OrganizationQuickStartJourney>;
    const valid = journey.version === ORGANIZATION_QUICK_START_JOURNEY_VERSION
      && journey.userId === userId
      && journey.organizationId === organizationId
      && typeof journey.originStep === "number"
      && typeof journey.continuationStep === "number"
      && typeof journey.destinationPath === "string"
      && typeof journey.expiresAt === "number"
      && journey.expiresAt > now
      && (!destinationPath || journey.destinationPath === destinationPath);
    if (valid) return journey as OrganizationQuickStartJourney;
  } catch {
    // Invalid temporary UX state is discarded below.
  }
  storage.removeItem(key);
  return null;
}

export function clearOrganizationQuickStartJourney(
  storage: JourneyStorage,
  userId: string,
  organizationId: string,
) {
  storage.removeItem(organizationQuickStartJourneyKey(userId, organizationId));
}

export function shouldAutoOpenOrganizationQuickStart(
  userId: string,
  persistentStorage: QuickStartStorage,
  currentSessionStorage: QuickStartStorage,
) {
  return persistentStorage.getItem(organizationQuickStartDismissKey(userId)) !== "dismissed"
    && currentSessionStorage.getItem(organizationQuickStartSessionKey(userId)) !== "shown";
}

export function markOrganizationQuickStartShown(
  userId: string,
  currentSessionStorage: QuickStartStorage,
) {
  currentSessionStorage.setItem(organizationQuickStartSessionKey(userId), "shown");
}

export function disableOrganizationQuickStartAutoOpen(
  userId: string,
  persistentStorage: QuickStartStorage,
) {
  persistentStorage.setItem(organizationQuickStartDismissKey(userId), "dismissed");
}

export function useOrganizationQuickStart(userId?: string | null) {
  const [isOpen, setIsOpen] = useState(false);
  const [continuationStep, setContinuationStep] = useState(0);
  const dismissKey = useMemo(
    () => (userId ? organizationQuickStartDismissKey(userId) : null),
    [userId],
  );
  const sessionKey = useMemo(
    () => (userId ? organizationQuickStartSessionKey(userId) : null),
    [userId],
  );

  useEffect(() => {
    if (!dismissKey || !sessionKey) return;
    if (userId && shouldAutoOpenOrganizationQuickStart(userId, localStorage, sessionStorage)) {
      markOrganizationQuickStartShown(userId, sessionStorage);
      setIsOpen(true);
    }
  }, [dismissKey, sessionKey, userId]);

  const close = useCallback((disableFutureAutoOpen: boolean) => {
    if (disableFutureAutoOpen && userId) {
      disableOrganizationQuickStartAutoOpen(userId, localStorage);
    }
    setIsOpen(false);
  }, [userId]);

  const open = useCallback((step = 0) => {
    setContinuationStep(step);
    setIsOpen(true);
  }, []);

  return { isOpen, continuationStep, open, close };
}