
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBuilderPlan, saveBuilderPlan, patchBuilderPlan, clearBuilderPlan, type BuilderPlanJSON } from "@/lib/builderPlansApi";

export function useBuilderPlan(key: "diabetic"|"smart"|"specialty"|"medical"|"glp1") {
  const qc = useQueryClient();
  const query = useQuery({ 
    queryKey: ["builder-plan", key], 
    queryFn: () => getBuilderPlan(key),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: (p: { plan: BuilderPlanJSON; days: number }) => saveBuilderPlan(key, p.plan, p.days),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-plan", key] }),
  });
  
  const update = useMutation({
    mutationFn: (plan: BuilderPlanJSON) => patchBuilderPlan(key, plan),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-plan", key] }),
  });
  
  const clear = useMutation({
    mutationFn: () => clearBuilderPlan(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-plan", key] }),
  });
  
  return { query, save, update, clear };
}
