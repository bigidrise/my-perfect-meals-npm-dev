import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

type OfflineDay = {
  day: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
};

type ChartDay = {
  label: string;
  fullDate: string;
  protein: number;
  unsplitCarbs: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  fat: number;
  totalCarbs: number;
  kcal: number;
  hasCarbSplit: boolean;
};

interface Props {
  macroRows: OfflineDay[];
}

function makeKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function buildDays(macroRows: OfflineDay[], n: number): ChartDay[] {
  const byDay = new Map<string, OfflineDay>();
  for (const r of macroRows) byDay.set(r.day, r);

  const out: ChartDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = makeKey(d);
    const row = byDay.get(key);

    const sc = Number(row?.starchyCarbs) || 0;
    const fc = Number(row?.fibrousCarbs) || 0;
    const totalCarbs = Number(row?.carbs) || 0;
    // Unsplit carbs = whatever carbs are NOT already accounted for by starchy/fibrous
    // When split mode is used: carbs = SC + FC, so unsplitCarbs = 0
    // When non-split: carbs = total, SC = FC = 0, so unsplitCarbs = total
    // Mixed days: correctly preserves both portions
    const unsplitCarbs = Math.max(0, totalCarbs - sc - fc);

    out.push({
      label: formatLabel(key),
      fullDate: key,
      protein: Number(row?.protein) || 0,
      unsplitCarbs,
      starchyCarbs: sc,
      fibrousCarbs: fc,
      fat: Number(row?.fat) || 0,
      totalCarbs,
      kcal: Number(row?.kcal) || 0,
      hasCarbSplit: sc > 0 || fc > 0,
    });
  }
  return out;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ChartDay;
  return (
    <div className="rounded-xl bg-black/95 border border-white/20 p-3 text-white text-xs space-y-1.5 min-w-[150px]">
      <div className="font-semibold text-white/70 mb-1">{d.fullDate}</div>
      <div className="flex justify-between gap-6">
        <span className="text-orange-400">Protein</span>
        <span className="font-medium">{d.protein}g</span>
      </div>
      {d.hasCarbSplit ? (
        <>
          {d.unsplitCarbs > 0 && (
            <div className="flex justify-between gap-6">
              <span className="text-amber-400">Carbs</span>
              <span className="font-medium">{d.unsplitCarbs}g</span>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <span className="text-yellow-300">Starchy Carbs</span>
            <span className="font-medium">{d.starchyCarbs}g</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-lime-400">Fibrous Carbs</span>
            <span className="font-medium">{d.fibrousCarbs}g</span>
          </div>
          {d.totalCarbs > 0 && (
            <div className="flex justify-between gap-6 border-t border-white/10 pt-1 text-white/40">
              <span>Total Carbs</span>
              <span>{d.totalCarbs}g</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex justify-between gap-6">
          <span className="text-amber-400">Carbs</span>
          <span className="font-medium">{d.totalCarbs}g</span>
        </div>
      )}
      <div className="flex justify-between gap-6">
        <span className="text-slate-400">Fat</span>
        <span className="font-medium">{d.fat}g</span>
      </div>
      {d.kcal > 0 && (
        <div className="border-t border-white/10 pt-1.5 flex justify-between gap-6 text-white/40">
          <span>Calories</span>
          <span>{d.kcal} kcal</span>
        </div>
      )}
    </div>
  );
};

type ViewKey = "7" | "30" | "90" | "180" | "365";

const VIEW_OPTIONS: { key: ViewKey; label: string }[] = [
  { key: "7",   label: "1W"  },
  { key: "30",  label: "1M"  },
  { key: "90",  label: "3M"  },
  { key: "180", label: "6M"  },
  { key: "365", label: "12M" },
];

function tickIntervalFor(v: ViewKey): number {
  if (v === "7")   return 0;
  if (v === "30")  return 4;
  if (v === "90")  return 8;
  if (v === "180") return 14;
  return 29;
}

function barSizeFor(v: ViewKey): number {
  if (v === "7")   return 22;
  if (v === "30")  return 7;
  if (v === "90")  return 4;
  if (v === "180") return 3;
  return 2;
}

export default function MacroConsistencyTimeline({ macroRows }: Props) {
  const [view, setView] = useState<ViewKey>("7");
  const days = useMemo(
    () => buildDays(macroRows, parseInt(view)),
    [macroRows, view]
  );

  const hasAnyData = days.some(
    (d) => d.protein > 0 || d.totalCarbs > 0 || d.fat > 0
  );
  const anyCarbSplit = days.some((d) => d.hasCarbSplit);
  const tickInterval = tickIntervalFor(view);
  const barSize = barSizeFor(view);

  return (
    <Card
      data-testid="biometrics-macro-consistency-section"
      className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-400" />
            Macro Consistency
          </CardTitle>
          <p className="text-xs text-white/40 mt-0.5">
            {anyCarbSplit
              ? "Protein · Starchy · Fibrous · Fat"
              : "Protein · Carbs · Fat · Log meals to see trends"}
          </p>
        </div>
        <div className="flex gap-0.5 bg-black/30 p-1 rounded-lg shrink-0">
          {VIEW_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                view === key ? "bg-white/20 text-white" : "text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {!hasAnyData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <TrendingUp className="h-10 w-10 text-white/15" />
            <p className="text-white/50 text-sm font-medium">
              Log meals for a few days to see your macro consistency.
            </p>
            <p className="text-white/30 text-xs max-w-xs">
              Use MacroScan or describe a meal above to start tracking.
            </p>
          </div>
        ) : (
          <>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={days}
                  barSize={barSize}
                  barCategoryGap="20%"
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#333"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#fff" }}
                    interval={tickInterval}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#888" }}
                    axisLine={false}
                    tickLine={false}
                    unit="g"
                    width={34}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar
                    dataKey="protein"
                    name="Protein"
                    stackId="macros"
                    fill="#f97316"
                  />
                  <Bar
                    dataKey="unsplitCarbs"
                    name="Carbs"
                    stackId="macros"
                    fill="#fbbf24"
                  />
                  <Bar
                    dataKey="starchyCarbs"
                    name="Starchy Carbs"
                    stackId="macros"
                    fill="#eab308"
                  />
                  <Bar
                    dataKey="fibrousCarbs"
                    name="Fibrous Carbs"
                    stackId="macros"
                    fill="#84cc16"
                  />
                  <Bar
                    dataKey="fat"
                    name="Fat"
                    stackId="macros"
                    fill="#64748b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <div className="w-3 h-3 rounded-sm bg-orange-500 shrink-0" />
                <span>Protein</span>
              </div>
              {anyCarbSplit ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <div className="w-3 h-3 rounded-sm bg-yellow-500 shrink-0" />
                    <span>Starchy</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <div className="w-3 h-3 rounded-sm bg-lime-500 shrink-0" />
                    <span>Fibrous</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <div className="w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
                  <span>Carbs</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <div className="w-3 h-3 rounded-sm bg-slate-500 shrink-0" />
                <span>Fat</span>
              </div>
            </div>

            <p className="text-xs text-white/25 text-center mt-3">
              Calories shown as context — tap any bar to view
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
