import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { History } from "lucide-react";

interface ProgramEntry {
  id: string;
  clientUserId: string;
  coachUserId: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  reason: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MacroDiff({ label, prev, curr }: { label: string; prev: number | null; curr: number | null }) {
  if (curr === null || curr === undefined) return null;
  if (prev === null || prev === undefined || prev === curr) {
    return <span className="text-white/60 text-xs">{label} {curr}g</span>;
  }
  const isUp = curr > prev;
  return (
    <span className="text-xs">
      <span className="text-white/40">{label}</span>{" "}
      <span className="text-white/50">{prev}g</span>{" "}
      <span className="text-white/30">&rarr;</span>{" "}
      <span className={isUp ? "text-emerald-400" : "text-orange-400"}>{curr}g</span>
    </span>
  );
}

export default function ProClientProgramHistory({ clientId }: { clientId: string }) {
  const { data, isLoading, isError } = useQuery<{ history: ProgramEntry[] }>({
    queryKey: ["pro-program-history", clientId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/pro/clients/${clientId}/program-history`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <History className="w-3.5 h-3.5" />
          Loading program history...
        </div>
      </div>
    );
  }

  if (isError || !data) return null;

  const entries = data.history;
  if (entries.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <History className="w-3.5 h-3.5" />
          Program Adjustments
        </div>
        <p className="text-xs text-white/30">No program changes recorded yet</p>
      </div>
    );
  }

  const reversed = [...entries].reverse();

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
      <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
        <History className="w-3.5 h-3.5" />
        Program Adjustments
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {entries.map((entry, idx) => {
          const reverseIdx = entries.length - 1 - idx;
          const prev = reverseIdx > 0 ? reversed[reverseIdx - 1] : null;
          const isFirst = reverseIdx === 0;

          return (
            <div key={entry.id} className="border-l-2 border-white/10 pl-3 py-1">
              <div className="text-[10px] text-white/40 mb-0.5">{formatDate(entry.createdAt)}</div>
              {isFirst ? (
                <div className="text-xs text-white/70">
                  Initial macro program created
                  {entry.calories && (
                    <span className="text-white/40 ml-1">({entry.calories} cal)</span>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <MacroDiff label="P" prev={prev?.proteinG ?? null} curr={entry.proteinG} />
                    <MacroDiff label="C" prev={prev?.carbsG ?? null} curr={entry.carbsG} />
                    <MacroDiff label="Fat" prev={prev?.fatG ?? null} curr={entry.fatG} />
                  </div>
                  {entry.reason && (
                    <div className="text-[10px] text-white/30 italic">Reason: {entry.reason}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
