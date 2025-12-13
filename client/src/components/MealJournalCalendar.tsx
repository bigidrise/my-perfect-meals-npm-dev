import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  items: { id: string; mealTime: string; description: string }[];
  monthISO: string; // any date within target month: YYYY-MM-01
  onSelectDay?: (dateISO: string) => void;
}

function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d: Date) { const x = new Date(d); x.setMonth(x.getMonth()+1, 0); x.setHours(23,59,59,999); return x; }
function toISODate(d: Date) { return d.toISOString().slice(0,10); }

export default function MealJournalCalendar({ items, monthISO, onSelectDay }: Props) {
  const month = new Date(monthISO);
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      const d = new Date(it.mealTime);
      if (d >= start && d <= end) {
        const key = toISODate(d);
        map[key] = (map[key] || 0) + 1;
      }
    }
    return map;
  }, [items, monthISO]);

  // Build calendar grid (Sun..Sat)
  const firstWeekday = new Date(start).getDay(); // 0=Sun
  const daysInMonth = end.getDate();
  const cells: { date?: Date; count?: number }[] = [];
  for (let i=0; i<firstWeekday; i++) cells.push({});
  for (let day=1; day<=daysInMonth; day++) {
    const d = new Date(start); d.setDate(day);
    const key = toISODate(d);
    cells.push({ date: d, count: byDay[key] });
  }
  while (cells.length % 7 !== 0) cells.push({});

  return (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
            <div key={w} className="text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, idx) => (
            <button
              key={idx}
              disabled={!c.date}
              onClick={() => c.date && onSelectDay?.(toISODate(c.date))}
              className={`h-16 rounded border flex flex-col items-center justify-center ${
                c.date ? "bg-white hover:bg-gray-50" : "bg-transparent border-transparent"
              }`}
            >
              {c.date && (
                <>
                  <div className="text-sm font-medium">{c.date.getDate()}</div>
                  <div className={`text-[10px] mt-1 ${c.count ? "text-emerald-700" : "text-gray-300"}`}>
                    {c.count ? `${c.count} log${c.count>1?"s":""}` : "—"}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}