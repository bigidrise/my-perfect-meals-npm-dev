import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

/**
 * Workspace-aware board lock status hook.
 *
 * When proClientId is provided (pro operating inside a client workspace),
 * reads lock status from the client's workspace endpoint:
 *   GET /api/pro/clients/:proClientId/board-lock
 *
 * When proClientId is absent (client viewing their own board),
 * reads from the self-scoped endpoint:
 *   GET /api/me/board-lock
 *
 * Architecture: never mix self-context and workspace-context on the same page.
 */
export function useBoardLockStatus(proClientId?: string): { locked: boolean; loading: boolean } {
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = proClientId
      ? apiUrl(`/api/pro/clients/${proClientId}/board-lock`)
      : apiUrl("/api/me/board-lock");

    fetch(url, {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { locked: false }))
      .then((data) => {
        if (!cancelled) {
          setLocked(!!data?.locked);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [proClientId]);

  return { locked, loading };
}
