import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { useTodaysCheckin } from "@/hooks/useDailyCheckin";
import DailyCheckinModal from "@/components/ace/DailyCheckinModal";

const ENERGY_LABELS: Record<number, string> = { 1: "Drained", 2: "Low", 3: "Okay", 4: "Good", 5: "High" };
const STRESS_LABELS: Record<number, string> = { 1: "Calm", 2: "Low", 3: "Moderate", 4: "High", 5: "Maxed" };
const SLEEP_LABELS:  Record<number, string> = { 1: "Poor", 2: "Low", 3: "Fair", 4: "Good", 5: "Great" };
const MOOD_LABELS:   Record<number, string> = { 1: "Down", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
const CRAVING_LABELS: Record<number, string> = { 1: "None", 2: "Low", 3: "Moderate", 4: "Strong", 5: "Intense" };

function positiveColor(v: number | null): string {
  if (v === null) return "text-white/30";
  if (v >= 4) return "text-green-400";
  if (v === 3) return "text-white/60";
  return "text-orange-400";
}

function inverseColor(v: number | null): string {
  if (v === null) return "text-white/30";
  if (v <= 2) return "text-green-400";
  if (v === 3) return "text-white/60";
  return "text-orange-400";
}

interface MetricPillProps {
  label: string;
  value: number | null;
  display: string | undefined;
  colorClass: string;
}

function MetricPill({ label, display, colorClass }: MetricPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>
        {display ?? "—"}
      </span>
    </div>
  );
}

export function DailyCheckinCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useTodaysCheckin();

  const checkin = data?.checkin as Record<string, unknown> | null | undefined;
  const hasCheckin = !!checkin;

  const get = (field: string): number | null => {
    const v = checkin?.[field];
    return typeof v === "number" ? v : null;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45 }}
        className="mb-4"
      >
        <Card className="bg-black/30 backdrop-blur-lg border border-orange-500/25 rounded-xl shadow-md">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-white/10 rounded animate-pulse w-40" />
                  <div className="h-2.5 bg-white/10 rounded animate-pulse w-24" />
                </div>
              </div>
            ) : hasCheckin ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-orange-400 text-sm">✓</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Today's Check-In</p>
                      <p className="text-[11px] text-white/40">Checked in today</p>
                    </div>
                  </div>
                  <PillButton
                    onClick={() => setModalOpen(true)}
                    className="bg-white/10 text-white/70 border-white/20 text-xs shrink-0"
                  >
                    Update
                  </PillButton>
                </div>

                <div className="flex gap-4 flex-wrap pt-0.5">
                  <MetricPill
                    label="Energy"
                    value={get("energy")}
                    display={get("energy") !== null ? ENERGY_LABELS[get("energy")!] : undefined}
                    colorClass={positiveColor(get("energy"))}
                  />
                  <MetricPill
                    label="Mood"
                    value={get("mood")}
                    display={get("mood") !== null ? MOOD_LABELS[get("mood")!] : undefined}
                    colorClass={positiveColor(get("mood"))}
                  />
                  <MetricPill
                    label="Stress"
                    value={get("stress")}
                    display={get("stress") !== null ? STRESS_LABELS[get("stress")!] : undefined}
                    colorClass={inverseColor(get("stress"))}
                  />
                  <MetricPill
                    label="Sleep"
                    value={get("sleep")}
                    display={get("sleep") !== null ? SLEEP_LABELS[get("sleep")!] : undefined}
                    colorClass={positiveColor(get("sleep"))}
                  />
                  <MetricPill
                    label="Cravings"
                    value={get("cravings")}
                    display={get("cravings") !== null ? CRAVING_LABELS[get("cravings")!] : undefined}
                    colorClass={inverseColor(get("cravings"))}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                    <span className="text-orange-400 text-base">📋</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">How are you doing today?</p>
                    <p className="text-[11px] text-white/45">60-second daily check-in</p>
                  </div>
                </div>
                <PillButton
                  onClick={() => setModalOpen(true)}
                  className="bg-orange-600 text-white border-orange-500 text-xs font-semibold shrink-0"
                >
                  Check In
                </PillButton>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <DailyCheckinModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
