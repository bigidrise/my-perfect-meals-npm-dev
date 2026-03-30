import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export function useBoardLockStatus(): { locked: boolean; loading: boolean } {
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/me/board-lock"), {
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
  }, []);

  return { locked, loading };
}
