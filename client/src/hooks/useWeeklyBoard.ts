import { useState, useEffect, useCallback } from "react";
import { WeekBoardResponseSchema, createEmptyWeekStructure, getMondayISO, type WeekBoardResponse, type WeekBoard } from "@/../../shared/schema/weeklyBoard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

const CACHE_NS = "mpm.weeklyBoard";
const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

// Apple Review mode user ID - must match server
const APPLE_REVIEW_USER_ID = '00000000-0000-0000-0000-000000000001';

// Helper to get Apple Review headers if applicable
function getAppleReviewHeaders(userId: string): Record<string, string> {
  if (userId === APPLE_REVIEW_USER_ID) {
    return { 'x-apple-review-user': APPLE_REVIEW_USER_ID };
  }
  return {};
}

// Cache key helper
function cacheKey(userId: string, weekStartISO: string): string {
  return `${CACHE_NS}:${userId}:${weekStartISO}`;
}

// Fetch with timeout and abort controller
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

// Retry wrapper with exponential backoff
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

// Load weekly board with instant cache-first strategy
function loadWeeklyBoard({
  userId,
  weekStartISO,
  onData,
}: {
  userId: string;
  weekStartISO: string;
  onData: (data: WeekBoardResponse) => void;
}): Promise<void> {
  const key = cacheKey(userId, weekStartISO);
  const empty = createEmptyWeekStructure(weekStartISO);

  // 1) INSTANT: Try cache first and emit immediately
  let cached: WeekBoardResponse | null = null;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate with Zod
      cached = WeekBoardResponseSchema.parse(parsed);
      onData(cached); // Emit cached data immediately
    } else {
      onData(empty); // Emit empty seed immediately
    }
  } catch (e) {
    console.warn("Cache parse/validation failed, using empty:", e);
    onData(empty); // Emit empty seed on cache error
  }

  // 2) BACKGROUND: Refresh from server with retries
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
      
      // Update cache
      localStorage.setItem(key, JSON.stringify(validated));
      
      // Emit fresh data if different from cache
      if (JSON.stringify(validated) !== JSON.stringify(cached)) {
        onData(validated);
      }
    } catch (e) {
      // Soft fail: keep cached/empty already emitted
      console.warn("Weekly board refresh failed (using cached/empty):", e);
      throw e; // Propagate for error state
    }
  })();
}

// Save weekly board with idempotent operation ID
async function saveWeeklyBoard({
  userId,
  weekStartISO,
  board,
  opId,
}: {
  userId: string;
  weekStartISO: string;
  board: WeekBoard;
  opId?: string;
}): Promise<WeekBoardResponse> {
  const url = apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStartISO)}`);
  const payload = { week: board, opId };

  const res = await fetchWithRetry(url, {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...getAppleReviewHeaders(userId),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const validated = WeekBoardResponseSchema.parse(json);

  // Update cache
  const key = cacheKey(userId, weekStartISO);
  localStorage.setItem(key, JSON.stringify(validated));

  return validated;
}

// Main hook - weekStartISO should be provided by caller for correct runtime date
// Fallback uses getCurrentWeekStartISO() which is computed at call time
export function useWeeklyBoard(userId: string = "1", weekStartISO?: string) {
  // Import dynamically to avoid build-time evaluation
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

  // Load board with instant cache-first
  useEffect(() => {
    let mounted = true;

    // Callback to receive data instantly from cache
    const handleData = (boardData: WeekBoardResponse) => {
      if (mounted) {
        setData(boardData);
        setLoading(false);
      }
    };

    // Start load (emits cached data immediately, then refreshes in background)
    loadWeeklyBoard({ userId, weekStartISO: monday, onData: handleData })
      .catch((e) => {
        if (mounted) {
          setError(e as Error);
          // Data already set from cache/empty by onData callback
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
  }, [userId, monday]);

  // Save board callback
  const save = useCallback(
    async (board: WeekBoard, opId?: string): Promise<void> => {
      try {
        const result = await saveWeeklyBoard({
          userId,
          weekStartISO: monday,
          board,
          opId,
        });
        setData(result);
        setError(null);
      } catch (e) {
        setError(e as Error);
        throw e;
      }
    },
    [userId, monday]
  );

  // Refresh callback
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await loadWeeklyBoard({ 
        userId, 
        weekStartISO: monday,
        onData: (result) => {
          setData(result);
          setError(null);
        }
      });
    } catch (e) {
      setError(e as Error);
      setData(createEmptyWeekStructure(monday));
    } finally {
      setLoading(false);
    }
  }, [userId, monday]);

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
