import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GlycemicSettings } from "@/types/glycemic";
import { get, put } from "@/lib/api";

const KEY = ["glycemic-settings"];

async function fetchGlycemicSettings(): Promise<GlycemicSettings> {
  const data = await get<Partial<GlycemicSettings>>("/api/glycemic-settings");
  return {
    bloodGlucose: data.bloodGlucose ?? null,
    preferredCarbs: data.preferredCarbs ?? [],
    updatedAt: data.updatedAt ?? null,
  };
}

async function saveGlycemicSettings(payload: GlycemicSettings): Promise<GlycemicSettings> {
  return put<GlycemicSettings>("/api/glycemic-settings", payload);
}

export function useGlycemicSettings() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: fetchGlycemicSettings,
  });

  const mutation = useMutation({
    mutationFn: saveGlycemicSettings,
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
    },
  });

  return {
    data: query.data ?? { bloodGlucose: null, preferredCarbs: [] },
    isLoading: query.isLoading,
    isError: query.isError,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}