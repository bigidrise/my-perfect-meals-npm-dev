import { useState, useEffect, useCallback } from "react";
import { WeekBoardResponseSchema, createEmptyWeekStructure, getMondayISO, type WeekBoardResponse, type WeekBoard } from "@/../../shared/schema/weeklyBoard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

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

function cacheKey(userId: string, weekStartISO: string): string {
  return `${CACHE_NS}:${userId}:${weekStartISO}`;
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
}: {
  userId: string;
  weekStartISO: string;
  onData: (data: WeekBoardResponse) => void;
  proClientId?: string;
}): Promise<void> {
  const key = cacheKey(proClientId || userId, weekStartISO);
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
        const url = apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStartISO)}`);
        const res = await fetchWithRetry(url, { 
          credentials: "include",
          headers: { ...getAuthHeaders(), ...getAppleReviewHeaders(userId) },
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const json = await res.json();
        const validated = WeekBoardResponseSchema.parse(json);
        
        localStorage.setItem(key, JSON.stringify(validated));
        
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
      const url = apiUrl(`/api/pro/weekly-board/${proClientId}?week=${encodeURIComponent(weekStartISO)}`);
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
}: {
  userId: string;
  weekStartISO: string;
  board: WeekBoard;
  opId?: string;
  proClientId?: string;
}): Promise<WeekBoardResponse> {
  const url = proClientId
    ? apiUrl(`/api/pro/weekly-board/${proClientId}?week=${encodeURIComponent(weekStartISO)}`)
    : apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStartISO)}`);
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
    const key = cacheKey(userId, weekStartISO);
    localStorage.setItem(key, JSON.stringify(validated));
  }

  return validated;
}

export function useWeeklyBoard(userId: string = "1", weekStartISO?: string, proClientId?: string) {
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

  useEffect(() => {
    let mounted = true;

    const handleData = (boardData: WeekBoardResponse) => {
      if (mounted) {
        setData(boardData);
        setLoading(false);
      }
    };

    loadWeeklyBoard({ userId, weekStartISO: monday, onData: handleData, proClientId })
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
  }, [userId, monday, proClientId]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        loadWeeklyBoard({
          userId,
          weekStartISO: monday,
          onData: (result) => { setData(result); setError(null); },
          proClientId,
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
        onData: (result) => { setData(result); setError(null); },
        proClientId,
      }).catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mpm:visibility-resumed", handleMpmResume);

    if (document.visibilityState === "visible") {
      startPolling();
    }

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mpm:visibility-resumed", handleMpmResume);
    };
  }, [userId, monday, proClientId]);

  const save = useCallback(
    async (board: WeekBoard, opId?: string): Promise<void> => {
      try {
        const result = await saveWeeklyBoard({
          userId,
          weekStartISO: monday,
          board,
          opId,
          proClientId,
        });
        setData(result);
        setError(null);
      } catch (e) {
        setError(e as Error);
        throw e;
      }
    },
    [userId, monday, proClientId]
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
      });
    } catch (e) {
      setError(e as Error);
      setData(createEmptyWeekStructure(monday));
    } finally {
      setLoading(false);
    }
  }, [userId, monday, proClientId]);

  return {
    board: data?.week ?? null,
    weekStartISO: monday,
    source: data?.source ?? "seed",
    loading,
    error,
    save,
    refresh,
  };
}
