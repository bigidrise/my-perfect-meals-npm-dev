import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { useTodaysCheckin, type CheckinIntervention } from "@/hooks/useDailyCheckin";
import DailyCheckinModal from "@/components/ace/DailyCheckinModal";
import { buildTodaysNutritionAdjustment } from "@/lib/ace/buildTodaysNutritionAdjustment";
import { getAssignedBuilderFromStorage } from "@/lib/assignedBuilder";

// ─── Metric display helpers ───────────────────────────────────────────────────

const ENERGY_LABELS: Record<number, string>  = { 1: "Drained", 2: "Low", 3: "Okay", 4: "Good", 5: "High" };
const STRESS_LABELS: Record<number, string>  = { 1: "Calm", 2: "Low", 3: "Moderate", 4: "High", 5: "Maxed" };
const SLEEP_LABELS:  Record<number, string>  = { 1: "Poor", 2: "Low", 3: "Fair", 4: "Good", 5: "Great" };
const MOOD_LABELS:   Record<number, string>  = { 1: "Down", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
const CRAVING_LABELS: Record<number, string> = { 1: "None", 2: "Low", 3: "Moderate", 4: "Strong", 5: "Intense" };

function positiveColor(v: number | null): string {
  if (v === null) return "text-white";
  if (v >= 4) return "text-green-400";
  if (v === 3) return "text-white";
  return "text-orange-400";
}

function inverseColor(v: number | null): string {
  if (v === null) return "text-white";
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
      <span className="text-xs text-white uppercase tracking-wider">{label}</span>
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

// ─── Meal moment label ────────────────────────────────────────────────────────

const MEAL_MOMENT_LABELS: Record<string, string> = {
  breakfast:   "This morning",
  lunch:       "For lunch",
  snack:       "For your snack",
  dinner:      "For dinner",
  "next meal": "Next meal",
  today:       "For today",
};

// ─── Reasoning points (why this was triggered) ───────────────────────────────

function buildReasoningPoints(checkin: Record<string, unknown>): string[] {
  const get = (f: string): number | null => {
    const v = checkin[f];
    return typeof v === "number" ? v : null;
  };
  const schedule = checkin["schedule"] as string | null | undefined;
  const points: string[] = [];

  if ((get("stress") ?? 3) >= 4)               points.push("Stress is higher than usual");
  if ((get("energy") ?? 3) <= 2)               points.push("Energy levels are running low");
  if ((get("sleep") ?? 3) <= 2)                points.push("Sleep quality was below average");
  if ((get("cravings") ?? 3) >= 4)             points.push("Cravings are stronger than normal");
  if ((get("mood") ?? 3) <= 2)                 points.push("Mood is lower than usual today");
  if ((get("motivation") ?? 3) <= 2)           points.push("Motivation is running low");
  if ((get("emotional_eating_risk") ?? 1) >= 4) points.push("Emotional eating risk is elevated");
  if ((get("digestion") ?? 3) <= 2)            points.push("Digestive comfort is reduced today");
  if ((get("soreness") ?? 3) >= 4)             points.push("Muscle soreness is elevated");
  if ((get("hunger") ?? 3) === 1)              points.push("Appetite is very low — meal skipping risk");
  if (schedule === "travel")                   points.push("Today's routine is disrupted by travel");
  if (schedule === "busy")                     points.push("Today is a busy, high-demand day");

  return points.slice(0, 4);
}

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
  const adjustment = top ? buildTodaysNutritionAdjustment(checkin, top.key) : null;

  // Route the CTA to the user's actual assigned builder — unless this is a
  // deliberate environment exception (travel/vacation → Restaurant Guide).
  const RESTAURANT_GUIDE_ROUTE = "/social-hub/restaurant-guide";
  const isEnvironmentException = adjustment?.recommendedRoute === RESTAURANT_GUIDE_ROUTE;
  const assignedBuilder = getAssignedBuilderFromStorage();
  const ctaRoute = isEnvironmentException ? RESTAURANT_GUIDE_ROUTE : assignedBuilder.path;

  const supplementaryBuilders = top
    ? top.suggested_builders.filter(
        (b) => BUILDER_ROUTES[b] !== ctaRoute
      ).slice(0, 2)
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-orange-400 text-sm">✓</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Today's Coaching</p>
            <p className="text-xs text-white">Checked in today</p>
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

        {/* Today's signals */}
        {reasoningPoints.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white uppercase tracking-wider font-semibold">
              Today's signals
            </p>
            <ul className="space-y-1">
              {reasoningPoints.map((pt, i) => (
                <li key={i} className="flex gap-2 text-xs text-white">
                  <span className="text-orange-400 shrink-0">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Today's Nutrition Adjustment */}
        {adjustment ? (
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 space-y-3">
            {/* Section label + meal moment */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-orange-400 uppercase tracking-wider font-semibold">
                Today's Nutrition Adjustment
              </p>
              <span className="text-xs text-white bg-white/10 rounded px-2 py-0.5">
                {MEAL_MOMENT_LABELS[adjustment.recommendedMealMoment] ?? "Next meal"}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-semibold text-white leading-snug">
              {adjustment.adjustmentTitle}
            </p>

            {/* Message */}
            <p className="text-xs text-white leading-relaxed">
              {adjustment.adjustmentMessage}
            </p>

            {/* Primary action button — routes to user's actual assigned builder */}
            <button
              onClick={() => setLocation(ctaRoute)}
              className="w-full bg-orange-600 text-white text-xs font-semibold rounded-lg px-4 py-2.5 text-center"
            >
              {adjustment.recommendedActionLabel} →
            </button>

            {/* Teach the coach nudge */}
            <p className="text-xs text-white italic leading-relaxed">
              If this recommendation helps today, save it to Favorites. The more we learn what works, the better your coaching gets.
            </p>

            {/* Return to plan guidance */}
            <p className="text-xs text-white leading-relaxed">
              <span className="text-orange-400 uppercase text-xs tracking-wider font-semibold mr-1.5">Return to plan:</span>
              {adjustment.returnToPlanGuidance}
            </p>
          </div>
        ) : (
          /* Neutral day */
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 space-y-2">
            <p className="text-xs text-green-400 uppercase tracking-wider font-semibold">
              Today's Status
            </p>
            <p className="text-sm font-semibold text-white">You're on track — stay the course</p>
            <p className="text-xs text-white">
              All signals look balanced today. Keep meals consistent with your plan, stay hydrated, and maintain momentum.
            </p>
            <p className="text-xs text-white italic leading-relaxed pt-1 border-t border-white/10">
              We're still learning what works best for you. Right now your recommendations are based on your nutrition profile and today's check-in. As you use My Perfect Meals and save favorites, your coaching will become more personalized based on what actually works for you.
            </p>
          </div>
        )}

        {/* Supplementary quick actions */}
        {supplementaryBuilders.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-white uppercase tracking-wider font-semibold">Also try</p>
            <div className="flex gap-2 flex-wrap">
              {supplementaryBuilders.map((key) => {
                const route = BUILDER_ROUTES[key];
                const name = BUILDER_NAMES[key] ?? key;
                if (!route) return null;
                return (
                  <PillButton
                    key={key}
                    onClick={() => setLocation(route)}
                    className="bg-white/10 text-white border-white/20 text-xs"
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
                    <p className="text-xs text-white">60-second daily check-in</p>
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
