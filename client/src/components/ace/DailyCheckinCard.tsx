import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { useTodaysCheckin, type CheckinIntervention } from "@/hooks/useDailyCheckin";
import DailyCheckinModal from "@/components/ace/DailyCheckinModal";

// ─── Metric display helpers ───────────────────────────────────────────────────

const ENERGY_LABELS: Record<number, string>   = { 1: "Drained", 2: "Low", 3: "Okay", 4: "Good", 5: "High" };
const STRESS_LABELS: Record<number, string>   = { 1: "Calm", 2: "Low", 3: "Moderate", 4: "High", 5: "Maxed" };
const SLEEP_LABELS:  Record<number, string>   = { 1: "Poor", 2: "Low", 3: "Fair", 4: "Good", 5: "Great" };
const MOOD_LABELS:   Record<number, string>   = { 1: "Down", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
const CRAVING_LABELS: Record<number, string>  = { 1: "None", 2: "Low", 3: "Moderate", 4: "Strong", 5: "Intense" };

function positiveColor(v: number | null): string {
  if (v === null) return "text-white/50";
  if (v >= 4) return "text-green-400";
  if (v === 3) return "text-white";
  return "text-orange-400";
}

function inverseColor(v: number | null): string {
  if (v === null) return "text-white/50";
  if (v <= 2) return "text-green-400";
  if (v === 3) return "text-white";
  return "text-orange-400";
}

interface MetricPillProps {
  label: string;
  display: string | undefined;
  colorClass: string;
}

function MetricPill({ label, display, colorClass }: MetricPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-white uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{display ?? "—"}</span>
    </div>
  );
}

// ─── Builder route map ────────────────────────────────────────────────────────

const BUILDER_ROUTES: Record<string, string> = {
  "create-dish":      "/lifestyle/create-a-dish",
  "snack-creator":    "/craving-creator",
  "beverage-creator": "/lifestyle/beverage-creator",
  "fridge-rescue":    "/fridge-rescue",
  "meal-planner":     "/weekly-meal-board",
  "craving-creator":  "/craving-creator",
  "restaurant-guide": "/social-hub/restaurant-guide",
  "breakfast":        "/lifestyle/create-a-dish",
  "lunch":            "/lifestyle/create-a-dish",
  "dinner":           "/lifestyle/create-a-dish",
  "dessert-creator":  "/craving-desserts",
};

const BUILDER_NAMES: Record<string, string> = {
  "create-dish":      "Create a Dish",
  "snack-creator":    "Craving Creator",
  "beverage-creator": "Beverage Creator",
  "fridge-rescue":    "Fridge Rescue",
  "meal-planner":     "Weekly Meal Board",
  "craving-creator":  "Craving Creator",
  "restaurant-guide": "Restaurant Guide",
  "breakfast":        "Breakfast Builder",
  "lunch":            "Lunch Builder",
  "dinner":           "Dinner Builder",
  "dessert-creator":  "Dessert Creator",
};

// ─── Deterministic reasoning engine ──────────────────────────────────────────

function buildReasoningPoints(checkin: Record<string, unknown>): string[] {
  const get = (f: string): number | null => {
    const v = checkin[f];
    return typeof v === "number" ? v : null;
  };
  const schedule = checkin["schedule"] as string | null | undefined;
  const points: string[] = [];

  if ((get("stress") ?? 3) >= 4) points.push("Stress is higher than usual");
  if ((get("energy") ?? 3) <= 2) points.push("Energy levels are running low");
  if ((get("sleep") ?? 3) <= 2) points.push("Sleep quality was below average");
  if ((get("cravings") ?? 3) >= 4) points.push("Cravings are stronger than normal");
  if ((get("mood") ?? 3) <= 2) points.push("Mood is lower than usual today");
  if ((get("motivation") ?? 3) <= 2) points.push("Motivation is running low");
  if ((get("emotional_eating_risk") ?? 1) >= 4) points.push("Emotional eating risk is elevated");
  if ((get("digestion") ?? 3) <= 2) points.push("Digestive comfort is reduced today");
  if ((get("soreness") ?? 3) >= 4) points.push("Muscle soreness is elevated");
  if ((get("hunger") ?? 3) === 1) points.push("Appetite is very low — meal skipping risk");
  if (schedule === "travel") points.push("Today's routine is disrupted by travel");
  if (schedule === "busy") points.push("Today is a busy, high-demand day");

  return points.slice(0, 4);
}

type Confidence = "HIGH" | "MODERATE" | "LOW";

function computeConfidence(points: string[]): Confidence {
  if (points.length >= 3) return "HIGH";
  if (points.length >= 1) return "MODERATE";
  return "LOW";
}

const CONFIDENCE_STYLES: Record<Confidence, { label: string; color: string; bg: string }> = {
  HIGH:     { label: "HIGH",     color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  MODERATE: { label: "MODERATE", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  LOW:      { label: "LOW",      color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
};

const CONFIDENCE_DESCRIPTIONS: Record<Confidence, string> = {
  HIGH:     "Multiple signals today are pointing the same direction.",
  MODERATE: "One or two signals are shaping today's recommendation.",
  LOW:      "Signals look balanced — recommendation is a general tune-up.",
};

const BALANCED_GAME_PLAN = [
  "Keep meals consistent with your usual plan",
  "Prioritize hydration throughout the day",
  "Stay the course — a steady day is a win",
];

// ─── Checked state inner component ───────────────────────────────────────────

function CheckedInState({
  checkin,
  interventions,
  onUpdate,
}: {
  checkin: Record<string, unknown>;
  interventions: CheckinIntervention[];
  onUpdate: () => void;
}) {
  const [, setLocation] = useLocation();

  const get = (f: string): number | null => {
    const v = checkin[f];
    return typeof v === "number" ? v : null;
  };

  const top = interventions[0] ?? null;
  const reasoningPoints = buildReasoningPoints(checkin);
  const confidence = computeConfidence(reasoningPoints);
  const confStyle = CONFIDENCE_STYLES[confidence];
  const gamePlan: string[] = top ? top.strategies.slice(0, 3) : BALANCED_GAME_PLAN;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-orange-400 text-sm">✓</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Today's Coaching Context</p>
            <p className="text-[11px] text-white">Checked in today</p>
          </div>
        </div>
        <PillButton
          onClick={onUpdate}
          className="bg-white/10 text-white border-white/20 text-xs shrink-0"
        >
          Update
        </PillButton>
      </div>

      {/* Metric summary row */}
      <div className="flex gap-4 flex-wrap">
        <MetricPill
          label="Energy"
          display={get("energy") !== null ? ENERGY_LABELS[get("energy")!] : undefined}
          colorClass={positiveColor(get("energy"))}
        />
        <MetricPill
          label="Mood"
          display={get("mood") !== null ? MOOD_LABELS[get("mood")!] : undefined}
          colorClass={positiveColor(get("mood"))}
        />
        <MetricPill
          label="Stress"
          display={get("stress") !== null ? STRESS_LABELS[get("stress")!] : undefined}
          colorClass={inverseColor(get("stress"))}
        />
        <MetricPill
          label="Sleep"
          display={get("sleep") !== null ? SLEEP_LABELS[get("sleep")!] : undefined}
          colorClass={positiveColor(get("sleep"))}
        />
        <MetricPill
          label="Cravings"
          display={get("cravings") !== null ? CRAVING_LABELS[get("cravings")!] : undefined}
          colorClass={inverseColor(get("cravings"))}
        />
      </div>

      <div className="border-t border-white/10 pt-4 space-y-4">

        {/* Coach's Reasoning */}
        {reasoningPoints.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-white uppercase tracking-wider font-semibold">
              Why I'm recommending this today
            </p>
            <ul className="space-y-1">
              {reasoningPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-white">
                  <span className="text-orange-400 shrink-0">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence */}
        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${confStyle.bg}`}>
          <span className="text-white uppercase tracking-wider text-[10px]">Confidence</span>
          <span className={`font-bold ${confStyle.color}`}>{confStyle.label}</span>
          <span className="text-white hidden sm:inline">— {CONFIDENCE_DESCRIPTIONS[confidence]}</span>
        </div>

        {/* Today's Game Plan */}
        <div className="space-y-2">
          <p className="text-[11px] text-orange-400 font-semibold uppercase tracking-wider">
            Today's Game Plan
          </p>
          <ul className="space-y-1.5">
            {gamePlan.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-white">
                <span className="text-orange-500 shrink-0 font-bold">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Actions */}
        {top && top.suggested_builders.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-white uppercase tracking-wider font-semibold">Quick Actions</p>
            <div className="flex gap-2 flex-wrap">
              {top.suggested_builders.slice(0, 3).map((key) => {
                const route = BUILDER_ROUTES[key];
                const name = BUILDER_NAMES[key] ?? key;
                if (!route) return null;
                return (
                  <PillButton
                    key={key}
                    onClick={() => setLocation(route)}
                    className="bg-orange-600/20 text-orange-300 border-orange-500/30 text-xs hover:bg-orange-600/35"
                  >
                    {name}
                  </PillButton>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function DailyCheckinCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useTodaysCheckin();

  const checkin = data?.checkin as Record<string, unknown> | null | undefined;
  const interventions: CheckinIntervention[] = data?.interventions ?? [];
  const hasCheckin = !!checkin;

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
              <CheckedInState
                checkin={checkin!}
                interventions={interventions}
                onUpdate={() => setModalOpen(true)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                    <span className="text-orange-400 text-base">📋</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">How are you doing today?</p>
                    <p className="text-[11px] text-white">60-second daily check-in</p>
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
