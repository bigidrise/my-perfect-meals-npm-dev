import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { weekDates } from "@/lib/boardApi";
import type { ListType } from "@/utils/addMealToBoard";

export default function AddToBoardModal({
  open,
  onClose,
  weekStartISO,
  enableDayPlanning, // true if you want day selection; false = legacy single-day
  defaultList = "dinner",
  onConfirm, // ({dateISO|null, list}) => void
}: {
  open: boolean;
  onClose: () => void;
  weekStartISO: string;
  enableDayPlanning: boolean;
  defaultList?: ListType;
  onConfirm: (p: { dateISO: string | null; list: ListType }) => void;
}) {
  const days = useMemo(() => weekDates(weekStartISO), [weekStartISO]);
  const [dateISO, setDateISO] = useState<string | null>(enableDayPlanning ? days[0] : null);
  const [list, setList] = useState<ListType>(defaultList);

  if (!open) return null;

  const label = (d: string): string =>
    new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md bg-gradient-to-br from-neutral-600 via-black/600 to-black border border-white/20 text-white">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-white">Add to Weekly Meal Board</CardTitle>
          <button className="border border-white/20 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 text-sm text-white hover:bg-white/20" onClick={onClose}>Close</button>
        </CardHeader>
        <CardContent className="space-y-4">
          {enableDayPlanning && (
            <div>
              <div className="text-sm mb-2 text-white/80">Choose a day</div>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDateISO(d)}
                    className={`px-3 py-1 rounded-full border text-sm ${
                      dateISO === d 
                        ? "bg-white/20 text-white border-white/40" 
                        : "border-white/20 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {label(d)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-sm mb-2 text-white/80">Meal slot</div>
            <div className="grid grid-cols-2 gap-2">
              {(["breakfast","lunch","dinner","snacks"] as ListType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setList(t)}
                  className={`px-3 py-2 rounded-md border text-sm capitalize ${
                    list === t 
                      ? "bg-white/20 text-white border-white/40" 
                      : "border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="border border-white/20 bg-white/10 backdrop-blur-sm rounded-md px-3 py-2 text-sm text-white hover:bg-white/20" onClick={onClose}>Cancel</button>
            <button
              className="rounded-md px-3 py-2 text-sm text-white
                         bg-gradient-to-br from-black/90 via-white/70 to-black/90 hover:opacity-95"
              onClick={() => { onConfirm({ dateISO, list }); onClose(); }}
            >
              Add to Board
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
