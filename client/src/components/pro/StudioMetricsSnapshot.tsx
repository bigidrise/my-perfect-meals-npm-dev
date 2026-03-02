import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface StudioMetricsSnapshotProps {
  clientId: string;
}

interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MacroTargetsDB {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  hasTargets: boolean;
}

interface BodyCompEntry {
  currentBodyFatPct: string;
  goalBodyFatPct: string | null;
  scanMethod: string;
  source: string;
  recordedAt: string;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="w-3 h-3 text-white/30" />;
  const isOver = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isOver ? "text-red-400" : "text-emerald-400"}`}>
      {isOver ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isOver ? "+" : ""}{delta}
    </span>
  );
}

export default function StudioMetricsSnapshot({ clientId }: StudioMetricsSnapshotProps) {
  const [todayMacros, setTodayMacros] = useState<MacroTotals | null>(null);
  const [targets, setTargets] = useState<MacroTargetsDB | null>(null);
  const [bodyComp, setBodyComp] = useState<BodyCompEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    setTodayMacros(null);
    setTargets(null);
    setBodyComp(null);

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = todayRange();
        const headers: Record<string, string> = { ...getAuthHeaders() };

        const [macroRes, targetsRes, bodyCompRes] = await Promise.all([
          fetch(apiUrl(`/api/users/${clientId}/macros?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`), {
            headers,
            credentials: "include",
          }),
          fetch(apiUrl(`/api/pro/clients/${clientId}/macro-targets`), {
            headers,
            credentials: "include",
          }),
          fetch(apiUrl(`/api/users/${clientId}/body-composition/latest`), {
            headers,
            credentials: "include",
          }),
        ]);

        if (cancelled) return;

        if (macroRes.ok) {
          const data = await macroRes.json();
          setTodayMacros({
            kcal: Math.round(Number(data.kcal || 0)),
            protein: Math.round(Number(data.protein || 0)),
            carbs: Math.round(Number(data.carbs || 0)),
            fat: Math.round(Number(data.fat || 0)),
          });
        }

        if (targetsRes.ok) {
          const data = await targetsRes.json();
          setTargets(data);
        }

        if (bodyCompRes.ok) {
          const data = await bodyCompRes.json();
          if (data?.entry) setBodyComp(data.entry);
        }
      } catch {
        if (!cancelled) setError("Failed to load metrics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [clientId]);

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

  const tCal = targets?.calories ?? 0;
  const tProtein = targets?.protein_g ?? 0;
  const tCarbs = targets?.carbs_g ?? 0;
  const tFat = targets?.fat_g ?? 0;

  const rows = [
    { label: "Calories", target: tCal, logged: todayMacros?.kcal ?? 0, unit: "" },
    { label: "Protein", target: tProtein, logged: todayMacros?.protein ?? 0, unit: "g" },
    { label: "Carbs", target: tCarbs, logged: todayMacros?.carbs ?? 0, unit: "g" },
    { label: "Fat", target: tFat, logged: todayMacros?.fat ?? 0, unit: "g" },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 mb-2">Client Macro Targets</h4>
        {targets?.hasTargets ? (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-white">{tCal}</p>
              <p className="text-[10px] text-white/40">Cal</p>
            </div>
            <div>
              <p className="text-sm font-bold text-blue-300">{tProtein}g</p>
              <p className="text-[10px] text-white/40">Protein</p>
            </div>
            <div>
              <p className="text-sm font-bold text-orange-300">{tCarbs}g</p>
              <p className="text-[10px] text-white/40">Carbs</p>
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-300">{tFat}g</p>
              <p className="text-[10px] text-white/40">Fat</p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-white/30 italic text-center">
            Client has not set macro targets yet
          </p>
        )}
      </div>

      {targets?.hasTargets && (
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <h4 className="text-xs font-medium text-white/60 mb-2">Today's Logged vs Target</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/40">
                <th className="text-left font-medium py-1">Macro</th>
                <th className="text-right font-medium py-1">Target</th>
                <th className="text-right font-medium py-1">Logged</th>
                <th className="text-right font-medium py-1">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const delta = row.logged - row.target;
                return (
                  <tr key={row.label} className="border-t border-white/5">
                    <td className="py-1.5 text-white/70">{row.label}</td>
                    <td className="py-1.5 text-right text-white/50">{row.target}{row.unit}</td>
                    <td className="py-1.5 text-right text-white">{row.logged}{row.unit}</td>
                    <td className="py-1.5 text-right">
                      <DeltaBadge delta={delta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {todayMacros && todayMacros.kcal === 0 && todayMacros.protein === 0 && (
            <p className="text-[10px] text-white/30 mt-1.5 text-center italic">
              No macros logged by client today
            </p>
          )}
        </div>
      )}

      {bodyComp && (
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <h4 className="text-xs font-medium text-white/60 mb-1">Body Composition</h4>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-white">
              Body Fat: <strong>{parseFloat(bodyComp.currentBodyFatPct).toFixed(1)}%</strong>
            </span>
            {bodyComp.goalBodyFatPct && (
              <span className="text-white/50">
                Goal: {parseFloat(bodyComp.goalBodyFatPct).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            {bodyComp.scanMethod} &middot; {new Date(bodyComp.recordedAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
