// client/src/hooks/useMacroTargetSync.ts
// Background sync: detects when a pro has updated a client's macro targets in the
// DB (from their Studio) and pushes the change into proStore so every client-side
// surface (RemainingMacrosFooter, DailyTargetsCard, Biometrics) reflects it
// immediately — without a page refresh.
//
// Trigger points:
//   1. On mount (catches targets set while the app was closed / tab was inactive)
//   2. On document visibilitychange → visible (catches pro saving in another tab)
//   3. Every 45 s polling interval (catches cross-device saves)

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { proStore } from "@/lib/proData";
import { getResolvedTargets, clearResolvedTargetsCache } from "@/lib/macroResolver";
import { getAuthHeaders } from "@/lib/auth";

const POLL_INTERVAL_MS = 45_000;
const LS_USER_CLIENT_MAP = "mpm_user_client_map";

function getClientId(userId: string): string | null {
  try {
    const map: Record<string, string> = JSON.parse(
      localStorage.getItem(LS_USER_CLIENT_MAP) || "{}"
    );
    return map[userId] || null;
  } catch {
    return null;
  }
}

export function useMacroTargetSync() {
  const { user } = useAuth();
  const userIdRef = useRef<string | undefined>(undefined);
  const isProCareRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    userIdRef.current = user?.id;
    isProCareRef.current = !!(user as any)?.isProCare;
  }, [user?.id, (user as any)?.isProCare]);

  useEffect(() => {
    const sync = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      // Protocol Ownership Model: if the user is no longer connected to a physician,
      // strip any stale physician medical flags from localStorage so they don't
      // persist across sessions and incorrectly activate clinical protocols.
      if (isProCareRef.current === false) {
        const clientId = getClientId(userId);
        if (clientId) {
          const stripped = proStore.stripMedicalFlags(clientId);
          if (stripped) {
            clearResolvedTargetsCache();
            window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));
            console.log("[MacroTargetSync] Stripped stale physician medical flags — ProCare ended.");
          }
        }
      }

      // Only sync for clients who are linked to a pro (have a clientId mapping).
      // Self-managed clients update their own localStorage directly via Macro Calculator
      // and fire mpm:targetsUpdated in the same session — no sync needed.
      const clientId = getClientId(userId);
      if (!clientId) return;

      try {
        const res = await fetch(`/api/users/${userId}/macro-targets`, {
          credentials: "include",
          headers: { ...getAuthHeaders() },
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.hasTargets) return;

        // Compare API values with what the resolver currently sees
        const current = getResolvedTargets(userId);
        const apiProtein   = Math.round(data.protein_g ?? 0);
        const apiFat       = Math.round(data.fat_g ?? 0);
        const apiStarchy   = Math.round(data.starchyCarbs_g ?? 0);
        const apiFibrous   = Math.round(data.fibrousCarbs_g ?? 0);

        const curProtein   = Math.round(current.protein_g ?? 0);
        const curFat       = Math.round(current.fat_g ?? 0);
        const curStarchy   = Math.round(current.starchyCarbs_g ?? 0);
        const curFibrous   = Math.round(current.fibrousCarbs_g ?? 0);

        const unchanged =
          apiProtein === curProtein &&
          apiFat     === curFat     &&
          apiStarchy === curStarchy &&
          apiFibrous === curFibrous;

        if (unchanged) return;

        // Targets changed in the DB — push into proStore so resolver picks them up
        proStore.setTargets(clientId, {
          protein:      apiProtein,
          starchyCarbs: apiStarchy,
          fibrousCarbs: apiFibrous,
          fat:          apiFat,
        });

        clearResolvedTargetsCache();
        window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));

        console.log(
          "[MacroTargetSync] Targets updated from API →",
          `protein=${apiProtein} starchy=${apiStarchy} fibrous=${apiFibrous} fat=${apiFat}`
        );
      } catch {
        // Silent — network failures should not surface to the user
      }
    };

    // 1. Sync immediately on mount
    sync();

    // 2. Sync when the tab regains focus (pro saved in another tab)
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 3. Poll on an interval for cross-device syncs
    const interval = setInterval(sync, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [user?.id]);
}
