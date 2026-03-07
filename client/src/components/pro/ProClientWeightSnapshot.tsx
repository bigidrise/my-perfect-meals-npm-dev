import { useState, useEffect, useMemo } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Scale } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProClientWeightSnapshotProps {
  clientId: string;
}

interface WeightRow {
  id: string;
  date: string;
  weight: number;
}

type ViewMode = "daily" | "weekly" | "monthly" | "90day";

const VIEW_LABELS: Record<ViewMode, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  "90day": "90 Day",
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function buildDailyData(history: WeightRow[]): { label: string; avg: number }[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((r) => ({
    label: r.date.slice(0, 10),
    avg: r.weight,
  }));
}

interface WeekBucket {
  label: string;
  weekLabel: string;
  avg: number;
  change: number | null;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function buildWeeklyData(history: WeightRow[]): WeekBucket[] {
  const weeks = new Map<string, number[]>();
  for (const r of history) {
    const d = new Date(r.date + "T12:00:00");
    const mon = getMonday(d);
    const key = toDateKey(mon);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(r.weight);
  }
  const sorted = Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const result: WeekBucket[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const [date, vals] = sorted[i];
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const prev = i > 0 ? result[i - 1].avg : null;
    const change = prev != null ? Math.round((avg - prev) * 10) / 10 : null;
    const sun = new Date(date + "T12:00:00");
    sun.setDate(sun.getDate() + 6);
    result.push({
      label: date,
      weekLabel: `${formatShortDate(date)}–${formatShortDate(toDateKey(sun))}`,
      avg,
      change,
    });
  }
  return result;
}

function buildMonthlyData(history: WeightRow[]): { label: string; avg: number; change: number | null }[] {
  const months = new Map<string, number[]>();
  for (const r of history) {
    const key = r.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(r.weight);
  }
  const sorted = Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const result: { label: string; avg: number; change: number | null }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const [month, vals] = sorted[i];
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    const prev = i > 0 ? result[i - 1].avg : null;
    result.push({
      label: month,
      avg,
      change: prev != null ? Math.round((avg - prev) * 10) / 10 : null,
    });
  }
  return result;
}

function build90DayData(history: WeightRow[]): { label: string; avg: number }[] {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - 90);
  const cutoffStr = toDateKey(cutoff);
  const filtered = history.filter((r) => r.date >= cutoffStr);
  return buildWeeklyData(filtered);
}

export default function ProClientWeightSnapshot({ clientId }: ProClientWeightSnapshotProps) {
  const [weightHistory, setWeightHistory] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("weekly");

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    setWeightHistory([]);

    const fetchWeight = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        const res = await fetch(
          apiUrl(`/api/pro/clients/${clientId}/biometrics/weight?range=365d`),
          { headers, credentials: "include" },
        );

        if (cancelled) return;

        if (!res.ok) {
          setError("Unable to load weight data");
          return;
        }

        const data = await res.json();
        if (data.history && data.history.length > 0) {
          const rows: WeightRow[] = data.history.map((h: any) => ({
            id: h.id,
            date: h.date,
            weight: h.unit === "kg" ? Math.round(h.weight * 2.20462 * 10) / 10 : h.weight,
          }));
          setWeightHistory(rows);
        } else {
          setWeightHistory([]);
        }
      } catch {
        if (!cancelled) setError("Failed to load weight data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeight();
    return () => { cancelled = true; };
  }, [clientId]);

  const dailyData = useMemo(() => buildDailyData(weightHistory), [weightHistory]);
  const weeklyData = useMemo(() => buildWeeklyData(weightHistory), [weightHistory]);
  const monthlyData = useMemo(() => buildMonthlyData(weightHistory), [weightHistory]);
  const ninetyDayData = useMemo(() => build90DayData(weightHistory), [weightHistory]);

  const chartData = useMemo(() => {
    switch (view) {
      case "daily": return dailyData;
      case "weekly": return weeklyData;
      case "monthly": return monthlyData;
      case "90day": return ninetyDayData;
    }
  }, [view, dailyData, weeklyData, monthlyData, ninetyDayData]);

  const latestWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
  const lastWeighIn = weightHistory.length > 0 ? weightHistory[0].date : null;

  const weeklyChange = weeklyData.length >= 2
    ? weeklyData[weeklyData.length - 1].change
    : null;

  const totalChange = weeklyData.length >= 2
    ? Math.round((weeklyData[weeklyData.length - 1].avg - weeklyData[0].avg) * 10) / 10
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-white/40" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400 py-2">{error}</p>;
  }

  if (weightHistory.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1">
          <Scale className="w-3.5 h-3.5" /> Weight Trend
        </h4>
        <p className="text-[10px] text-white/30 italic">No weight data logged by client</p>
      </div>
    );
  }

  const formatTickLabel = (v: string) => {
    if (view === "monthly") {
      const parts = v.split("-");
      return `${parts[1]}/${parts[0].slice(2)}`;
    }
    const d = new Date(v + "T12:00:00");
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTooltipLabel = (v: string) => {
    if (view === "weekly" || view === "90day") {
      const data = view === "weekly" ? weeklyData : ninetyDayData;
      const found = data.find((w) => w.label === v);
      if (found) return `Week of ${formatShortDate(v)}`;
    }
    if (view === "monthly") {
      const d = new Date(v + "-01T12:00:00");
      return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return new Date(v + "T12:00:00").toLocaleDateString();
  };

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-white/60 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5" /> Weight Trend
          <span className="text-[9px] text-white/30 ml-1">
            ({VIEW_LABELS[view]})
          </span>
        </h4>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-white">
            {latestWeight != null ? `${latestWeight} lb` : "—"}
          </p>
          <p className="text-[10px] text-white/40">Current</p>
          {lastWeighIn && (
            <p className="text-[9px] text-white/25">
              {new Date(lastWeighIn + "T12:00:00").toLocaleDateString()}
            </p>
          )}
        </div>
        <div>
          <p className="text-sm font-bold">
            {weeklyChange != null ? (
              <span className={weeklyChange < 0 ? "text-emerald-400" : weeklyChange > 0 ? "text-red-400" : "text-white/50"}>
                {weeklyChange > 0 ? "+" : ""}{weeklyChange} lb
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">Weekly Change</p>
        </div>
        <div>
          <p className="text-sm font-bold">
            {totalChange != null ? (
              <span className={totalChange < 0 ? "text-emerald-400" : totalChange > 0 ? "text-red-400" : "text-white/50"}>
                {totalChange > 0 ? "+" : ""}{totalChange} lb
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">Total Change</p>
        </div>
      </div>

      <div className="flex gap-1 bg-black/30 p-1 rounded-lg justify-center">
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map((k) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              view === k ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            {VIEW_LABELS[k]}
          </button>
        ))}
      </div>

      {view === "weekly" && weeklyData.length > 0 && (
        <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
          <div className="grid grid-cols-3 text-[9px] text-white/40 font-medium px-1 pb-1 border-b border-white/10">
            <span>Week</span>
            <span className="text-right">Avg Weight</span>
            <span className="text-right">Change</span>
          </div>
          {weeklyData.slice().reverse().map((w, i) => (
            <div key={w.label} className="grid grid-cols-3 text-[10px] px-1 py-0.5">
              <span className="text-white/60">{w.weekLabel}</span>
              <span className="text-right text-white font-medium">{w.avg} lb</span>
              <span className={`text-right font-medium ${
                w.change == null ? "text-white/30" :
                w.change < 0 ? "text-emerald-400" :
                w.change > 0 ? "text-red-400" : "text-white/50"
              }`}>
                {w.change == null ? "—" : `${w.change > 0 ? "+" : ""}${w.change}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {chartData.length >= 2 ? (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#fff" }}
                tickFormatter={formatTickLabel}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#fff" }}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.9)",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={formatTooltipLabel}
                formatter={(value: number) => [`${value} lb`, view === "daily" ? "Weight" : "Avg Weight"]}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#10b981"
                dot={chartData.length <= 14}
                name={view === "daily" ? "Weight" : "Avg Weight"}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-[10px] text-white/30 text-center italic">
          Not enough data points for chart in this range
        </p>
      )}
    </div>
  );
}
