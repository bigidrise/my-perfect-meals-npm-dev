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

const EMPTY: MacroTotals = {
  kcal: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0,
  foodTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  alcoholTotals: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
};

export function useTodayMacros(userId: string): MacroTotals {
  const queryClient = useQueryClient();

  const { data: macros = EMPTY } = useQuery(
    {
      queryKey: ["/api/users", userId, "macros", "today"],
      enabled: !!userId,
      queryFn: async () => {
        const { startUTC, endUTC } = localDayRangeAsUTCISO(new Date());
        const url = `/api/users/${userId}/macros?start=${encodeURIComponent(startUTC)}&end=${encodeURIComponent(endUTC)}`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn("Failed to fetch macros:", response.status);
          return EMPTY;
        }
        const data = await response.json();
        
        if (!data.alcoholTotals) {
          data.alcoholTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        }
        
        if (!data.foodTotals) {
          data.foodTotals = {
            kcal: Math.max(0, (data.kcal || 0) - data.alcoholTotals.kcal),
            protein: Math.max(0, (data.protein || 0) - data.alcoholTotals.protein),
            carbs: Math.max(0, (data.carbs || 0) - data.alcoholTotals.carbs),
            fat: Math.max(0, (data.fat || 0) - data.alcoholTotals.fat)
          };
        }
        
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

  useEffect(() => {
    if (!userId) return;
    const refetchToday = () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "macros", "today"],
      });
    };
    window.addEventListener("macros:updated", refetchToday);
    return () => window.removeEventListener("macros:updated", refetchToday);
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId) return;
    const scheduleMidnightReset = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      console.log(`⏰ Midnight reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

      const timeoutId = setTimeout(() => {
        console.log("🌙 Midnight reset triggered - refreshing daily macros");
        queryClient.invalidateQueries({
          queryKey: ["/api/users", userId, "macros", "today"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/users", userId, "macros-daily"],
        });
        window.dispatchEvent(new Event("macros:updated"));
        
        scheduleMidnightReset();
      }, msUntilMidnight);

      return timeoutId;
    };

    const timeoutId = scheduleMidnightReset();
    return () => clearTimeout(timeoutId);
  }, [queryClient, userId]);

  return macros;
}
