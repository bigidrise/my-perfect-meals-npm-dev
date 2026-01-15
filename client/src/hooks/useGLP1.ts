import { useState, useEffect, useCallback, useRef } from "react";
import { get, put } from "@/lib/api";
import type { GLP1Guardrails } from "../../../shared/glp1-schema";
import { DEFAULT_GLP1_GUARDRAILS } from "../../../shared/glp1-schema";

const LS_KEY = "mpm_glp1_profile_v1";

function loadLocalProfile(): GLP1Guardrails {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_GLP1_GUARDRAILS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_GLP1_GUARDRAILS };
}

function saveLocalProfile(guardrails: GLP1Guardrails): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(guardrails));
  } catch {}
}

export function useGLP1Profile() {
  const [guardrails, setGuardrails] = useState<GLP1Guardrails>(() => loadLocalProfile());
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    
    let cancelled = false;
    const syncFromServer = async () => {
      setSyncStatus("syncing");
      try {
        const result = await get<{ guardrails: GLP1Guardrails }>("/api/glp1/profile");
        if (!cancelled && result?.guardrails) {
          const merged = { ...DEFAULT_GLP1_GUARDRAILS, ...result.guardrails };
          setGuardrails(merged);
          saveLocalProfile(merged);
          setSyncStatus("synced");
        }
      } catch (e) {
        if (!cancelled) {
          setSyncStatus("error");
        }
      }
    };
    syncFromServer();
    return () => { cancelled = true; };
  }, []);

  const updateGuardrails = useCallback((newGuardrails: GLP1Guardrails) => {
    setGuardrails(newGuardrails);
    saveLocalProfile(newGuardrails);
  }, []);

  return {
    data: { guardrails },
    isLoading: false,
    error: null,
    syncStatus,
    updateGuardrails,
  };
}

export function useSaveGLP1Profile(updateGuardrails?: (g: GLP1Guardrails) => void) {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async (guardrails: GLP1Guardrails) => {
    setIsPending(true);
    saveLocalProfile(guardrails);
    if (updateGuardrails) {
      updateGuardrails(guardrails);
    }
    try {
      await put("/api/glp1/profile", { guardrails });
    } catch {
    }
    setIsPending(false);
  }, [updateGuardrails]);

  return {
    mutate,
    isPending,
  };
}
