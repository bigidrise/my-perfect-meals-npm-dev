import { useState, useEffect, useCallback, useRef } from "react";
import { WeekBoardResponseSchema, createEmptyWeekStructure, getMondayISO, type WeekBoardResponse, type WeekBoard } from "@/../../shared/schema/weeklyBoard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { safeBoardCacheWrite } from "@/lib/boardStorage";

const CACHE_NS = "mpm.weeklyBoard";
const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

const APPLE_REVIEW_USER_ID = '00000000-0000-0000-0000-000000000001';

function getAppleReviewHeaders(userId: string): Record<string, string> {
  if (userId === APPLE_REVIEW_USER_ID) {
    return { 'x-apple-review-user': APPLE_REVIEW_USER_ID };
  }
  return {};
}

function cacheKey(userId: string, weekStartISO: string, namespace?: string): string {
  return namespace
    ? `${CACHE_NS}:${namespace}:${userId}:${weekStartISO}`
    : `${CACHE_NS}:${userId}:${weekStartISO}`;
}

function buildWeekUrl(weekStartISO: string, namespace?: string): string {
  const base = `/api/weekly-board?week=${encodeURIComponent(weekStartISO)}`;
  return namespace ? `${base}&bt=${encodeURIComponent(namespace)}` : base;
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchWithTimeout(url, opts);
    } catch (e) {
      lastError = e as Error;
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

function loadWeeklyBoard({
  userId,
  weekStartISO,
  onData,
  proClientId,
  namespace,
}: {
  userId: string;
  weekStartISO: string;
  onData: (data: WeekBoardResponse) => void;
  proClientId?: string;
  namespace?: string;
}): Promise<void> {
  const key = cacheKey(proClientId || userId, weekStartISO, namespace);
  const empty = createEmptyWeekStructure(weekStartISO);

  if (!proClientId) {
    let cached: WeekBoardResponse | null = null;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        cached = WeekBoardResponseSchema.parse(parsed);
        onData(cached);
      } else {
        onData(empty);
      }
    } catch (e) {
      console.warn("Cache parse/validation failed, using empty:", e);
      onData(empty);
    }

    return (async () => {
      try {
        const url = apiUrl(buildWeekUrl(weekStartISO, namespace));
        const res = await fetchWithRetry(url, { 
          credentials: "include",
          headers: { ...getAuthHeaders(), ...getAppleReviewHeaders(userId) },
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        const validated = WeekBoardResponseSchema.parse(json);

        // Cache write is best-effort — must NEVER block the UI update.
        safeBoardCacheWrite(key, JSON.stringify(validated));

        if (JSON.stringify(validated) !== JSON.stringify(cached)) {
          onData(validated);
        }
      } catch (e) {
        console.warn("Weekly board refresh failed (using cached/empty):", e);
        throw e;
      }
    })();
  }

  onData(empty);
  return (async () => {
    try {
      const btPart = namespace ? `&bt=${encodeURIComponent(namespace)}` : '';
      const url = apiUrl(`/api/pro/weekly-board/${proClientId}?week=${encodeURIComponent(weekStartISO)}${btPart}`);
      const res = await fetchWithRetry(url, {
        credentials: "include",
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const validated = WeekBoardResponseSchema.parse(json);
      onData(validated);
    } catch (e) {
      console.warn("Pro weekly board load failed:", e);
      throw e;
    }
  })();
}

async function saveWeeklyBoard({
  userId,
  weekStartISO,
  board,
  opId,
  proClientId,
  namespace,
}: {
  userId: string;
  weekStartISO: string;
  board: WeekBoard;
  opId?: string;
  proClientId?: string;
  namespace?: string;
}): Promise<WeekBoardResponse> {
  const btPart = namespace ? `&bt=${encodeURIComponent(namespace)}` : '';
  const url = proClientId
    ? apiUrl(`/api/pro/weekly-board/${proClientId}?week=${encodeURIComponent(weekStartISO)}${btPart}`)
    : apiUrl(buildWeekUrl(weekStartISO, namespace));
  const payload = { week: board, opId };

  const res = await fetchWithRetry(url, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(proClientId ? {} : getAppleReviewHeaders(userId)),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const validated = WeekBoardResponseSchema.parse(json);

  if (!proClientId) {
    const key = cacheKey(userId, weekStartISO, namespace);
    safeBoardCacheWrite(key, JSON.stringify(validated));
  }

  return validated;
}

export function useWeeklyBoard(userId: string = "1", weekStartISO?: string, proClientId?: string, namespace?: string) {
  const monday = weekStartISO ?? (() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum);
    return d.toISOString().slice(0, 10);
  })();
  const [data, setData] = useState<WeekBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // saveCooldownRef stores the timestamp until which background board reloads must not
  // overwrite local state. Set to now+30s at save start, dropped to now+1.5s after save
  // completes. Checked only by background/resume loaders — NOT by initial load or save().
  const saveCooldownRef = useRef<number>(0);
  // requestVersionRef prevents stale week responses from overwriting newer week data
  // when the user navigates weeks quickly.
  const requestVersionRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    // Do NOT clear data to null here — keep the previous week visible while the
    // next week loads so the board never flashes blank during week navigation.
    setLoading(true);
    const version = ++requestVersionRef.current;

    const handleData = (boardData: WeekBoardResponse) => {
      if (mounted && version === requestVersionRef.current) {
        setData(boardData);
        setLoading(false);
      }
    };

    loadWeeklyBoard({ userId, weekStartISO: monday, onData: handleData, proClientId, namespace })
      .catch((e) => {
        if (mounted) {
          setError(e as Error);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [userId, monday, proClientId, namespace]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        loadWeeklyBoard({
          userId,
          weekStartISO: monday,
          onData: (result) => {
            if (Date.now() < saveCooldownRef.current) return;
            setData(result);
            setError(null);
          },
          proClientId,
          namespace,
        }).catch(() => {});
      }, 45_000);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleMpmResume = () => {
      loadWeeklyBoard({
        userId,
        weekStartISO: monday,
        onData: (result) => {
          if (Date.now() < saveCooldownRef.current) return;
          setData(result);
          setError(null);
        },
        proClientId,
        namespace,
      }).catch(() => {});
    };

    // Instant board patch when a meal is added via "Add to Plan"
    const handleBoardSlotAdded = (e: Event) => {
      const { weekStartISO: eventWeek, dateISO, slot, updatedDay } = (e as CustomEvent).detail || {};
      if (!dateISO || !slot || !updatedDay) return;
      // Only patch if this hook is tracking the same week
      if (eventWeek && eventWeek !== monday) return;
      setData(prev => {
        if (!prev) return prev;
        const prevWeek = prev.week;
        const updatedDays = {
          ...(prevWeek.days || {}),
          [dateISO]: updatedDay,
        };
        const patched = { ...prevWeek, days: updatedDays };
        // Sync localStorage
        const key = namespace
          ? `${CACHE_NS}:${namespace}:${proClientId || userId}:${monday}`
          : `${CACHE_NS}:${proClientId || userId}:${monday}`;
        safeBoardCacheWrite(key, JSON.stringify({ ...prev, week: patched }));
        return { ...prev, week: patched };
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mpm:visibility-resumed", handleMpmResume);
    window.addEventListener("mpm:board-slot-added", handleBoardSlotAdded);

    if (document.visibilityState === "visible") {
      startPolling();
    }

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mpm:visibility-resumed", handleMpmResume);
      window.removeEventListener("mpm:board-slot-added", handleBoardSlotAdded);
    };
  }, [userId, monday, proClientId, namespace]);

  const save = useCallback(
    async (board: WeekBoard, opId?: string): Promise<void> => {
      // Block background reloads for up to 30s while save is in flight
      saveCooldownRef.current = Date.now() + 30_000;
      try {
        const result = await saveWeeklyBoard({
          userId,
          weekStartISO: monday,
          board,
          opId,
          proClientId,
          namespace,
        });
        setData(result);
        setError(null);
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        // Whether save succeeded or failed, allow background reloads after a short grace period
        saveCooldownRef.current = Date.now() + 1_500;
      }
    },
    [userId, monday, proClientId, namespace]
  );

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await loadWeeklyBoard({ 
        userId, 
        weekStartISO: monday,
        onData: (result) => {
          setData(result);
          setError(null);
        },
        proClientId,
        namespace,
      });
    } catch (e) {
      setError(e as Error);
      setData(createEmptyWeekStructure(monday));
    } finally {
      setLoading(false);
    }
  }, [userId, monday, proClientId, namespace]);

  const primeCache = useCallback((targetWeekISO: string, data: WeekBoardResponse): void => {
    if (proClientId) return;
    const key = cacheKey(userId, targetWeekISO, namespace);
    safeBoardCacheWrite(key, JSON.stringify(data));
  }, [userId, proClientId, namespace]);

  return {
    board: data?.week ?? null,
    weekStartISO: monday,
    source: data?.source ?? "seed",
    loading,
    error,
    save,
    refresh,
    primeCache,
  };
}
