import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api";

export interface LogMacrosPayload {
  userId: string;
  mealId?: string;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "unspecified";
  source?: "weekly_plan" | "craving" | "fast_food" | "manual" | "import" | "other";
  nutrition?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  // Legacy support
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  kcal?: number;
  meta?: any;
  idempotencyKey?: string;
}

export interface LogMacrosResponse {
  entryId: string;
  localDay: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
}

export function useLogMacros() {
  const qc = useQueryClient();
  
  return useMutation<LogMacrosResponse, Error, LogMacrosPayload>({
    mutationFn: async (payload: LogMacrosPayload) => {
      return post<LogMacrosResponse>("/api/macros/log", payload, {
        headers: {
          "Idempotency-Key": payload.idempotencyKey ?? crypto.randomUUID(),
        }
      });
    },
    onSuccess: (data) => {
      // Replace optimistic UI with server totals
      qc.setQueryData(["macros", "totals", data.localDay], data.totals);
      
      // Invalidate ALL macro-related queries to trigger UI updates
      qc.invalidateQueries({ queryKey: ["macros"] });
      qc.invalidateQueries({ queryKey: ["/api/users"] }); // Catches useTodayMacros and user-specific queries
      
      // Emit event for components listening to macro updates
      window.dispatchEvent(new Event("macros:updated"));
      
      console.log("✅ Macro logged successfully:", data);
    },
    onError: (error) => {
      console.error("❌ Failed to log macros:", error);
    },
  });
}
