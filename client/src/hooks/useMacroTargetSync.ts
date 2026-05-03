// client/src/hooks/useMacroTargetSync.ts
// Background sync: detects when a pro has updated a client's macro targets in the
// DB (from their Studio) and pushes the change into proStore so every client-side
// surface (RemainingMacrosFooter, DailyTargetsCard, Biometrics) reflects it
// immediately — without a page refresh.
//
// Also handles cross-device hydration for self-managed users: on mount, if
// localStorage has no macro targets (e.g. fresh desktop browser), it fetches
// from the server and writes to localStorage so NutritionBudgetBanner and all
// other target-dependent surfaces appear correctly.
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

function hasSelfTargetsInLocalStorage(userId: string): boolean {
  try {
    const stored = localStorage.getItem(TARGETS_LS_KEY(userId));
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return !!(parsed?.protein_g > 0 || parsed?.carbs_g > 0 || parsed?.fat_g > 0);
  } catch {
    return false;
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

      const clientId = getClientId(userId);

      if (!clientId) {
        // Self-managed user: hydrate localStorage from the server only when it is
        // empty (e.g. fresh browser / new device). If localStorage already has
        // targets the user set them locally — those are authoritative and we leave
        // them alone.
        if (hasSelfTargetsInLocalStorage(userId)) return;

        try {
          const res = await fetch(`/api/users/${userId}/macro-targets`, {
            credentials: "include",
            headers: { ...getAuthHeaders() },
            cache: "no-store",
          });
          if (!res.ok) return;

          const data = await res.json();
          if (!data.hasTargets) return;

          // Write server targets into localStorage so the resolver finds them.
          const targets = {
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

          localStorage.setItem(TARGETS_LS_KEY(userId), JSON.stringify(targets));
          clearResolvedTargetsCache();
          window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));

          console.log(
            "[MacroTargetSync] Self-managed targets hydrated from server →",
            `protein=${data.protein_g} carbs=${data.carbs_g} fat=${data.fat_g}`
          );
        } catch {
          // Silent — network failures should not surface to the user
        }

        return;
      }

      // ProCare client: sync from DB into proStore
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
