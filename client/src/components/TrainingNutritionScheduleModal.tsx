/**
 * TrainingNutritionScheduleModal
 *
 * Platform capability — reuses the same schedule storage, resolver, and API
 * already used by the Performance Nutrition Hub. General, Diabetic, GLP-1, and
 * Anti-Inflammatory builders can surface this modal to give users training-day
 * macro adjustments without building a second scheduling system.
 *
 * Architecture rule: this modal owns only the schedule-assignment UI.
 * Macro baseline always comes from the active macro authority (Macro Calculator,
 * Coach, Physician, etc). This module never creates a baseline.
 */

import { useState } from "react";
import { Dumbbell, X, Zap, Check, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

// ── Types (mirrors PerformanceNutritionSetupForm) ─────────────────────────
type APNSessionType =
  | "strength"
  | "power"
  | "endurance"
  | "sport_practice"
  | "competition"
  | "recovery"
  | "off";

type APNTrainingPhase =
  | "stabilization"
  | "strength"
  | "power"
  | "peaking"
  | "in_season"
  | "off_season";

const APN_SESSION_TYPES: {
  value: APNSessionType;
  label: string;
  desc: string;
}[] = [
  {
    value: "strength",
    label: "Strength",
    desc: "Resistance training — moderate carbohydrate support",
  },
  {
    value: "power",
    label: "Power",
    desc: "Explosive output — additional carbs and protein active",
  },
  {
    value: "endurance",
    label: "Endurance",
    desc: "Aerobic fuel priority — elevated carbohydrate availability",
  },
  {
    value: "sport_practice",
    label: "Sport Practice",
    desc: "Mixed demands — moderate carbohydrate support",
  },
  {
    value: "competition",
    label: "Competition",
    desc: "Game day fueling — maximum carbohydrate availability",
  },
  {
    value: "recovery",
    label: "Recovery",
    desc: "Repair emphasis — reduced carbs, anti-inflammatory priority",
  },
  { value: "off", label: "Rest Day", desc: "Complete rest — reduced caloric targets" },
];

const APN_PHASES: { value: APNTrainingPhase; label: string; desc: string }[] = [
  {
    value: "stabilization",
    label: "Stabilization",
    desc: "Foundation phase — movement quality, core stability",
  },
  { value: "strength", label: "Strength", desc: "Building maximal force capacity" },
  {
    value: "power",
    label: "Power",
    desc: "Explosive output — force times velocity",
  },
  {
    value: "peaking",
    label: "Peaking",
    desc: "Pre-competition sharpening — intensity up, volume down",
  },
  {
    value: "in_season",
    label: "In-Season",
    desc: "Maintaining performance through competition calendar",
  },
  {
    value: "off_season",
    label: "Off-Season",
    desc: "Base building and recovery between seasons",
  },
];

const APN_DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

const DEFAULT_SCHEDULE: Record<string, APNSessionType> = {
  monday: "off",
  tuesday: "off",
  wednesday: "off",
  thursday: "off",
  friday: "off",
  saturday: "off",
  sunday: "off",
};

export interface TrainingNutritionScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can react (e.g. refresh targets). */
  onSaved?: () => void;
}

export function TrainingNutritionScheduleModal({
  open,
  onOpenChange,
  onSaved,
}: TrainingNutritionScheduleModalProps) {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Seed from the user's existing schedule (if any)
  const existingSchedule: Record<string, string> | null =
    (user?.weeklyTrainingSchedule as any) ?? null;

  const [weeklySchedule, setWeeklySchedule] = useState<
    Record<string, APNSessionType>
  >(() => {
    if (existingSchedule) {
      const merged = { ...DEFAULT_SCHEDULE };
      for (const day of APN_DAYS.map((d) => d.key)) {
        const v = existingSchedule[day];
        if (v && APN_SESSION_TYPES.some((s) => s.value === v)) {
          merged[day] = v as APNSessionType;
        }
      }
      return merged;
    }
    return { ...DEFAULT_SCHEDULE };
  });

  const [trainingPhase, setTrainingPhase] = useState<APNTrainingPhase | "">(
    () => {
      const p = (existingSchedule as any)?.trainingPhase;
      if (p && APN_PHASES.some((ph) => ph.value === p)) return p as APNTrainingPhase;
      return "";
    }
  );

  const [saving, setSaving] = useState(false);

  // ── Derived: today's session type ────────────────────────────────────────
  const DOW = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayKey = DOW[new Date().getDay()];
  const todaySession = weeklySchedule[todayKey] ?? "off";
  const todayInfo = APN_SESSION_TYPES.find((s) => s.value === todaySession);

  const canSave = !!trainingPhase;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/performance/schedule"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          schedule: weeklySchedule,
          trainingPhase,
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      // Refresh the user so AuthContext writes mpm.perfProtocol.{uid} to
      // localStorage — this is what getResolvedTargets() reads on the client.
      await refreshUser();
      // Invalidate the carb-cycle dashboard so macro caps refresh.
      await queryClient.invalidateQueries({ queryKey: ["carbCycleDashboard"] });
      // Broadcast so every reactive hook (usePerformanceNutrition, etc.) re-renders.
      window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));

      toast({
        title: "Training schedule saved",
        description: "Your daily macro targets will now adjust based on your training day.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "Could not save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white p-0 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-white font-bold text-base leading-tight">
                Training Nutrition Schedule
              </DialogTitle>
              <p className="text-white/40 text-xs mt-0.5">
                Macros adjust automatically each day based on what you're training.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Today's snapshot */}
          {existingSchedule && (
            <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
              <CalendarDays className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-orange-300 text-xs font-semibold mb-0.5">
                  Today —{" "}
                  {todayKey.charAt(0).toUpperCase() + todayKey.slice(1)}
                </p>
                <p className="text-white text-sm font-semibold">{todayInfo?.label}</p>
                <p className="text-white/40 text-xs leading-relaxed mt-0.5">
                  {todayInfo?.desc}
                </p>
              </div>
            </div>
          )}

          {/* Training Phase */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
              Training Phase <span className="text-orange-400">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {APN_PHASES.map((p) => (
                <PillButton
                  key={p.value}
                  active={trainingPhase === p.value}
                  onClick={() => setTrainingPhase(p.value)}
                >
                  {p.label}
                </PillButton>
              ))}
            </div>
            {trainingPhase && (
              <div className="mt-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <p className="text-white/50 text-xs leading-relaxed">
                  {APN_PHASES.find((p) => p.value === trainingPhase)?.desc}
                </p>
              </div>
            )}
          </div>

          {/* Week Schedule */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              Week Schedule
            </p>
            <div className="space-y-2">
              {APN_DAYS.map((day) => {
                const selected = weeklySchedule[day.key];
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <span className="text-white/60 text-xs font-semibold w-8 shrink-0">
                      {day.label}
                    </span>
                    <select
                      value={selected}
                      onChange={(e) =>
                        setWeeklySchedule((prev) => ({
                          ...prev,
                          [day.key]: e.target.value as APNSessionType,
                        }))
                      }
                      className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm font-semibold outline-none focus:border-orange-500/60 transition-colors appearance-none"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff60' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                      }}
                    >
                      {APN_SESSION_TYPES.map((s) => (
                        <option key={s.value} value={s.value} className="bg-zinc-900 text-white">
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {selected !== "off" && (
                      <Check className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-orange-950/20 border border-orange-500/15 rounded-xl px-4 py-3">
            <p className="text-orange-300 text-xs font-semibold mb-1">How this works</p>
            <p className="text-white/40 text-xs leading-relaxed">
              MPM reads your schedule every morning and automatically adjusts your macro targets.
              Power days add carbohydrates. Recovery days reduce them. Your macro baseline
              always stays under your Macro Calculator — this only applies day-specific adjustments on top.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div
          className="flex-shrink-0 border-t border-white/10 px-5 pt-3 flex gap-3"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${
              canSave && !saving
                ? "bg-orange-600 text-white active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Save Schedule
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
