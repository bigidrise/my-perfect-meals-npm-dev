import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithDevice } from "@/utils/fetchWithDevice";

export function useStepProgress(stepKey: string, userId?: string) {
  const qc = useQueryClient();

  const progress = useQuery({
    queryKey: ["onboarding", "progress", userId ?? "anon"],
    queryFn: async () => {
      const r = await fetchWithDevice(`/api/onboarding/progress${userId ? `?userId=${userId}` : ""}`);
      if (!r.ok) throw new Error("Failed to load progress");
      return (await r.json()).steps as Record<string, { data:any; completed:boolean }>;
    },
  });

  const saveStep = useMutation({
    mutationFn: async (payload: { data: any; completed?: boolean; apply?: boolean }) => {
      console.log("📤 Saving step:", { stepKey, userId, payload });
      
      const r = await fetchWithDevice(`/api/onboarding/step/${stepKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      
      console.log("📥 Save response:", { status: r.status, ok: r.ok });
      
      if (!r.ok) {
        const errorText = await r.text();
        console.error("❌ Save failed:", { status: r.status, errorText });
        throw new Error(`Failed to save step: ${r.status} ${errorText}`);
      }
      
      const result = await r.json();
      console.log("✅ Save result:", result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log("♻️ Onboarding step saved successfully, skipping cache invalidation to prevent loops");
      // Only invalidate cache if this was a completion or final step
      if (variables.completed || variables.apply) {
        qc.invalidateQueries({ queryKey: ["onboarding", "progress", userId ?? "anon"] });
      }
    },
    onError: (error) => {
      console.error("💥 Save mutation error:", error);
    },
  });

  const resetStep = useMutation({
    mutationFn: async () => {
      const url = `/api/onboarding/step/${stepKey}${userId ? `?userId=${userId}` : ""}`;
      const r = await fetchWithDevice(url, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to reset step");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", "progress", userId ?? "anon"] }),
  });

  const resetAll = useMutation({
    mutationFn: async () => {
      const r = await fetchWithDevice(`/api/onboarding/reset-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) throw new Error("Failed to reset all");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", "progress", userId ?? "anon"] }),
  });

  const claimProgress = useMutation({
    mutationFn: async (newUserId: string) => {
      const r = await fetchWithDevice(`/api/onboarding/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newUserId }),
      });
      if (!r.ok) throw new Error("Failed to claim progress");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
    },
  });

  return { progress, saveStep, resetStep, resetAll, claimProgress };
}