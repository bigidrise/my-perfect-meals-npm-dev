
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, put } from "@/lib/api";
import type { GLP1Guardrails } from "../../../shared/glp1-schema";

export function useGLP1Profile() {
  return useQuery({
    queryKey: ["glp1Profile"],
    queryFn: async () => {
      const result = await get<{ guardrails: GLP1Guardrails }>("/api/glp1/profile");
      return result;
    },
    staleTime: 60_000,
  });
}

export function useSaveGLP1Profile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guardrails: GLP1Guardrails) =>
      put("/api/glp1/profile", { guardrails }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["glp1Profile"] }),
  });
}
