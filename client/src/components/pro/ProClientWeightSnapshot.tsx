import { useState, useEffect, useMemo } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, TrendingDown, TrendingUp, Minus, Scale } from "lucide-react";
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

type RangeKey = "30" | "90" | "6" | "12";

const RANGE_LABELS: Record<RangeKey, string> = {
  "30": "30D",
  "90": "90D",
  "6": "6M",
  "12": "12M",
};

function buildDailyAvg(history: WeightRow[], daysBack: number) {
  const days = new Map<string, number[]>();
  for (const r of history) {
    const key = r.date.slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(r.weight);
  }
  const out: { date: string; weightAvg: number }[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const vals = days.get(key);
    const avg =
      vals && vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0;
    out.push({ date: key, weightAvg: avg });
  }
  return out;
}

function findWeightNDaysAgo(history: WeightRow[], daysAgo: number): number | null {
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const targetStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

  let closest: WeightRow | null = null;
  let closestDiff = Infinity;

  for (const r of history) {
    const rDate = new Date(r.date + "T12:00:00");
    const diff = Math.abs(rDate.getTime() - target.getTime());
    if (diff < closestDiff && r.date <= targetStr) {
      closestDiff = diff;
      closest = r;
    }
  }

  const sevenDayMs = 7 * 24 * 60 * 60 * 1000;
  if (closest && closestDiff <= sevenDayMs) return closest.weight;
  return null;
}

export default function ProClientWeightSnapshot({ clientId }: ProClientWeightSnapshotProps) {
  const [weightHistory, setWeightHistory] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("90");

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

  const rangeDays: Record<RangeKey, number> = { "30": 30, "90": 90, "6": 180, "12": 365 };
  const chartData = useMemo(
    () => buildDailyAvg(weightHistory, rangeDays[range]),
    [weightHistory, range],
  );

  const filteredChart = useMemo(
    () => chartData.filter((d) => d.weightAvg > 0),
    [chartData],
  );

  const latestWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
  const lastWeighIn = weightHistory.length > 0 ? weightHistory[0].date : null;

  const weight30ago = findWeightNDaysAgo(weightHistory, 30);
  const weight90ago = findWeightNDaysAgo(weightHistory, 90);

  const delta30 = latestWeight != null && weight30ago != null
    ? Math.round((latestWeight - weight30ago) * 10) / 10
    : null;
  const delta90 = latestWeight != null && weight90ago != null
    ? Math.round((latestWeight - weight90ago) * 10) / 10
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

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
      <h4 className="text-xs font-medium text-white/60 flex items-center gap-1.5">
        <Scale className="w-3.5 h-3.5" /> Weight Trend
      </h4>

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
            {delta30 != null ? (
              <span className={delta30 < 0 ? "text-emerald-400" : delta30 > 0 ? "text-red-400" : "text-white/50"}>
                {delta30 > 0 ? "+" : ""}{delta30} lb
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">30D Change</p>
        </div>
        <div>
          <p className="text-sm font-bold">
            {delta90 != null ? (
              <span className={delta90 < 0 ? "text-emerald-400" : delta90 > 0 ? "text-red-400" : "text-white/50"}>
                {delta90 > 0 ? "+" : ""}{delta90} lb
              </span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </p>
          <p className="text-[10px] text-white/40">90D Change</p>
        </div>
      </div>

      <div className="flex gap-1 bg-black/30 p-1 rounded-lg justify-center">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              range === k ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>

      {filteredChart.length >= 2 ? (
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={filteredChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#fff" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v + "T12:00:00");
                  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                }}
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
                }}
                labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="weightAvg"
                stroke="#10b981"
                dot={false}
                name="Weight (lb)"
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
