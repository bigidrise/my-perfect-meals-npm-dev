import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { foodNotesApi } from "../api/foodNotes";

export function QuickNotes({ dateISO }: { dateISO: string }) {
  const qc = useQueryClient();
  const notesQ = useQuery({
    queryKey: ["food-notes", dateISO],
    queryFn: () => foodNotesApi.list(dateISO),
    staleTime: 30_000,
  });

  const createM = useMutation({
    mutationFn: (payload: { text: string; source: "text" | "voice" }) =>
      foodNotesApi.create(dateISO, payload.text, payload.source),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food-notes", dateISO] }),
  });

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-4 space-y-3">
      <div className="font-semibold text-white">Quick Notes</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget as HTMLFormElement);
          const text = String(fd.get("note") || "").trim();
          if (!text) return;
          createM.mutate({ text, source: "text" });
          (e.currentTarget as HTMLFormElement).reset();
        }}
        className="flex gap-2"
      >
        <input
          name="note"
          placeholder="Optional journal note (doesn't affect macros)"
          className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/60 flex-1"
        />
        <button
          className="px-4 py-2 bg-white/20 border border-white/30 rounded text-white hover:bg-white/30 transition-colors"
          type="submit"
          disabled={createM.isPending}
        >
          Add
        </button>
      </form>

      {notesQ.isLoading && <div className="text-sm text-white/70">Loading…</div>}
      {notesQ.data && notesQ.data.length > 0 && (
        <ul className="text-sm space-y-2">
          {notesQ.data.map((n) => (
            <li key={n.id} className="bg-white/5 rounded-lg p-2 text-white/90">
              <span className="mr-2 inline-block text-xs px-2 py-0.5 rounded bg-white/20 text-white/80">
                {n.source}
              </span>
              {n.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}