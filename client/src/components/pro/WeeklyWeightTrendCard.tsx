import { useState, useEffect, useMemo } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeeklyWeightTrendCardProps {
  clientId: string;
}

interface WeightRow {
  id: string;
  date: string;
  weight: number;
}

interface WeekBucket {
  label: string;
  weekLabel: string;
  avg: number;
  change: number | null;
}

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

export default function WeeklyWeightTrendCard({ clientId }: WeeklyWeightTrendCardProps) {
  const [weightHistory, setWeightHistory] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      setWeightHistory([]);
      return;
    }
    let cancelled = false;

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

  const weeklyData = useMemo(() => buildWeeklyData(weightHistory), [weightHistory]);

  const currentWeekAvg = weeklyData.length > 0
    ? weeklyData[weeklyData.length - 1].avg
    : null;

  const weeklyChange = weeklyData.length >= 2
    ? weeklyData[weeklyData.length - 1].change
    : null;

  const totalChange = weeklyData.length >= 2
    ? Math.round((weeklyData[weeklyData.length - 1].avg - weeklyData[0].avg) * 10) / 10
    : null;

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl p-5 border border-white/20">
        <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-emerald-400" /> Weekly Weight Trend
        </h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 rounded-2xl p-5 border border-white/20">
        <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-emerald-400" /> Weekly Weight Trend
        </h3>
        <p className="text-xs text-red-400 py-2">{error}</p>
      </div>
    );
  }

  if (weightHistory.length === 0) {
    return (
      <div className="bg-white/5 rounded-2xl p-5 border border-white/20">
        <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-emerald-400" /> Weekly Weight Trend
        </h3>
        <p className="text-xs text-white/30 italic">No weight data logged by client yet.</p>
      </div>
    );
  }

  const formatTickLabel = (v: string) => {
    const d = new Date(v + "T12:00:00");
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTooltipLabel = (v: string) => {
    const found = weeklyData.find((w) => w.label === v);
    if (found) return `Week of ${formatShortDate(v)}`;
    return new Date(v + "T12:00:00").toLocaleDateString();
  };

  return (
    <div className="bg-white/5 rounded-2xl p-5 border border-white/20 space-y-4">
      <h3 className="text-base font-semibold text-white flex items-center gap-2">
        <Scale className="w-4 h-4 text-emerald-400" /> Weekly Weight Trend
      </h3>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-black/25 border border-white/10 text-center">
          <p className="text-lg font-bold text-white">
            {currentWeekAvg != null ? `${currentWeekAvg}` : "—"}
          </p>
          <p className="text-[10px] text-white/40">Current Avg (lb)</p>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/10 text-center">
          <p className="text-lg font-bold">
            {weeklyChange != null ? (
              <span className="flex items-center justify-center gap-1">
                {weeklyChange < 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                ) : weeklyChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-white/50" />
                )}
                <span className={weeklyChange < 0 ? "text-emerald-400" : weeklyChange > 0 ? "text-red-400" : "text-white/50"}>
                  {weeklyChange > 0 ? "+" : ""}{weeklyChange}
                </span>
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">Week Change (lb)</p>
        </div>
        <div className="p-3 rounded-xl bg-black/25 border border-white/10 text-center">
          <p className="text-lg font-bold">
            {totalChange != null ? (
              <span className="flex items-center justify-center gap-1">
                {totalChange < 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                ) : totalChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-white/50" />
                )}
                <span className={totalChange < 0 ? "text-emerald-400" : totalChange > 0 ? "text-red-400" : "text-white/50"}>
                  {totalChange > 0 ? "+" : ""}{totalChange}
                </span>
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">Total Change (lb)</p>
        </div>
      </div>

      {weeklyData.length >= 2 ? (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={weeklyData}>
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
                formatter={(value: number) => [`${value} lb`, "Avg Weight"]}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#10b981"
                dot={weeklyData.length <= 14}
                name="Avg Weight"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-[10px] text-white/30 text-center italic">
          Need 2+ weeks of data to display chart
        </p>
      )}
    </div>
  );
}
