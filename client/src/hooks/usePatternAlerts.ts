import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { DISMISS_TTL_MS } from "@/lib/patternAlertMessages";

export interface PatternAlert {
  type: string;
  priority: "low" | "medium" | "high";
}

function dismissKey(alertType: string) {
  return `mpm.dismiss.patternAlert.${alertType}`;
}

export function isDismissed(alert: PatternAlert): boolean {
  const stored = localStorage.getItem(dismissKey(alert.type));
  if (!stored) return false;
  const ttl = DISMISS_TTL_MS[alert.priority] ?? DISMISS_TTL_MS.low;
  return Date.now() - new Date(stored).getTime() < ttl;
}

export function dismissAlert(alertType: string): void {
  localStorage.setItem(dismissKey(alertType), new Date().toISOString());
}

export function usePatternAlerts() {
  const { user } = useAuth();

  const query = useQuery<{ alerts: PatternAlert[] }>({
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

  const visibleAlerts = (query.data?.alerts ?? []).filter(
    (a) => !isDismissed(a),
  );

  return { alerts: visibleAlerts, isLoading: query.isLoading };
}
