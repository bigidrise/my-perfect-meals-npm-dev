import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Activity, AlertTriangle, Syringe, Pill, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SparkPoint {
  value: number;
  date: string;
  context: string;
}

interface NutritionStrategyData {
  hasData: boolean;
  activeHubs: string[];
  diabetic: {
    type: "T1D" | "T2D" | "PRE_D" | "NONE";
    a1cPercent: string | null;
    hypoRisk: boolean;
    perMealCarbCeiling: number | null;
    mealFrequency: number;
    preferredCarbs: string[];
  } | null;
  glp1: {
    lastShotDate: string;
    daysSinceShot: number;
    doseMg?: string;
    injectionSite?: string;
  } | null;
  glucose: {
    sparkline: SparkPoint[];
    avgMgdl: number | null;
    trendLabel: "Stable" | "Elevated" | "High variability" | null;
    readingCount: number;
  };
  strategySummary: string;
  physicianOnly?: {
    insulinPattern: { avgUnits: number | null; readings: number } | null;
    medications: { name: string; dose?: string }[];
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  isPhysician: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TREND_COLORS: Record<string, string> = {
  "Stable": "text-emerald-400",
  "Elevated": "text-amber-400",
  "High variability": "text-red-400",
};

const TREND_BG: Record<string, string> = {
  "Stable": "bg-emerald-500/10 border-emerald-500/20",
  "Elevated": "bg-amber-500/10 border-amber-500/20",
  "High variability": "bg-red-500/10 border-red-500/20",
};

const HUB_LABEL: Record<string, string> = {
  diabetic: "Diabetic",
  glp1: "GLP-1",
};

const DIABETES_TYPE_LABEL: Record<string, string> = {
  T1D: "Type 1 Diabetes",
  T2D: "Type 2 Diabetes",
  PRE_D: "Pre-Diabetes",
  NONE: "No Diabetes",
};

function formatShotDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sparkline Tooltip ────────────────────────────────────────────────────────

function GlucoseTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as SparkPoint;
  return (
    <div className="bg-black/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
      <p className="font-bold">{pt.value} mg/dL</p>
      <p className="text-white/50">{pt.date} · {pt.context}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProNutritionStrategyCard({ clientId, isPhysician }: Props) {
  const [data, setData] = useState<NutritionStrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhysician, setShowPhysician] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(apiUrl(`/api/pro/clients/${clientId}/nutrition-strategy`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-2 text-white/40 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading nutrition protocol...
      </div>
    );
  }

  if (!data || !data.hasData) return null;

  const { activeHubs, diabetic, glp1, glucose, strategySummary, physicianOnly } = data;
  const trendLabel = glucose.trendLabel;

  return (
    <div className="rounded-xl border border-orange-500/15 bg-[#0f0f0f] overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-widest mb-1">
              Nutrition Protocol
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeHubs.map(hub => (
                <span key={hub} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">
                  {HUB_LABEL[hub] ?? hub}
                </span>
              ))}
            </div>
          </div>
          {trendLabel && (
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${TREND_BG[trendLabel]} ${TREND_COLORS[trendLabel]} shrink-0`}>
              {trendLabel}
            </span>
          )}
        </div>

        {/* Strategy summary line */}
        <p className="text-xs text-white/50 mt-2 leading-relaxed italic">
          {strategySummary}
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">

        {/* ── Diabetic guardrails ── */}
        {diabetic && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Diabetic Protocol
              </span>
              <span className="text-[10px] font-bold text-white/60">
                {DIABETES_TYPE_LABEL[diabetic.type] ?? diabetic.type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[9px] text-white/35 uppercase tracking-wide mb-0.5">Per-Meal Carb Limit</p>
                <p className="text-base font-bold text-white">
                  {diabetic.perMealCarbCeiling != null ? `${diabetic.perMealCarbCeiling}g` : "—"}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[9px] text-white/35 uppercase tracking-wide mb-0.5">Meal Frequency</p>
                <p className="text-base font-bold text-white">{diabetic.mealFrequency}x / day</p>
              </div>
            </div>

            {diabetic.hypoRisk && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300 font-medium">Hypoglycemia risk — be conservative with restriction</p>
              </div>
            )}

            {diabetic.preferredCarbs.length > 0 && (
              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wide mb-1">Preferred Carb Sources</p>
                <div className="flex flex-wrap gap-1">
                  {diabetic.preferredCarbs.slice(0, 6).map(c => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                      {c}
                    </span>
                  ))}
                  {diabetic.preferredCarbs.length > 6 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">
                      +{diabetic.preferredCarbs.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GLP-1 section ── */}
        {glp1 && (
          <div className="rounded-lg bg-white/5 border border-white/8 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Syringe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-white/70">GLP-1 Status</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 text-xs mt-1">
              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wide">Last Injection</p>
                <p className="text-white/80 font-medium mt-0.5">{formatShotDate(glp1.lastShotDate)}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/35 uppercase tracking-wide">Days Since Shot</p>
                <p className={`font-medium mt-0.5 ${glp1.daysSinceShot <= 3 ? "text-amber-400" : "text-white/80"}`}>
                  {glp1.daysSinceShot} {glp1.daysSinceShot === 1 ? "day" : "days"}
                  {glp1.daysSinceShot <= 3 && " · peak window"}
                </p>
              </div>
              {isPhysician && glp1.doseMg && (
                <div className="mt-2">
                  <p className="text-[9px] text-white/35 uppercase tracking-wide">Dose</p>
                  <p className="text-white/80 font-medium mt-0.5">{glp1.doseMg} mg · {glp1.injectionSite ?? "—"}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Glucose sparkline ── */}
        {glucose.sparkline.length >= 3 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  14-Day Glucose Trend
                </span>
              </div>
              {glucose.avgMgdl && (
                <span className="text-xs font-bold text-white/60">
                  avg {glucose.avgMgdl} mg/dL
                </span>
              )}
            </div>
            <div className="h-[64px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={glucose.sparkline} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <YAxis domain={["dataMin - 20", "dataMax + 20"]} hide />
                  <Tooltip content={<GlucoseTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={trendLabel === "Stable" ? "#34d399" : trendLabel === "Elevated" ? "#fbbf24" : "#f87171"}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[9px] text-white/25 mt-1">{glucose.readingCount} readings in the last 14 days</p>
          </div>
        )}

        {/* ── Physician-only section ── */}
        {isPhysician && physicianOnly && (
          <div className="border-t border-white/8 pt-3">
            <button
              onClick={() => setShowPhysician(p => !p)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-white/35 uppercase tracking-widest hover:text-white/50 transition-colors"
            >
              {showPhysician ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Physician Details
            </button>

            {showPhysician && (
              <div className="mt-3 space-y-3">

                {/* Insulin pattern */}
                {physicianOnly.insulinPattern && physicianOnly.insulinPattern.readings > 0 && (
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Syringe className="w-3 h-3 text-white/40" />
                      <p className="text-[9px] text-white/35 uppercase tracking-wide">Insulin (14-day avg)</p>
                    </div>
                    <p className="text-sm font-bold text-white">
                      {physicianOnly.insulinPattern.avgUnits != null
                        ? `${physicianOnly.insulinPattern.avgUnits} units`
                        : "No units logged"}
                    </p>
                    <p className="text-[9px] text-white/30 mt-0.5">
                      from {physicianOnly.insulinPattern.readings} logged readings
                    </p>
                  </div>
                )}

                {/* Medications */}
                {physicianOnly.medications && physicianOnly.medications.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Pill className="w-3 h-3 text-white/40" />
                      <p className="text-[9px] text-white/35 uppercase tracking-wide">Medications on File</p>
                    </div>
                    <div className="space-y-1">
                      {physicianOnly.medications.map((med, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5">
                          <span className="text-white/70 font-medium">{med.name}</span>
                          {med.dose && <span className="text-white/35">{med.dose}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
