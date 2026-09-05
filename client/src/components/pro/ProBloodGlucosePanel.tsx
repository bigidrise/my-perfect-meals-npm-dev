import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  Target,
} from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ProfessionalGlucoseContext,
  ProfessionalGlucoseHistoryResponse,
  ProfessionalGlucosePeriod,
  ProfessionalGlucoseReading,
} from "@shared/professionalGlucose";
import { PROFESSIONAL_GLUCOSE_PERIODS } from "@shared/professionalGlucose";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { PillButton } from "@/components/ui/pill-button";

interface ProBloodGlucosePanelProps {
  clientId: string;
}

const CONTEXT_LABELS: Record<ProfessionalGlucoseContext, string> = {
  FASTED: "Fasting",
  PRE_MEAL: "Pre-meal",
  POST_MEAL_1H: "1-hour post-meal",
  POST_MEAL_2H: "2-hour post-meal",
  RANDOM: "Other",
};

const CONTEXT_COLORS: Record<ProfessionalGlucoseContext, string> = {
  FASTED: "#fb923c",
  PRE_MEAL: "#38bdf8",
  POST_MEAL_1H: "#a78bfa",
  POST_MEAL_2H: "#34d399",
  RANDOM: "#facc15",
};

function relativeTime(recordedAt: string): string {
  const ageMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(recordedAt).getTime()) / 60_000),
  );
  if (ageMinutes < 1) return "Recorded just now";
  if (ageMinutes < 60) return `Recorded ${ageMinutes} minutes ago`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `Recorded ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Recorded ${days} ${days === 1 ? "day" : "days"} ago`;
}

function rangeText(
  min: number | null,
  max: number | null,
): string {
  if (min !== null && max !== null) return `${min}–${max} mg/dL`;
  if (min !== null) return `At or above ${min} mg/dL`;
  if (max !== null) return `At or below ${max} mg/dL`;
  return "Unavailable";
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const reading = payload[0].payload as ProfessionalGlucoseReading & {
    timestamp: number;
  };
  return (
    <div className="rounded-lg border border-white/20 bg-black/95 px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-bold">
        {reading.value} {reading.unit}
      </p>
      <p className="mt-0.5 text-gray-200">
        {CONTEXT_LABELS[reading.context]}
      </p>
      <p className="text-gray-300">
        {reading.patientLocalDate} · {reading.patientLocalTime}
      </p>
    </div>
  );
}

export default function ProBloodGlucosePanel({
  clientId,
}: ProBloodGlucosePanelProps) {
  const [period, setPeriod] = useState<ProfessionalGlucosePeriod>(14);
  const [data, setData] =
    useState<ProfessionalGlucoseHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      apiUrl(
        `/api/pro/clients/${encodeURIComponent(clientId)}/glucose-history?period=${period}`,
      ),
      {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.message || "Blood glucose history could not be loaded.",
          );
        }
        return response.json();
      })
      .then((body) => setData(body))
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") {
          setData(null);
          setError(requestError?.message || "Blood glucose history could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [clientId, period]);

  const chartGroups = useMemo(() => {
    if (!data) return [];
    return Object.entries(CONTEXT_LABELS)
      .map(([context, label]) => ({
        context: context as ProfessionalGlucoseContext,
        label,
        readings: data.readings
          .filter((reading) => reading.context === context)
          .map((reading) => ({
            ...reading,
            timestamp: new Date(reading.recordedAt).getTime(),
          })),
      }))
      .filter((group) => group.readings.length > 0);
  }, [data]);

  const latest = data?.latestReading ?? null;

  return (
    <section
      className="overflow-hidden rounded-xl border border-orange-500/30 bg-[#0f0f0f]"
      aria-label="Blood glucose history"
      data-testid="physician-glucose-panel"
    >
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">
              Clinical monitoring
            </p>
            <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-white">
              <Activity className="h-4 w-4 text-orange-400" />
              Blood Glucose
            </h3>
            <p className="mt-1 text-xs text-gray-300">
              Patient-entered readings shown by recorded context.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="History period">
            {PROFESSIONAL_GLUCOSE_PERIODS.map((days) => (
              <PillButton
                key={days}
                type="button"
                active={period === days}
                variant="amber"
                onClick={() => setPeriod(days)}
                aria-pressed={period === days}
                data-testid={`glucose-period-${days}`}
              >
                {days} days
              </PillButton>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-200">
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            Loading blood glucose history…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
            {error}
          </div>
        )}

        {!loading && !error && data?.dataStatus === "no_data" && (
          <div className="rounded-lg border border-white/15 bg-white/5 p-4">
            <p className="font-semibold text-white">No readings recorded</p>
            <p className="mt-1 text-sm text-gray-300">
              No patient-entered blood glucose readings were recorded during
              this {period}-day period.
            </p>
          </div>
        )}

        {!loading && !error && data && latest && (
          <>
            <div className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-300">
                  Latest reading
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-bold text-white">
                    {latest.value}
                    <span className="ml-1 text-sm font-medium text-gray-200">
                      {latest.unit}
                    </span>
                  </p>
                  <p className="pb-1 text-sm font-semibold text-orange-200">
                    {CONTEXT_LABELS[latest.context]}
                  </p>
                </div>
                <p className="mt-2 text-sm text-gray-200">
                  {latest.patientLocalDate} · {latest.patientLocalTime}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  {relativeTime(latest.recordedAt)}
                </p>
                {latest.rangeStatus !== "unavailable" &&
                  latest.rangeStatus !== "in_range" && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Outside the configured patient range
                    </p>
                  )}
                {latest.note && (
                  <p className="mt-3 border-t border-white/10 pt-3 text-xs text-gray-200">
                    Patient note: {latest.note}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {data.freshness.status === "stale" && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                      <Clock3 className="h-4 w-4" />
                      Latest reading is more than 7 days old
                    </p>
                    <p className="mt-1 text-xs text-gray-200">
                      This is a data-freshness notice, not a clinical alert.
                    </p>
                  </div>
                )}
                {data.dataStatus === "insufficient_data" && (
                  <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">
                      Limited history
                    </p>
                    <p className="mt-1 text-xs text-gray-300">
                      Fewer than three readings are available for this period.
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-300">
                    Readings in period
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {data.readingCount}
                  </p>
                </div>
              </div>
            </div>

            {data.readingCount >= 2 && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">
                    Readings by context
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {chartGroups.map((group) => (
                      <span
                        key={group.context}
                        className="inline-flex items-center gap-1 text-[10px] text-gray-200"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: CONTEXT_COLORS[group.context],
                          }}
                        />
                        {group.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        dataKey="timestamp"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        }
                        tick={{ fill: "#d1d5db", fontSize: 10 }}
                        stroke="rgba(255,255,255,0.18)"
                      />
                      <YAxis
                        type="number"
                        dataKey="value"
                        unit=""
                        domain={["dataMin - 15", "dataMax + 15"]}
                        tick={{ fill: "#d1d5db", fontSize: 10 }}
                        stroke="rgba(255,255,255,0.18)"
                      />
                      <Tooltip content={<ChartTooltip />} />
                      {chartGroups.map((group) => (
                        <Scatter
                          key={group.context}
                          name={group.label}
                          data={group.readings}
                          fill={CONTEXT_COLORS[group.context]}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[10px] text-gray-300">
                  Contexts are plotted separately; values are not combined into
                  a single clinical trend.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                Averages by context
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.averagesByContext.map((summary) => (
                  <div
                    key={summary.context}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <p className="text-xs text-gray-200">
                      {CONTEXT_LABELS[summary.context]}
                    </p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {summary.averageMgdl}{" "}
                      <span className="text-xs font-medium text-gray-300">
                        mg/dL
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-300">
                      {summary.readingCount}{" "}
                      {summary.readingCount === 1 ? "reading" : "readings"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-400" />
                <p className="text-xs font-semibold text-white">
                  Patient-specific targets
                </p>
              </div>
              {data.targetStatus === "unavailable" ? (
                <p className="mt-2 text-sm text-gray-300">
                  No authoritative patient-specific glucose target is available.
                </p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(data.targetRanges).map(
                      ([context, target]) =>
                        target && (
                          <div
                            key={context}
                            className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                          >
                            <p className="text-[10px] text-gray-300">
                              {CONTEXT_LABELS[
                                context as ProfessionalGlucoseContext
                              ]}
                            </p>
                            <p className="text-xs font-semibold text-white">
                              {rangeText(target.minMgdl, target.maxMgdl)}
                            </p>
                          </div>
                        ),
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["In range", data.rangeCounts.inRange],
                      ["Above range", data.rangeCounts.aboveRange],
                      ["Below range", data.rangeCounts.belowRange],
                      ["No matching target", data.rangeCounts.unavailable],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg bg-black/25 px-2.5 py-2"
                      >
                        <p className="text-[10px] text-gray-300">{label}</p>
                        <p className="text-base font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-300">
                    Targets come from the patient’s stored clinical guardrails.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}