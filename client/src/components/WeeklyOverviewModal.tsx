import { useMemo } from "react";
import type { WeekBoard } from "@/lib/boardApi";
import { formatWeekLabel as formatWeekLabelSafe, addDaysISOSafe } from "@/utils/midnight";

function formatWeekLabel(weekStartISO: string): string {
  return formatWeekLabelSafe(weekStartISO);
}

function dayNameFromOffset(offset: number) {
  // 0..6 → Mon..Sun
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names[offset] ?? String(offset);
}

function addDaysISO(iso: string, days: number): string {
  return addDaysISOSafe(iso, days);
}

export default function WeeklyOverviewModal({
  open,
  onClose,
  weekStartISO,
  board, // the currently loaded board (day view)
  onJumpToDay, // optional: callback to jump to a date (future)
}: {
  open: boolean;
  onClose: () => void;
  weekStartISO: string;
  board: WeekBoard | null;
  onJumpToDay?: (dateISO: string) => void;
}) {
  if (!open) return null;

  // Totals for the current loaded board (read-only)
  const totals = useMemo(() => {
    if (!board) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const all = [
      ...board.lists.breakfast,
      ...board.lists.lunch,
      ...board.lists.dinner,
      ...board.lists.snacks,
    ];
    return all.reduce(
      (acc, m) => {
        const s = m.servings ?? 1;
        acc.calories += (m.nutrition?.calories ?? 0) * s;
        acc.protein += (m.nutrition?.protein ?? 0) * s;
        acc.carbs += (m.nutrition?.carbs ?? 0) * s;
        acc.fat += (m.nutrition?.fat ?? 0) * s;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [board]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {/* Modal with blue-black gradient matching the main board */}
      <div className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-auto bg-gradient-to-r from-black/90 via-cyan-500 to-black/90 rounded-2xl">
        <div className="border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl">
          {/* Header matching the main board style */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-700/50">
            <div>
              <h2 className="text-white/95 text-lg sm:text-xl font-semibold">Week Overview</h2>
              <div className="text-sm font-medium text-white/90">
                {formatWeekLabel(weekStartISO)}
              </div>
            </div>
            <button
              className="rounded-md px-3 py-2 border border-white/20 text-white/80 hover:bg-white/10 transition-colors text-sm"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Mon–Sun chip strip with matching styling */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 7 }).map((_, i) => {
                const dateISO = addDaysISO(weekStartISO, i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onJumpToDay?.(dateISO)}
                    className="whitespace-nowrap border border-white/20 rounded-full px-3 py-1 text-sm text-white/80 hover:bg-white/10 transition-colors"
                    aria-label={`Go to ${dayNameFromOffset(i)}`}
                  >
                    {dayNameFromOffset(i)}
                  </button>
                );
              })}
            </div>

            {/* Current-board summary with matching styling */}
            <div className="border border-zinc-700/50 bg-zinc-800/30 backdrop-blur rounded-xl p-4">
              <h3 className="text-white/95 text-base font-semibold mb-3">Today's Summary (current board)</h3>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-white/60">Calories</div>
                  <div className="font-semibold text-white/95">{Math.round(totals.calories)}</div>
                </div>
                <div>
                  <div className="text-white/60">Protein</div>
                  <div className="font-semibold text-white/95">{Math.round(totals.protein)} g</div>
                </div>
                <div>
                  <div className="text-white/60">Carbs</div>
                  <div className="font-semibold text-white/95">{Math.round(totals.carbs)} g</div>
                </div>
                <div>
                  <div className="text-white/60">Fat</div>
                  <div className="font-semibold text-white/95">{Math.round(totals.fat)} g</div>
                </div>
              </div>
              <div className="text-xs text-white/50 mt-3">
                Tip: You can tap a day above to jump the planner to that date (once day-level boards are enabled).
              </div>
            </div>

            {/* Future features note with matching styling */}
            <div className="text-xs text-white/50 text-center">
              Weekly per-day breakdown can be enabled later via a read-only snapshot endpoint, without changing this UI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}