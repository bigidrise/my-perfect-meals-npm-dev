import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { canPollProfessionalUnread } from "@/lib/proUnreadEligibility";
import { developmentProUnreadAuthorizationEnabled } from "@/features/proUnreadFlag";

let cachedCount = 0;
let pollingIdentity: string | null = null;
let terminalIdentity: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(count: number) => void>();
let pollingEpoch = 0;
let inFlightEpoch: number | null = null;

function notifyListeners(count: number) {
  cachedCount = count;
  listeners.forEach(listener => listener(count));
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function fetchUnread(identity: string) {
  if (identity !== pollingIdentity || terminalIdentity === identity) return;
  const epoch = pollingEpoch;
  if (developmentProUnreadAuthorizationEnabled && inFlightEpoch === epoch) return;
  if (developmentProUnreadAuthorizationEnabled) inFlightEpoch = epoch;
  const isCurrent = () => identity === pollingIdentity &&
    (!developmentProUnreadAuthorizationEnabled || epoch === pollingEpoch);

  try {
    const res = await fetch("/api/pro/tablet/unread-summary", {
      headers: getAuthHeaders(),
      credentials: "include",
    });
    if (!isCurrent()) return;
    if (res.status === 401 || res.status === 403) {
      terminalIdentity = identity;
      stopPolling();
      if (developmentProUnreadAuthorizationEnabled) notifyListeners(0);
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    if (isCurrent()) {
      if (developmentProUnreadAuthorizationEnabled &&
          (!Number.isSafeInteger(data.totalUnread) || data.totalUnread < 0)) return;
      notifyListeners(data.totalUnread ?? 0);
    }
  } catch {
    // Transient network failures can recover on the next scheduled poll.
  } finally {
    if (developmentProUnreadAuthorizationEnabled && isCurrent()) {
      inFlightEpoch = null;
      // Wait for the authorization response before scheduling another request.
      // A denied identity stays stopped; transient failures retry at normal cadence.
      if (terminalIdentity !== identity && listeners.size > 0 && !pollTimer) {
        pollTimer = setInterval(() => void fetchUnread(identity), 30_000);
      }
    }
  }
}

function startPolling(identity: string) {
  if (pollingIdentity !== identity) {
    stopPolling();
    pollingIdentity = identity;
    terminalIdentity = null;
    if (developmentProUnreadAuthorizationEnabled) {
      pollingEpoch++;
      inFlightEpoch = null;
    }
    notifyListeners(0);
  }
  if (pollTimer || terminalIdentity === identity) return;

  void fetchUnread(identity);
  if (!developmentProUnreadAuthorizationEnabled) {
    pollTimer = setInterval(() => void fetchUnread(identity), 30_000);
  }
}

export function useProUnreadCount(): number {
  const { user, loading } = useAuth();
  const eligible = !loading && canPollProfessionalUnread(user, developmentProUnreadAuthorizationEnabled);
  const identity = eligible ? user!.id : null;
  const [count, setCount] = useState(
    identity && pollingIdentity === identity ? cachedCount : 0,
  );

  useEffect(() => {
    if (!identity) {
      setCount(0);
      return;
    }

    const handler = (nextCount: number) => setCount(nextCount);
    listeners.add(handler);
    startPolling(identity);
    setCount(pollingIdentity === identity ? cachedCount : 0);

    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) {
        stopPolling();
        pollingIdentity = null;
        terminalIdentity = null;
        cachedCount = 0;
        if (developmentProUnreadAuthorizationEnabled) {
          pollingEpoch++;
          inFlightEpoch = null;
        }
      }
    };
  }, [identity]);

  return developmentProUnreadAuthorizationEnabled &&
    (!identity || pollingIdentity !== identity) ? 0 : count;
}