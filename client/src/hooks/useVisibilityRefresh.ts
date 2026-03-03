import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const CRITICAL_PREFIXES = [
  ["/api/users"],
  ["/api/weekly-board"],
  ["/api/pro/weekly-board"],
];

export function useVisibilityRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;

      for (const prefix of CRITICAL_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: prefix });
      }

      window.dispatchEvent(new Event("mpm:visibility-resumed"));
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient]);
}
