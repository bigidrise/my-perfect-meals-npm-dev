import { useState } from "react";
import { X, Dumbbell, ChevronRight, ChevronLeft, Zap } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PerformanceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingContext?: any | null;
}

type PrimaryGoal = "fat_loss" | "muscle_gain" | "maintenance" | "performance" | "competition_prep";
type TrainingType = "strength" | "hypertrophy" | "powerlifting" | "olympic_lifting" | "mma" | "boxing" | "wrestling" | "bjj" | "crossfit" | "endurance_running" | "cycling" | "triathlon" | "tactical" | "general_fitness";
type TrainingFrequency = "1-2" | "3-4" | "5-6" | "7+";
type CardioFocus = "none" | "recovery" | "zone_2" | "tempo" | "threshold" | "hiit" | "mixed";
type TrainingPhase = "off_season" | "pre_season" | "in_season" | "competition_prep" | "weight_cut" | "recovery";

const PRIMARY_GOALS: { value: PrimaryGoal; label: string; desc: string }[] = [
  { value: "fat_loss",        label: "Fat Loss",          desc: "Lean out while keeping performance" },
  { value: "muscle_gain",     label: "Muscle Gain",       desc: "Hypertrophy and anabolism" },
  { value: "maintenance",     label: "Maintenance",       desc: "Body composition stability" },
  { value: "performance",     label: "Peak Performance",  desc: "Output, speed, and power" },
  { value: "competition_prep",label: "Competition Prep",  desc: "Precise macro and weight control" },
];

const TRAINING_TYPES: { value: TrainingType; label: string; group: string }[] = [
  { value: "strength",         label: "Strength",          group: "Iron Sports" },
  { value: "hypertrophy",      label: "Hypertrophy",       group: "Iron Sports" },
  { value: "powerlifting",     label: "Powerlifting",      group: "Iron Sports" },
  { value: "olympic_lifting",  label: "Olympic Lifting",   group: "Iron Sports" },
  { value: "mma",              label: "MMA",               group: "Combat Sports" },
  { value: "boxing",           label: "Boxing",            group: "Combat Sports" },
  { value: "wrestling",        label: "Wrestling",         group: "Combat Sports" },
  { value: "bjj",              label: "BJJ",               group: "Combat Sports" },
  { value: "crossfit",         label: "CrossFit",          group: "Mixed" },
  { value: "endurance_running",label: "Running",           group: "Endurance" },
  { value: "cycling",          label: "Cycling",           group: "Endurance" },
  { value: "triathlon",        label: "Triathlon",         group: "Endurance" },
  { value: "tactical",         label: "Tactical / Military",group: "Other" },
  { value: "general_fitness",  label: "General Fitness",   group: "Other" },
];

const TRAINING_FREQS: { value: TrainingFrequency; label: string }[] = [
  { value: "1-2", label: "1–2 days" },
  { value: "3-4", label: "3–4 days" },
  { value: "5-6", label: "5–6 days" },
  { value: "7+",  label: "7+ (daily)" },
];

const CARDIO_OPTS: { value: CardioFocus; label: string; desc: string }[] = [
  { value: "none",      label: "No Cardio",    desc: "Pure strength / skill focus" },
  { value: "recovery",  label: "Recovery",     desc: "Zone 1 — easy movement only" },
  { value: "zone_2",    label: "Zone 2",       desc: "Aerobic base, fat oxidation" },
  { value: "tempo",     label: "Tempo",        desc: "Zone 3 — aerobic threshold" },
  { value: "threshold", label: "Threshold",    desc: "Zone 4 — lactate threshold" },
  { value: "hiit",      label: "HIIT",         desc: "Zone 5 — high glycolytic" },
  { value: "mixed",     label: "Mixed Zones",  desc: "Varied cardio across sessions" },
];

const TRAINING_PHASES: { value: TrainingPhase; label: string; desc: string }[] = [
  { value: "off_season",       label: "Off Season",       desc: "Volume focus, build base" },
  { value: "pre_season",       label: "Pre-Season",       desc: "Conditioning ramp-up" },
  { value: "in_season",        label: "In Season",        desc: "Performance maintenance" },
  { value: "competition_prep", label: "Competition Prep", desc: "Precise macro control" },
  { value: "weight_cut",       label: "Weight Cut",       desc: "Short-term deficit + rehydration" },
  { value: "recovery",         label: "Recovery",         desc: "Anti-inflammatory, repair priority" },
];

const TOTAL_STEPS = 5;

export default function PerformanceSetupModal({
  isOpen,
  onClose,
  onSuccess,
  existingContext,
}: PerformanceSetupModalProps) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [primaryGoal, setPrimaryGoal]     = useState<PrimaryGoal | "">(existingContext?.primaryGoal ?? "");
  const [trainingType, setTrainingType]   = useState<TrainingType | "">(existingContext?.trainingType ?? "");
  const [frequency, setFrequency]         = useState<TrainingFrequency | "">(existingContext?.trainingFrequency ?? "");
  const [cardioFocus, setCardioFocus]     = useState<CardioFocus | "">(existingContext?.cardioFocus ?? "");
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase | "">(existingContext?.trainingPhase ?? "");
  const [twoADays, setTwoADays]           = useState<boolean>(existingContext?.twoADays ?? false);

  if (!isOpen) return null;

  const canNext = [
    !!primaryGoal,
    !!trainingType,
    !!frequency,
    !!cardioFocus,
    !!trainingPhase,
  ][step];

  async function handleSave() {
    if (!primaryGoal || !trainingType || !frequency || !cardioFocus || !trainingPhase) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/performance/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          primaryGoal,
          trainingType,
          trainingFrequency: frequency,
          cardioFocus,
          trainingPhase,
          twoADays,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshUser();
      toast({ title: "Performance protocol saved", description: "Your meal generation is now sport-specific." });
      onSuccess?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const groups = [...new Set(TRAINING_TYPES.map(t => t.group))];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-gradient-to-b from-zinc-950 to-black border border-orange-500/20 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Performance Setup</p>
              <p className="text-white/40 text-xs">Step {step + 1} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 flex-shrink-0">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Step 0: Primary Goal */}
          {step === 0 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What's your primary goal?</p>
              <p className="text-white/50 text-sm mb-4">This shapes macro priorities and meal energy density.</p>
              <div className="space-y-2">
                {PRIMARY_GOALS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setPrimaryGoal(g.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      primaryGoal === g.value
                        ? "bg-orange-600/20 border-orange-400/60 text-white"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <p className="font-semibold text-sm">{g.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Training Type */}
          {step === 1 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What type of training do you do?</p>
              <p className="text-white/50 text-sm mb-4">Select your primary sport or discipline.</p>
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {TRAINING_TYPES.filter(t => t.group === group).map(t => (
                        <PillButton
                          key={t.value}
                          selected={trainingType === t.value}
                          onClick={() => setTrainingType(t.value)}
                        >
                          {t.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Training Frequency */}
          {step === 2 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">How often do you train?</p>
              <p className="text-white/50 text-sm mb-4">Weekly training sessions (not counting rest days).</p>
              <div className="flex flex-wrap gap-3 mb-6">
                {TRAINING_FREQS.map(f => (
                  <PillButton
                    key={f.value}
                    selected={frequency === f.value}
                    onClick={() => setFrequency(f.value)}
                  >
                    {f.label}
                  </PillButton>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-sm">Training twice per day?</p>
                    <p className="text-white/40 text-xs mt-0.5">Enables 2-a-day recovery meal guidance</p>
                  </div>
                  <button
                    onClick={() => setTwoADays(v => !v)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${twoADays ? "bg-orange-500" : "bg-white/20"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${twoADays ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Cardio Focus */}
          {step === 3 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What's your cardio focus?</p>
              <p className="text-white/50 text-sm mb-4">Determines carb timing and glycolytic fuel needs.</p>
              <div className="space-y-2">
                {CARDIO_OPTS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCardioFocus(c.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      cardioFocus === c.value
                        ? "bg-orange-600/20 border-orange-400/60 text-white"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <p className="font-semibold text-sm">{c.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Training Phase */}
          {step === 4 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">Where are you in your training cycle?</p>
              <p className="text-white/50 text-sm mb-4">Your phase calibrates macro targets and food choices.</p>
              <div className="space-y-2">
                {TRAINING_PHASES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setTrainingPhase(p.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      trainingPhase === p.value
                        ? "bg-orange-600/20 border-orange-400/60 text-white"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <p className="font-semibold text-sm">{p.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-white/10 flex gap-3 flex-shrink-0">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button
            onClick={step < TOTAL_STEPS - 1 ? () => setStep(s => s + 1) : handleSave}
            disabled={!canNext || saving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${
              canNext && !saving
                ? "bg-orange-600 text-white active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : step < TOTAL_STEPS - 1 ? (
              <>Next <ChevronRight className="w-4 h-4" /></>
            ) : (
              <><Zap className="w-4 h-4" /> Activate Protocol</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
