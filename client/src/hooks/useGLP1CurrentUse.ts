import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import type { GLP1CurrentUseStatus } from "@shared/glp1CurrentUse";

export function useGLP1CurrentUse() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["/api/health-context/glp1/current-use", user?.id];
  const status = useQuery<GLP1CurrentUseStatus>({
    queryKey,
    enabled: import.meta.env.DEV && !!user?.id,
    queryFn: () => apiRequest("/api/health-context/glp1/current-use"),
    staleTime: 0,
  });
  const save = useMutation({
    mutationFn: (currentUse: boolean): Promise<GLP1CurrentUseStatus> =>
      apiRequest("/api/health-context/glp1/current-use", {
        method: "PUT", body: JSON.stringify({ currentUse }),
      }),
    onSuccess: (value) => {
      queryClient.setQueryData(queryKey, value);
      // Medication authority is resolved afresh on food operations. Refresh
      // mounted health/menu reads without clearing account-specific caches.
      queryClient.invalidateQueries({ queryKey: ["/api/health-context"] });
    },
  });
  return { ...status, save };
}
