import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del, patch } from "@/lib/api";

export type InjectionLocation = "abdomen" | "thigh" | "upper_arm" | "buttock";

export type ShotEntry = {
  id: string;
  userId: string;
  dateUtc: string;
  doseMg: number;
  location?: InjectionLocation;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const base = (userId: string) => `/api/users/${userId}/glp1-shots`;

export function useGlp1Shots(userId: string, opts?: { start?: string; end?: string; enabled?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.start) params.set("start", opts.start);
  if (opts?.end) params.set("end", opts.end);
  const qs = params.toString() ? `?${params.toString()}` : "";
  
  return useQuery({
    queryKey: [base(userId), qs],
    queryFn: async () => {
      const result = await get<{ items: ShotEntry[] }>(`${base(userId)}${qs}`);
      return result.items;
    },
    staleTime: 60_000,
    retry: 2,
    enabled: opts?.enabled ?? true,
  });
}

export function useCreateShot(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dateUtc: string; doseMg: number; location?: InjectionLocation; notes?: string }) =>
      post<ShotEntry>(base(userId), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [base(userId)] }),
  });
}

export function useUpdateShot(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patchData }: { id: string; dateUtc?: string; doseMg?: number; location?: InjectionLocation; notes?: string }) =>
      patch<ShotEntry>(`${base(userId)}/${id}`, patchData),
    onSuccess: () => qc.invalidateQueries({ queryKey: [base(userId)] }),
  });
}

export function useDeleteShot(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${base(userId)}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [base(userId)] }),
  });
}
