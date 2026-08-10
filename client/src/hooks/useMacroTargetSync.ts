// client/src/hooks/useMacroTargetSync.ts
// Background sync: keeps every client-side surface in sync with the server/DB.
//
// Authority model:
//   1. Active ProCare target override (trainer/physician set in Studio)
//   2. Server/DB macro targets (Macro Calculator saves go here)
//   3. localStorage — a cache/fallback ONLY, never the permanent authority
//
// The rule: the server ALWAYS wins for self-managed users. localStorage is
// written FROM the server, not FROM localStorage. This means:
//   - Stale values written weeks ago are overwritten on every sync
//   - Cross-device changes (saved on phone, opened on desktop) propagate correctly
//
// Trigger points:
//   1. On mount (catches targets set while the app was closed / tab was inactive)
//   2. On document visibilitychange → visible (catches pro saving in another tab)
//   3. Every 45 s polling interval (catches cross-device saves)

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { proStore } from "@/lib/proData";
import { getNutritionBaseline, clearResolvedTargetsCache, unlinkUser } from "@/lib/macroResolver";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/apiRequest";

const POLL_INTERVAL_MS = 45_000;
const LS_USER_CLIENT_MAP = "mpm_user_client_map";
const TARGETS_LS_KEY = (userId: string) => `mpm.macroTargets.${userId}`;

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

      // Protocol Ownership Model: if the user is no longer connected to ProCare,
      // clear the stale client mapping AND strip any physician medical flags from
      // localStorage so they don't persist and incorrectly attribute macro targets
      // or clinical protocols to a physician/professional.
      if (isProCareRef.current === false) {
        const clientId = getClientId(userId);
        if (clientId) {
          proStore.stripMedicalFlags(clientId);
          unlinkUser(userId);
          clearResolvedTargetsCache();
          window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));
          console.log("[MacroTargetSync] Cleared ProCare mapping — isProCare=false, stale clientId removed.");
        }
      }

      const clientId = getClientId(userId);

      if (!clientId) {
        // Self-managed user: server/DB is always the authority.
        // localStorage is a fast cache — we always refresh it from the server so
        // stale values (set weeks ago, on another device, or by an old build) never
        // persist. We previously bailed out early when localStorage had any value,
        // which made stale cache permanent. That guard is gone.
        try {
          const data = await apiRequest(`/api/users/${userId}/macro-targets`, { cache: "no-store" });
          if (!data.hasTargets) return; // Server has no targets; nothing to sync.

          // Build the authoritative target object from server data.
          const freshTargets = {
            calories: data.calories ?? 0,
            protein_g: data.protein_g ?? 0,
            carbs_g: data.carbs_g ?? 0,
            fat_g: data.fat_g ?? 0,
            starchyCarbs_g: data.starchyCarbs_g ?? 0,
            fibrousCarbs_g: data.fibrousCarbs_g ?? 0,
            ...(data.cutIntensity && { cutIntensity: data.cutIntensity }),
            ...(data.cutStyle && { cutStyle: data.cutStyle }),
            ...(data.cycleMode && { cycleMode: data.cycleMode }),
            ...(data.cycleDayType && { cycleDayType: data.cycleDayType }),
            ...(data.mealsPerDay && { mealsPerDay: data.mealsPerDay }),
          };

          // Compare against the current localStorage cache. Only write + emit when
          // values have actually changed — avoids thrashing the resolver and
          // re-rendering every surface on every 45-second poll tick.
          let changed = true;
          try {
            const stored = localStorage.getItem(TARGETS_LS_KEY(userId));
            if (stored) {
              const cached = JSON.parse(stored);
              changed = (
                Math.round(cached.calories      ?? 0) !== Math.round(freshTargets.calories)      ||
                Math.round(cached.protein_g     ?? 0) !== Math.round(freshTargets.protein_g)     ||
                Math.round(cached.fat_g         ?? 0) !== Math.round(freshTargets.fat_g)         ||
                Math.round(cached.starchyCarbs_g ?? 0) !== Math.round(freshTargets.starchyCarbs_g) ||
                Math.round(cached.fibrousCarbs_g ?? 0) !== Math.round(freshTargets.fibrousCarbs_g)
              );
            }
          } catch { /* treat as changed */ }

          if (!changed) return;

          localStorage.setItem(TARGETS_LS_KEY(userId), JSON.stringify(freshTargets));
          clearResolvedTargetsCache();
          window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));

          console.log(
            "[MacroTargetSync] Self-managed targets refreshed from server →",
            `protein=${freshTargets.protein_g} carbs=${freshTargets.carbs_g} fat=${freshTargets.fat_g}`,
            `starchy=${freshTargets.starchyCarbs_g} fibrous=${freshTargets.fibrousCarbs_g}`
          );
        } catch {
          // Silent — network failures should not surface to the user
        }

        return;
      }

      // ProCare client: sync from DB into proStore
      try {
        const data = await apiRequest(`/api/users/${userId}/macro-targets`, { cache: "no-store" });
        if (!data.hasTargets) return;

        // Compare API values with what the resolver currently sees
        const current = getNutritionBaseline(userId);
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
          "[MacroTargetSync] ProCare targets updated from API →",
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
