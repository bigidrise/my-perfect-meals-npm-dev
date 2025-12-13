import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useStableSave(apiPath: string, listKey: any[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: [...listKey, "save"],
    mutationFn: async (payload: any) => {
      const headers = { "Content-Type": "application/json", "x-request-id": crypto.randomUUID() };
      const r = await fetch(apiPath, { method: "POST", headers, body: JSON.stringify(payload) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      return body; // MUST contain { row }
    },
    retry: 2,
    onSuccess: ({ row }) => {
      // Replace with canonical server row
      qc.setQueryData(listKey, (old: any[] = []) => {
        const idx = old.findIndex((x) => x.id === row.id);
        if (idx >= 0) { const copy = old.slice(); copy[idx] = row; return copy; }
        return [row, ...old.filter(x => !x._optimistic)];
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
  });
}