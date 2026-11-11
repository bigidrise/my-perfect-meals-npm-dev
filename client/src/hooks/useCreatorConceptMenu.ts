import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { OneTouchConcept, OneTouchCreator, OneTouchRequest } from "@shared/oneTouch";

type Choices = Omit<OneTouchRequest, "creator">;

async function menuPost(path: string, body: unknown) {
  const response = await fetch(apiUrl(`/api/one-touch-create${path}`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Your Menu choices could not be verified.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return payload;
}

function cacheKey(creator: OneTouchCreator, ownerId: string) {
  return `oneTouch.conceptChoices.${creator}.${ownerId}.v1`;
}

function hasSavedChoices(creator: OneTouchCreator, ownerId?: string) {
  if (!ownerId || typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(cacheKey(creator, ownerId)) !== null;
  } catch {
    return false;
  }
}

/** Browser stores choices only. The server is the sole source of concept text and IDs. */
export function useCreatorConceptMenu(
  creator: OneTouchCreator,
  ownerId?: string,
  { recoverSavedChoices = false }: { recoverSavedChoices?: boolean } = {},
) {
  const [concepts, setConcepts] = useState<OneTouchConcept[]>([]);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [generating, setGenerating] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  // A saved request means the server restoration check starts on this mount.
  // Show progress on the first paint, before the effect can begin the request.
  const [restoring, setRestoring] = useState(() => hasSavedChoices(creator, ownerId));
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const epoch = useRef(0);

  useEffect(() => {
    const currentEpoch = ++epoch.current;
    setConcepts([]);
    setChoices(null);
    setGenerating(false);
    setChoosingId(null);
    setRestoring(false);
    setRestoreError(null);
    if (!ownerId) return;
    let stored: Choices | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(cacheKey(creator, ownerId)) || "null");
    } catch { /* Invalid cache never authorizes concepts. */ }
    if (!stored) return;
    setRestoring(true);
    menuPost("/restore", { creator, ...stored })
      .then((payload) => {
        if (epoch.current !== currentEpoch) return;
        if (Array.isArray(payload.concepts) && payload.concepts.length === 3) {
          setChoices(stored);
          setConcepts(payload.concepts);
        } else {
          if (recoverSavedChoices) {
            setRestoreError("These saved ideas could not be verified. Your food context may have changed, or a newer Menu may have replaced them. Retry to check again, or explicitly create a new set.");
          } else {
            localStorage.removeItem(cacheKey(creator, ownerId));
          }
        }
      })
      .catch((error) => {
        // A transport failure is not evidence that saved concepts are stale.
        if (epoch.current === currentEpoch && recoverSavedChoices) {
          setRestoreError(`Your saved choices haven't been removed. ${error?.message || "We couldn't load them right now."} Retry to check again.`);
        }
      })
      .finally(() => { if (epoch.current === currentEpoch) setRestoring(false); });
    return () => { epoch.current++; };
  }, [creator, ownerId, recoverSavedChoices, restoreAttempt]);

  const generate = async (next: Choices) => {
    if (!ownerId) throw new Error("Sign in to use your Menu.");
    // A late restore or earlier Try 3 More response cannot replace these ideas.
    const currentEpoch = ++epoch.current;
    setRestoring(false);
    setGenerating(true);
    try {
      const payload = await menuPost("", { creator, ...next });
      if (!Array.isArray(payload.concepts) || payload.concepts.length !== 3) {
        throw new Error("We couldn't create three governed ideas. Please try again.");
      }
      if (currentEpoch !== epoch.current) return;
      setRestoreError(null);
      setChoices(next);
      setConcepts(payload.concepts);
      localStorage.setItem(cacheKey(creator, ownerId), JSON.stringify(next));
    } finally {
      if (currentEpoch === epoch.current) setGenerating(false);
    }
  };

  const choose = async <T,>(conceptId: string): Promise<T> => {
    if (recoverSavedChoices && restoreError) throw new Error(restoreError);
    if (!choices) throw new Error("Generate your Menu ideas first.");
    const currentEpoch = epoch.current;
    setChoosingId(conceptId);
    try {
      const payload = await menuPost("/choose", {
        request: { creator, ...choices },
        conceptId,
      });
      if (currentEpoch !== epoch.current) throw new Error("Your Menu has changed. Please choose from your current ideas.");
      return payload.meal as T;
    } catch (error) {
      if (currentEpoch === epoch.current && (error as { status?: number }).status === 409 && ownerId) {
        if (recoverSavedChoices) {
          setRestoreError(`${(error as Error).message} Your saved choices haven't been removed. Retry to verify them before choosing again.`);
        } else {
          setConcepts([]);
          setChoices(null);
          localStorage.removeItem(cacheKey(creator, ownerId));
        }
      }
      throw error;
    } finally {
      if (currentEpoch === epoch.current) setChoosingId(null);
    }
  };

  const clear = () => {
    epoch.current++;
    setConcepts([]);
    setChoices(null);
    setGenerating(false);
    setChoosingId(null);
    setRestoring(false);
    setRestoreError(null);
    if (ownerId) localStorage.removeItem(cacheKey(creator, ownerId));
  };

  const retryRestore = () => {
    if (!generating && !choosingId && !restoring) setRestoreAttempt((attempt) => attempt + 1);
  };

  return { concepts, choices, generating, choosingId, restoring, restoreError, retryRestore, generate, choose, clear };
}