import { useState, useEffect, useRef } from "react";
import { getAuthToken } from "@/lib/auth";

let cachedCount = 0;
const listeners = new Set<(count: number) => void>();

function notifyListeners(count: number) {
  cachedCount = count;
  listeners.forEach((fn) => fn(count));
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeListeners = 0;

async function fetchUnread() {
  try {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch("/api/pro/tablet/unread-summary", {
      headers: { "x-auth-token": token },
    });
    if (!res.ok) return;
    const data = await res.json();
    notifyListeners(data.totalUnread ?? 0);
  } catch {
  }
}

export function useProUnreadCount(): number {
  const [count, setCount] = useState(cachedCount);

  useEffect(() => {
    const handler = (n: number) => setCount(n);
    listeners.add(handler);
    activeListeners++;

    if (!pollTimer) {
      fetchUnread();
      pollTimer = setInterval(fetchUnread, 30_000);
    }

    return () => {
      listeners.delete(handler);
      activeListeners--;
      if (activeListeners === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, []);

  return count;
}
