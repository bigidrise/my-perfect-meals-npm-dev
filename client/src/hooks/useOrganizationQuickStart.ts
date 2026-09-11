import { useCallback, useEffect, useMemo, useState } from "react";

export const ORGANIZATION_QUICK_START_VERSION = 1;

type QuickStartStorage = Pick<Storage, "getItem" | "setItem">;

export function organizationQuickStartDismissKey(userId: string) {
  return `mpm.dismiss.organizationQuickStart.v${ORGANIZATION_QUICK_START_VERSION}::${userId}`;
}

export function organizationQuickStartSessionKey(userId: string) {
  return `mpm.session.organizationQuickStart.v${ORGANIZATION_QUICK_START_VERSION}::${userId}`;
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

  const open = useCallback(() => setIsOpen(true), []);

  return { isOpen, open, close };
}