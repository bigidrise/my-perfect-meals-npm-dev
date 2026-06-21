import { useState } from "react";
import { X, Dumbbell, Trophy, ChevronRight, ChevronLeft, Zap, Calendar } from "lucide-react";
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
  existingCompContext?: any | null;
  existingTrack?: "athletic" | "competition" | null;
}

type ProtocolTrack = "athletic" | "competition";
type AthleticGoal = "fat_loss" | "muscle_gain" | "maintenance" | "performance";
type TrainingType = "strength" | "hypertrophy" | "powerlifting" | "olympic_lifting" | "mma" | "boxing" | "wrestling" | "bjj" | "crossfit" | "endurance_running" | "cycling" | "triathlon" | "tactical" | "general_fitness";
type TrainingFrequency = "1-2" | "3-4" | "5-6" | "7+";
type CardioFocus = "none" | "recovery" | "zone_2" | "tempo" | "threshold" | "hiit" | "mixed";
type AthleticPhase = "off_season" | "pre_season" | "in_season" | "weight_cut" | "recovery";
type CompType = "bodybuilding_show" | "mens_physique" | "classic_physique" | "figure" | "bikini" | "wellness" | "powerlifting_meet" | "strongman_competition" | "olympic_weightlifting_meet" | "fight_camp" | "wrestling_season" | "crossfit_competition" | "hyrox" | "marathon" | "triathlon_race" | "spartan_race";

const ATHLETIC_GOALS: { value: AthleticGoal; label: string; desc: string }[] = [
  { value: "fat_loss",    label: "Fat Loss",        desc: "Lean out while preserving performance" },
  { value: "muscle_gain", label: "Muscle Gain",     desc: "Hypertrophy and anabolism" },
  { value: "maintenance", label: "Maintenance",     desc: "Body composition stability" },
  { value: "performance", label: "Peak Performance",desc: "Output, speed, and power" },
];

const TRAINING_TYPES: { value: TrainingType; label: string; group: string }[] = [
  { value: "strength",          label: "Strength",          group: "Iron Sports" },
  { value: "hypertrophy",       label: "Hypertrophy",       group: "Iron Sports" },
  { value: "powerlifting",      label: "Powerlifting",      group: "Iron Sports" },
  { value: "olympic_lifting",   label: "Olympic Lifting",   group: "Iron Sports" },
  { value: "mma",               label: "MMA",               group: "Combat Sports" },
  { value: "boxing",            label: "Boxing",            group: "Combat Sports" },
  { value: "wrestling",         label: "Wrestling",         group: "Combat Sports" },
  { value: "bjj",               label: "BJJ",               group: "Combat Sports" },
  { value: "crossfit",          label: "CrossFit",          group: "Mixed" },
  { value: "endurance_running", label: "Running",           group: "Endurance" },
  { value: "cycling",           label: "Cycling",           group: "Endurance" },
  { value: "triathlon",         label: "Triathlon",         group: "Endurance" },
  { value: "tactical",          label: "Tactical / Military",group: "Other" },
  { value: "general_fitness",   label: "General Fitness",   group: "Other" },
];

const TRAINING_FREQS: { value: TrainingFrequency; label: string }[] = [
  { value: "1-2", label: "1–2 days" },
  { value: "3-4", label: "3–4 days" },
  { value: "5-6", label: "5–6 days" },
  { value: "7+",  label: "7+ (daily)" },
];

const CARDIO_OPTS: { value: CardioFocus; label: string; desc: string }[] = [
  { value: "none",      label: "No Cardio",   desc: "Pure strength / skill focus" },
  { value: "recovery",  label: "Recovery",    desc: "Zone 1 — easy movement only" },
  { value: "zone_2",    label: "Zone 2",      desc: "Aerobic base, fat oxidation" },
  { value: "tempo",     label: "Tempo",       desc: "Zone 3 — aerobic threshold" },
  { value: "threshold", label: "Threshold",   desc: "Zone 4 — lactate threshold" },
  { value: "hiit",      label: "HIIT",        desc: "Zone 5 — high glycolytic" },
  { value: "mixed",     label: "Mixed Zones", desc: "Varied cardio across sessions" },
];

const ATHLETIC_PHASES: { value: AthleticPhase; label: string; desc: string }[] = [
  { value: "off_season",  label: "Off Season",  desc: "Volume focus, build base" },
  { value: "pre_season",  label: "Pre-Season",  desc: "Conditioning ramp-up" },
  { value: "in_season",   label: "In Season",   desc: "Performance maintenance" },
  { value: "weight_cut",  label: "Weight Cut",  desc: "Short-term deficit + rehydration" },
  { value: "recovery",    label: "Recovery",    desc: "Anti-inflammatory, repair priority" },
];

const COMP_TYPES: { value: CompType; label: string; group: string }[] = [
  { value: "bodybuilding_show",         label: "Bodybuilding",            group: "Physique" },
  { value: "mens_physique",             label: "Men's Physique",          group: "Physique" },
  { value: "classic_physique",          label: "Classic Physique",        group: "Physique" },
  { value: "figure",                    label: "Figure",                  group: "Physique" },
  { value: "bikini",                    label: "Bikini",                  group: "Physique" },
  { value: "wellness",                  label: "Wellness",                group: "Physique" },
  { value: "powerlifting_meet",         label: "Powerlifting Meet",       group: "Strength Sports" },
  { value: "strongman_competition",     label: "Strongman",               group: "Strength Sports" },
  { value: "olympic_weightlifting_meet",label: "Olympic Weightlifting",   group: "Strength Sports" },
  { value: "fight_camp",                label: "Fight Camp",              group: "Combat Sports" },
  { value: "wrestling_season",          label: "Wrestling Season",        group: "Combat Sports" },
  { value: "crossfit_competition",      label: "CrossFit Competition",    group: "Functional / Mixed" },
  { value: "hyrox",                     label: "Hyrox",                   group: "Functional / Mixed" },
  { value: "marathon",                  label: "Marathon",                group: "Endurance" },
  { value: "triathlon_race",            label: "Triathlon",               group: "Endurance" },
  { value: "spartan_race",              label: "Spartan Race",            group: "Endurance" },
];

// Steps per track (excluding step 0 = track selector)
// Athletic: goals, training type, frequency, cardio, phase = 5 more steps → total 6
// Competition: comp type, event date, weight info = 3 more steps → total 4
const ATHLETIC_TOTAL = 6;
const COMP_TOTAL = 4;

export default function PerformanceSetupModal({
  isOpen,
  onClose,
  onSuccess,
  existingContext,
  existingCompContext,
  existingTrack,
}: PerformanceSetupModalProps) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0
  const [track, setTrack] = useState<ProtocolTrack | "">(existingTrack ?? "");

  // Athletic fields
  const [primaryGoal, setPrimaryGoal]     = useState<AthleticGoal | "">(existingContext?.primaryGoal ?? "");
  const [trainingType, setTrainingType]   = useState<TrainingType | "">(existingContext?.trainingType ?? "");
  const [frequency, setFrequency]         = useState<TrainingFrequency | "">(existingContext?.trainingFrequency ?? "");
  const [cardioFocus, setCardioFocus]     = useState<CardioFocus | "">(existingContext?.cardioFocus ?? "");
  const [trainingPhase, setTrainingPhase] = useState<AthleticPhase | "">(existingContext?.trainingPhase ?? "");
  const [twoADays, setTwoADays]           = useState<boolean>(existingContext?.twoADays ?? false);

  // Competition Prep fields
  const [compType, setCompType]           = useState<CompType | "">(existingCompContext?.competitionType ?? "");
  const [division, setDivision]           = useState<string>(existingCompContext?.division ?? "");
  const [eventDate, setEventDate]         = useState<string>(existingCompContext?.eventDate ?? "");
  const [currentWeight, setCurrentWeight] = useState<string>(existingCompContext?.currentWeight ?? "");
  const [targetWeight, setTargetWeight]   = useState<string>(existingCompContext?.targetWeight ?? "");

  if (!isOpen) return null;

  const totalSteps = track === "competition" ? COMP_TOTAL : ATHLETIC_TOTAL;

  // Per-step validation
  function stepValid(): boolean {
    if (step === 0) return !!track;
    if (track === "athletic" || track === "") {
      if (step === 1) return !!primaryGoal;
      if (step === 2) return !!trainingType;
      if (step === 3) return !!frequency;
      if (step === 4) return !!cardioFocus;
      if (step === 5) return !!trainingPhase;
    }
    if (track === "competition") {
      if (step === 1) return !!compType;
      if (step === 2) return !!eventDate && !isNaN(Date.parse(eventDate));
      if (step === 3) return true; // weights optional
    }
    return false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = { track };
      if (track === "athletic") {
        Object.assign(body, { primaryGoal, trainingType, trainingFrequency: frequency, cardioFocus, trainingPhase, twoADays });
      } else {
        Object.assign(body, {
          competitionType: compType,
          division: division || undefined,
          eventDate,
          currentWeight: currentWeight || undefined,
          targetWeight: targetWeight || undefined,
        });
      }

      const res = await fetch(apiUrl("/api/performance/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      await refreshUser();
      const label = track === "competition" ? "Competition prep protocol saved." : "Athletic performance protocol saved.";
      toast({ title: "Protocol activated", description: label });
      onSuccess?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const groups = [...new Set(TRAINING_TYPES.map(t => t.group))];
  const compGroups = [...new Set(COMP_TYPES.map(c => c.group))];

  const isLastStep = step === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-gradient-to-b from-zinc-950 to-black border border-orange-500/20 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
              {track === "competition" ? <Trophy className="w-4 h-4 text-orange-400" /> : <Dumbbell className="w-4 h-4 text-orange-400" />}
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {step === 0 ? "Performance Setup" : track === "competition" ? "Competition Prep" : "Athletic Performance"}
              </p>
              <p className="text-white/40 text-xs">Step {step + 1} of {track ? totalSteps : "?"}</p>
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
            style={{ width: track ? `${((step + 1) / totalSteps) * 100}%` : "5%" }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* ── Step 0: Track Selector ── */}
          {step === 0 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What describes your goal?</p>
              <p className="text-white/50 text-sm mb-5">Each track uses a completely different protocol engine.</p>
              <div className="space-y-3">
                <button
                  onClick={() => setTrack("athletic")}
                  className={`w-full text-left px-4 py-4 rounded-2xl border transition-colors ${
                    track === "athletic"
                      ? "bg-orange-600/20 border-orange-400/60"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Dumbbell className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Athletic Performance</p>
                      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">MMA, boxing, wrestling, football, CrossFit, endurance, tactical. Goal is performance — fueling, recovery, adaptation.</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {["Sport-specific fueling","Training load","Recovery phases"].map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setTrack("competition")}
                  className={`w-full text-left px-4 py-4 rounded-2xl border transition-colors ${
                    track === "competition"
                      ? "bg-orange-600/20 border-orange-400/60"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Trophy className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Competition Prep</p>
                      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">Bodybuilding, physique, powerlifting meet, fight camp, wrestling season. Your event date drives every phase automatically.</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {["Calendar-driven","Auto phase transitions","Event countdown"].map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Athletic: Step 1 — Primary Goal ── */}
          {track === "athletic" && step === 1 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What's your primary goal?</p>
              <p className="text-white/50 text-sm mb-4">This shapes macro priorities and meal energy density.</p>
              <div className="space-y-2">
                {ATHLETIC_GOALS.map(g => (
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

          {/* ── Athletic: Step 2 — Training Type ── */}
          {track === "athletic" && step === 2 && (
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

          {/* ── Athletic: Step 3 — Frequency ── */}
          {track === "athletic" && step === 3 && (
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

          {/* ── Athletic: Step 4 — Cardio Focus ── */}
          {track === "athletic" && step === 4 && (
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

          {/* ── Athletic: Step 5 — Training Phase ── */}
          {track === "athletic" && step === 5 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">Where are you in your training cycle?</p>
              <p className="text-white/50 text-sm mb-4">Your phase calibrates macro targets and food choices.</p>
              <div className="space-y-2">
                {ATHLETIC_PHASES.map(p => (
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

          {/* ── Competition: Step 1 — Competition Type ── */}
          {track === "competition" && step === 1 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What type of competition?</p>
              <p className="text-white/50 text-sm mb-4">Each competition type uses a different prep timeline and peak week protocol.</p>
              <div className="space-y-4">
                {compGroups.map(group => (
                  <div key={group}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {COMP_TYPES.filter(c => c.group === group).map(c => (
                        <PillButton
                          key={c.value}
                          selected={compType === c.value}
                          onClick={() => setCompType(c.value)}
                        >
                          {c.label}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Competition: Step 2 — Event Date + Division ── */}
          {track === "competition" && step === 2 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">When is your event?</p>
              <p className="text-white/50 text-sm mb-5">Your event date drives every phase automatically — no guessing.</p>

              <div className="space-y-4">
                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Event Date <span className="text-orange-400">*</span></p>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="date"
                      value={eventDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={e => setEventDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white text-sm outline-none focus:border-orange-500/60 [color-scheme:dark]"
                    />
                  </div>
                  {eventDate && (
                    <p className="text-orange-300 text-xs mt-2">
                      {Math.max(0, Math.round((new Date(eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))} weeks out
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Division <span className="text-white/30">(optional)</span></p>
                  <input
                    type="text"
                    value={division}
                    onChange={e => setDivision(e.target.value)}
                    placeholder="e.g. Open, Masters 35+, 93kg class..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Competition: Step 3 — Weight Info ── */}
          {track === "competition" && step === 3 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">Weight information</p>
              <p className="text-white/50 text-sm mb-5">Optional — helps your AI coach give precise guidance on cut strategy and calorie targets.</p>

              <div className="space-y-4">
                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Current Weight <span className="text-white/30">(optional)</span></p>
                  <input
                    type="text"
                    value={currentWeight}
                    onChange={e => setCurrentWeight(e.target.value)}
                    placeholder="e.g. 185 lbs, 84 kg..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                  />
                </div>
                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Target Weight / Class <span className="text-white/30">(optional)</span></p>
                  <input
                    type="text"
                    value={targetWeight}
                    onChange={e => setTargetWeight(e.target.value)}
                    placeholder="e.g. 175 lbs, 83kg class, stage ready..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                  />
                </div>

                <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl px-4 py-3">
                  <p className="text-orange-300 text-xs font-semibold mb-1">How this works</p>
                  <p className="text-white/50 text-xs leading-relaxed">
                    MPM calculates your current phase from your event date automatically. As your event approaches, protocols shift: fat loss → conditioning → peak week → show day → reverse diet. The calendar decides — not AI.
                  </p>
                </div>
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
            onClick={isLastStep ? handleSave : () => setStep(s => s + 1)}
            disabled={!stepValid() || saving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${
              stepValid() && !saving
                ? "bg-orange-600 text-white active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : isLastStep ? (
              <><Zap className="w-4 h-4" /> Activate Protocol</>
            ) : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
