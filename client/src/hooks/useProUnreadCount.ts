import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthToken } from "@/lib/auth";
import { canPollProfessionalUnread } from "@/lib/proUnreadEligibility";

let cachedCount = 0;
let pollingIdentity: string | null = null;
let terminalIdentity: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(count: number) => void>();

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

  try {
    const token = getAuthToken();
    if (!token) {
      terminalIdentity = identity;
      stopPolling();
      return;
    }

    const res = await fetch("/api/pro/tablet/unread-summary", {
      headers: { "x-auth-token": token },
    });
    if (identity !== pollingIdentity) return;
    if (res.status === 401 || res.status === 403) {
      terminalIdentity = identity;
      stopPolling();
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    if (identity === pollingIdentity) {
      notifyListeners(data.totalUnread ?? 0);
    }
  } catch {
    // Transient network failures can recover on the next scheduled poll.
  }
}

function startPolling(identity: string) {
  if (pollingIdentity !== identity) {
    stopPolling();
    pollingIdentity = identity;
    terminalIdentity = null;
    notifyListeners(0);
  }
  if (pollTimer || terminalIdentity === identity) return;

  void fetchUnread(identity);
  pollTimer = setInterval(() => void fetchUnread(identity), 30_000);
}

export function useProUnreadCount(): number {
  const { user, loading } = useAuth();
  const eligible = !loading && canPollProfessionalUnread(user);
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
      }
    };
  }, [identity]);

  return count;
}