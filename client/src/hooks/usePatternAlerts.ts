import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { DISMISS_TTL_MS } from "@/lib/patternAlertMessages";

export interface PatternAlert {
  type: string;
  priority: "low" | "medium" | "high";
  kind: "drift" | "positive";
}

// ── localStorage key helpers ────────────────────────────────────────────────

function dismissTimestampKey(alertType: string) {
  return `mpm.dismiss.patternAlert.${alertType}`;
}

function dismissCountKey(alertType: string) {
  return `mpm.dismiss.patternAlert.count.${alertType}`;
}

// ── Exported helpers ────────────────────────────────────────────────────────

export function getDismissCount(alertType: string): number {
  return parseInt(localStorage.getItem(dismissCountKey(alertType)) ?? "0", 10);
}

export function isDismissed(alert: PatternAlert): boolean {
  const stored = localStorage.getItem(dismissTimestampKey(alert.type));
  if (!stored) return false;
  const ttl = DISMISS_TTL_MS[alert.priority] ?? DISMISS_TTL_MS.low;
  return Date.now() - new Date(stored).getTime() < ttl;
}

export function dismissAlert(alertType: string): void {
  // Persist timestamp for TTL check
  localStorage.setItem(dismissTimestampKey(alertType), new Date().toISOString());
  // Increment count for deterministic variant rotation
  const current = getDismissCount(alertType);
  localStorage.setItem(dismissCountKey(alertType), String(current + 1));
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePatternAlerts() {
  const { user } = useAuth();

  const query = useQuery<{ alerts: PatternAlert[]; coachingStyle?: string }>({
    queryKey: ["pattern-alerts", user?.id],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/pattern-alerts"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const visibleAlerts = (query.data?.alerts ?? []).filter((a) => !isDismissed(a));

  return {
    alerts: visibleAlerts,
    coachingStyle: query.data?.coachingStyle ?? "balanced",
    isLoading: query.isLoading,
  };
}
