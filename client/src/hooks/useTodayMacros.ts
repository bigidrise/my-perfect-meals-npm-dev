import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { localDayRangeAsUTCISO } from "@/utils/dates";

type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  foodTotals?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  alcoholTotals?: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

/** Today totals (uses local-day start/end to avoid UTC shift) */
export function useTodayMacros(): MacroTotals {
  const queryClient = useQueryClient();

  const { data: macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0, foodTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, alcoholTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } } } = useQuery(
    {
      queryKey: ["/api/users", DEV_USER_ID, "macros", "today"],
      queryFn: async () => {
        // Use proper local day boundaries → UTC conversion (same as steps system)
        const { startUTC, endUTC } = localDayRangeAsUTCISO(new Date());
        const url = `/api/users/${DEV_USER_ID}/macros?start=${encodeURIComponent(startUTC)}&end=${encodeURIComponent(endUTC)}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn("Failed to fetch macros:", response.status);
          return { kcal: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0, foodTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, alcoholTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
        }
        const data = await response.json();
        
        // Ensure alcoholTotals exists first
        if (!data.alcoholTotals) {
          data.alcoholTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        }
        
        // Synthesize foodTotals if not provided by backend
        // Subtract alcohol totals from merged totals to get food-only values
        if (!data.foodTotals) {
          data.foodTotals = {
            kcal: Math.max(0, (data.kcal || 0) - data.alcoholTotals.kcal),
            protein: Math.max(0, (data.protein || 0) - data.alcoholTotals.protein),
            carbs: Math.max(0, (data.carbs || 0) - data.alcoholTotals.carbs),
            fat: Math.max(0, (data.fat || 0) - data.alcoholTotals.fat)
          };
        }
        
        // Ensure starchy/fibrous carbs exist
        if (typeof data.starchyCarbs !== 'number') {
          data.starchyCarbs = 0;
        }
        if (typeof data.fibrousCarbs !== 'number') {
          data.fibrousCarbs = 0;
        }
        
        return data;
      },
    },
  );

  // Refetch Today when macros:updated fires (midnight rollover or manual reset)
  useEffect(() => {
    const refetchToday = () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", DEV_USER_ID, "macros", "today"],
      });
    };
    window.addEventListener("macros:updated", refetchToday);
    return () => window.removeEventListener("macros:updated", refetchToday);
  }, [queryClient]);

  // Midnight reset timer - automatically refreshes at midnight in user's timezone
  useEffect(() => {
    const scheduleMidnightReset = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); // Next midnight
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      console.log(`⏰ Midnight reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

      const timeoutId = setTimeout(() => {
        console.log("🌙 Midnight reset triggered - refreshing daily macros");
        queryClient.invalidateQueries({
          queryKey: ["/api/users", DEV_USER_ID, "macros", "today"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/users", DEV_USER_ID, "macros-daily"],
        });
        window.dispatchEvent(new Event("macros:updated"));
        
        // Schedule next midnight reset
        scheduleMidnightReset();
      }, msUntilMidnight);

      return timeoutId;
    };

    const timeoutId = scheduleMidnightReset();
    return () => clearTimeout(timeoutId);
  }, [queryClient]);

  return macros;
}