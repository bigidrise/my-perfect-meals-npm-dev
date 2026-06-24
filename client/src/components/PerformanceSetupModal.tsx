import { useState, useRef } from "react";
import { X, Dumbbell, Trophy, ChevronRight, ChevronLeft, Zap, Calendar, Check } from "lucide-react";
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
type TrainingType = "strength" | "hypertrophy" | "powerlifting" | "olympic_lifting" | "mma" | "boxing" | "wrestling" | "bjj" | "crossfit" | "endurance_running" | "cycling" | "triathlon" | "tactical" | "general_fitness" | "other";
type TrainingFrequency = "1-2" | "3-4" | "5-6" | "7+";
type CardioFocus = "none" | "recovery" | "zone_2" | "tempo" | "threshold" | "hiit" | "mixed";
type AthleticPhase = "off_season" | "pre_season" | "in_season" | "weight_cut" | "recovery";
type SessionDuration = "under_30" | "30_60" | "60_90" | "90_plus";
type RecoveryStatus = "good" | "average" | "poor";
type AdaptationTarget = "endurance" | "recovery" | "conditioning" | "work_capacity" | "speed" | "power" | "fat_loss" | "muscle_gain";
type CompType = "bodybuilding_show" | "mens_physique" | "classic_physique" | "figure" | "bikini" | "wellness" | "powerlifting_meet" | "strongman_competition" | "olympic_weightlifting_meet" | "fight_camp" | "wrestling_season" | "crossfit_competition" | "hyrox" | "marathon" | "triathlon_race" | "spartan_race" | "other";
type APNSessionType = "strength" | "power" | "endurance" | "sport_practice" | "competition" | "recovery" | "off";
type APNTrainingPhase = "stabilization" | "strength" | "power" | "peaking" | "in_season" | "off_season";

const ATHLETIC_GOALS: { value: AthleticGoal; label: string; desc: string }[] = [
  { value: "fat_loss",    label: "Fat Loss",        desc: "Lean out while preserving performance" },
  { value: "muscle_gain", label: "Muscle Gain",     desc: "Hypertrophy and anabolism" },
  { value: "maintenance", label: "Maintenance",     desc: "Body composition stability" },
  { value: "performance", label: "Peak Performance",desc: "Output, speed, and power" },
];

const TRAINING_TYPES: { value: TrainingType; label: string; group: string }[] = [
  { value: "strength",          label: "Strength",           group: "Iron Sports" },
  { value: "hypertrophy",       label: "Hypertrophy",        group: "Iron Sports" },
  { value: "powerlifting",      label: "Powerlifting",       group: "Iron Sports" },
  { value: "olympic_lifting",   label: "Olympic Lifting",    group: "Iron Sports" },
  { value: "mma",               label: "MMA",                group: "Combat Sports" },
  { value: "boxing",            label: "Boxing",             group: "Combat Sports" },
  { value: "wrestling",         label: "Wrestling",          group: "Combat Sports" },
  { value: "bjj",               label: "BJJ",                group: "Combat Sports" },
  { value: "crossfit",          label: "CrossFit",           group: "Mixed" },
  { value: "endurance_running", label: "Running",            group: "Endurance" },
  { value: "cycling",           label: "Cycling",            group: "Endurance" },
  { value: "triathlon",         label: "Triathlon",          group: "Endurance" },
  { value: "tactical",          label: "Tactical / Military",group: "Other" },
  { value: "general_fitness",   label: "General Fitness",    group: "Other" },
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
  { value: "bodybuilding_show",          label: "Bodybuilding",          group: "Physique" },
  { value: "mens_physique",              label: "Men's Physique",        group: "Physique" },
  { value: "classic_physique",           label: "Classic Physique",      group: "Physique" },
  { value: "figure",                     label: "Figure",                group: "Physique" },
  { value: "bikini",                     label: "Bikini",                group: "Physique" },
  { value: "wellness",                   label: "Wellness",              group: "Physique" },
  { value: "powerlifting_meet",          label: "Powerlifting Meet",     group: "Strength Sports" },
  { value: "strongman_competition",      label: "Strongman",             group: "Strength Sports" },
  { value: "olympic_weightlifting_meet", label: "Olympic Weightlifting", group: "Strength Sports" },
  { value: "fight_camp",                 label: "Fight Camp",            group: "Combat Sports" },
  { value: "wrestling_season",           label: "Wrestling Season",      group: "Combat Sports" },
  { value: "crossfit_competition",       label: "CrossFit Competition",  group: "Functional / Mixed" },
  { value: "hyrox",                      label: "Hyrox",                 group: "Functional / Mixed" },
  { value: "marathon",                   label: "Marathon",              group: "Endurance" },
  { value: "triathlon_race",             label: "Triathlon",             group: "Endurance" },
  { value: "spartan_race",               label: "Spartan Race",          group: "Endurance" },
];

const COMP_GROUP_KEYS: Record<string, string> = {
  "Physique": "physique",
  "Strength Sports": "strength",
  "Combat Sports": "combat",
  "Functional / Mixed": "functional",
  "Endurance": "endurance",
};

const ATHLETIC_GROUP_KEYS: Record<string, string> = {
  "Iron Sports": "iron",
  "Combat Sports": "combat",
  "Mixed": "mixed",
  "Endurance": "endurance",
  "Other": "other",
};

const SESSION_DURATIONS: { value: SessionDuration; label: string; desc: string }[] = [
  { value: "under_30", label: "Under 30 min", desc: "Short / accessory sessions" },
  { value: "30_60",    label: "30–60 min",    desc: "Standard training block" },
  { value: "60_90",    label: "60–90 min",    desc: "Full session with warm-up & cool-down" },
  { value: "90_plus",  label: "90 min+",      desc: "High-volume or multi-discipline sessions" },
];

const RECOVERY_STATUSES: { value: RecoveryStatus; label: string; desc: string }[] = [
  { value: "good",    label: "Good",    desc: "Sleeping well, low soreness, high energy" },
  { value: "average", label: "Average", desc: "Some fatigue but manageable" },
  { value: "poor",    label: "Poor",    desc: "Fatigued, high soreness, sleep-deprived" },
];

const ADAPTATION_TARGETS: { value: AdaptationTarget; label: string; desc: string }[] = [
  { value: "endurance",     label: "Endurance",      desc: "Aerobic base and long-duration output" },
  { value: "conditioning",  label: "Conditioning",   desc: "Work capacity across energy systems" },
  { value: "speed",         label: "Speed",          desc: "Sprint performance and fast-twitch output" },
  { value: "power",         label: "Power",          desc: "Explosive force and peak strength" },
  { value: "work_capacity", label: "Work Capacity",  desc: "Volume tolerance and repeat-effort ability" },
  { value: "recovery",      label: "Recovery",       desc: "Anti-inflammatory, tissue repair, CNS reset" },
  { value: "muscle_gain",   label: "Muscle Gain",    desc: "Hypertrophy and anabolic support" },
  { value: "fat_loss",      label: "Fat Loss",       desc: "Calorie partitioning and lean mass preservation" },
];

// ── Adaptive Performance Nutrition — session type and phase constants ─────────
const APN_SESSION_TYPES: { value: APNSessionType; label: string; short: string; desc: string }[] = [
  { value: "strength",       label: "Strength",       short: "Str",   desc: "Resistance training — moderate carbohydrate support" },
  { value: "power",          label: "Power",          short: "Pwr",   desc: "Explosive output — additional carbs and protein active" },
  { value: "endurance",      label: "Endurance",      short: "End",   desc: "Aerobic fuel priority — elevated carbohydrate availability" },
  { value: "sport_practice", label: "Sport Practice", short: "Sport", desc: "Mixed demands — moderate carbohydrate support" },
  { value: "competition",    label: "Competition",    short: "Comp",  desc: "Game day fueling — maximum carbohydrate availability" },
  { value: "recovery",       label: "Recovery",       short: "Rec",   desc: "Repair emphasis — reduced carbs, anti-inflammatory priority" },
  { value: "off",            label: "Rest Day",       short: "Off",   desc: "Complete rest — reduced caloric targets" },
];

const APN_PHASES: { value: APNTrainingPhase; label: string; desc: string }[] = [
  { value: "stabilization", label: "Stabilization", desc: "Foundation phase — movement quality, core stability" },
  { value: "strength",      label: "Strength",      desc: "Building maximal force capacity" },
  { value: "power",         label: "Power",         desc: "Explosive output — force times velocity" },
  { value: "peaking",       label: "Peaking",       desc: "Pre-competition sharpening — intensity up, volume down" },
  { value: "in_season",     label: "In-Season",     desc: "Maintaining performance through competition calendar" },
  { value: "off_season",    label: "Off-Season",    desc: "Base building and recovery between seasons" },
];

const APN_DAYS: { key: string; label: string }[] = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
];

const DEFAULT_WEEKLY_SCHEDULE: Record<string, APNSessionType> = {
  monday: "off", tuesday: "off", wednesday: "off", thursday: "off",
  friday: "off", saturday: "off", sunday: "off",
};

const ATHLETIC_TOTAL = 10;
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
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [track, setTrack] = useState<ProtocolTrack | "">(existingTrack ?? "");

  // Athletic fields
  const [primaryGoal, setPrimaryGoal]         = useState<AthleticGoal | "">(existingContext?.primaryGoal ?? "");
  const [trainingType, setTrainingType]       = useState<TrainingType | "">(existingContext?.trainingType ?? "");
  const [frequency, setFrequency]             = useState<TrainingFrequency | "">(existingContext?.trainingFrequency ?? "");
  const [cardioFocus, setCardioFocus]         = useState<CardioFocus | "">(existingContext?.cardioFocus ?? "");
  const [trainingPhase, setTrainingPhase]     = useState<AthleticPhase | "">(existingContext?.trainingPhase ?? "");
  const [twoADays, setTwoADays]               = useState<boolean>(existingContext?.twoADays ?? false);
  const [sessionDuration, setSessionDuration] = useState<SessionDuration | "">(existingContext?.sessionDuration ?? "");
  const [recoveryStatus, setRecoveryStatus]   = useState<RecoveryStatus | "">(existingContext?.recoveryStatus ?? "");
  const [adaptationTarget, setAdaptationTarget] = useState<AdaptationTarget | "">(existingContext?.adaptationTarget ?? "");

  // Adaptive Performance Nutrition fields (step 9)
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, APNSessionType>>(
    existingContext?.weeklyTrainingSchedule
      ? { ...DEFAULT_WEEKLY_SCHEDULE, ...existingContext.weeklyTrainingSchedule }
      : { ...DEFAULT_WEEKLY_SCHEDULE }
  );
  const [apnPhase, setApnPhase] = useState<APNTrainingPhase | "">(
    existingContext?.weeklyTrainingSchedule?.trainingPhase ?? ""
  );

  // Competition Prep fields
  const [compType, setCompType]           = useState<CompType | "">(existingCompContext?.competitionType ?? "");
  const [division, setDivision]           = useState<string>(existingCompContext?.division ?? "");
  const [eventDate, setEventDate]         = useState<string>(existingCompContext?.eventDate ?? "");
  const [currentWeight, setCurrentWeight] = useState<string>(existingCompContext?.currentWeight ?? "");
  const [targetWeight, setTargetWeight]   = useState<string>(existingCompContext?.targetWeight ?? "");

  // Custom sport (shared between both tracks)
  const [customSportName, setCustomSportName] = useState<string>(
    existingContext?.customSportName ?? existingCompContext?.customSportName ?? ""
  );
  const [customSportGroup, setCustomSportGroup] = useState<string>(
    existingContext?.customSportGroup ?? existingCompContext?.customSportGroup ?? ""
  );

  if (!isOpen) return null;

  const totalSteps = track === "competition" ? COMP_TOTAL : ATHLETIC_TOTAL;

  function stepValid(): boolean {
    if (step === 0) return !!track;
    if (track === "athletic" || track === "") {
      if (step === 1) return !!primaryGoal;
      if (step === 2) return !!trainingType && (trainingType !== "other" || !!customSportName.trim());
      if (step === 3) return !!frequency;
      if (step === 4) return !!cardioFocus;
      if (step === 5) return !!trainingPhase;
      if (step === 6) return !!sessionDuration;
      if (step === 7) return !!recoveryStatus;
      if (step === 8) return !!adaptationTarget;
      if (step === 9) {
        const allDaysSet = APN_DAYS.every(d => weeklySchedule[d.key] && weeklySchedule[d.key] !== "");
        return allDaysSet && !!apnPhase;
      }
    }
    if (track === "competition") {
      if (step === 1) return !!compType && (compType !== "other" || !!customSportName.trim());
      if (step === 2) return !!eventDate && !isNaN(Date.parse(eventDate));
      if (step === 3) return true;
    }
    return false;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = { track };
      if (track === "athletic") {
        Object.assign(body, {
          primaryGoal, trainingType, trainingFrequency: frequency,
          cardioFocus, trainingPhase, twoADays,
          sessionDuration:  sessionDuration  || undefined,
          recoveryStatus:   recoveryStatus   || undefined,
          adaptationTarget: adaptationTarget || undefined,
          customSportName: trainingType === "other" ? customSportName.trim() : undefined,
          customSportGroup: trainingType === "other" ? customSportGroup : undefined,
        });
      } else {
        Object.assign(body, {
          competitionType: compType,
          division: division || undefined,
          eventDate,
          currentWeight: currentWeight || undefined,
          targetWeight: targetWeight || undefined,
          customSportName: compType === "other" ? customSportName.trim() : undefined,
          customSportGroup: compType === "other" ? customSportGroup : undefined,
        });
      }

      const res = await fetch(apiUrl("/api/performance/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");

      if (track === "athletic" && apnPhase) {
        await fetch(apiUrl("/api/performance/schedule"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({
            schedule: weeklySchedule,
            trainingPhase: apnPhase,
            primaryGoal: primaryGoal || undefined,
          }),
        });
      }

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

  function handleCustomSportInput(group: string, groupKey: string, value: string, setTypeFn: (v: any) => void) {
    setCustomSportName(value);
    setCustomSportGroup(groupKey);
    if (value.trim()) {
      setTypeFn("other");
    }
  }

  const groups = Array.from(new Set(TRAINING_TYPES.map(t => t.group)));
  const compGroups = Array.from(new Set(COMP_TYPES.map(c => c.group)));
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
                    track === "athletic" ? "bg-orange-600/20 border-orange-400/60" : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Dumbbell className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm">Athletic Performance</p>
                        {track === "athletic" && <Check className="w-4 h-4 text-orange-400" />}
                      </div>
                      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">MMA, boxing, wrestling, football, CrossFit, endurance, tactical. Goal is performance — fueling, recovery, adaptation.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setTrack("competition")}
                  className={`w-full text-left px-4 py-4 rounded-2xl border transition-colors ${
                    track === "competition" ? "bg-orange-600/20 border-orange-400/60" : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Trophy className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm">Competition Prep</p>
                        {track === "competition" && <Check className="w-4 h-4 text-orange-400" />}
                      </div>
                      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">Bodybuilding, physique, powerlifting meet, fight camp, wrestling season. Your event date drives every phase automatically.</p>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{g.label}</p>
                        <p className="text-xs text-white/40 mt-0.5">{g.desc}</p>
                      </div>
                      {primaryGoal === g.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
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
              <div className="space-y-5">
                {groups.map(group => (
                  <div key={group}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {TRAINING_TYPES.filter(t => t.group === group).map(t => (
                        <PillButton
                          key={t.value}
                          active={trainingType === t.value}
                          onClick={() => { setTrainingType(t.value); if (t.value !== "other") setCustomSportName(""); }}
                        >
                          {t.label}
                        </PillButton>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={trainingType === "other" && customSportGroup === ATHLETIC_GROUP_KEYS[group] ? customSportName : ""}
                        onChange={e => handleCustomSportInput(group, ATHLETIC_GROUP_KEYS[group], e.target.value, setTrainingType)}
                        placeholder={`Other ${group.toLowerCase()} sport…`}
                        className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60 transition-colors ${
                          trainingType === "other" && customSportGroup === ATHLETIC_GROUP_KEYS[group]
                            ? "border-orange-400/60 bg-orange-600/10"
                            : "border-white/10"
                        }`}
                      />
                      {trainingType === "other" && customSportGroup === ATHLETIC_GROUP_KEYS[group] && customSportName.trim() && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                      )}
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
                    active={frequency === f.value}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{c.label}</p>
                        <p className="text-xs text-white/40 mt-0.5">{c.desc}</p>
                      </div>
                      {cardioFocus === c.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{p.label}</p>
                        <p className="text-xs text-white/40 mt-0.5">{p.desc}</p>
                      </div>
                      {trainingPhase === p.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Athletic: Step 6 — Session Duration ── */}
          {track === "athletic" && step === 6 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">How long are your typical sessions?</p>
              <p className="text-white/50 text-sm mb-4">Used to calculate glycogen expenditure and recovery nutrition needs.</p>
              <div className="space-y-2">
                {SESSION_DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setSessionDuration(d.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      sessionDuration === d.value
                        ? "bg-orange-600/20 border-orange-400/60 text-white"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{d.label}</p>
                        <p className="text-xs text-white/40 mt-0.5">{d.desc}</p>
                      </div>
                      {sessionDuration === d.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Athletic: Step 7 — Recovery Status ── */}
          {track === "athletic" && step === 7 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">How is your recovery right now?</p>
              <p className="text-white/50 text-sm mb-4">Your current recovery state shapes protein timing, anti-inflammatory priorities, and calorie density.</p>
              <div className="space-y-2">
                {RECOVERY_STATUSES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRecoveryStatus(r.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      recoveryStatus === r.value
                        ? "bg-orange-600/20 border-orange-400/60 text-white"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{r.label}</p>
                        <p className="text-xs text-white/40 mt-0.5">{r.desc}</p>
                      </div>
                      {recoveryStatus === r.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Athletic: Step 8 — Adaptation Target ── */}
          {track === "athletic" && step === 8 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What are you adapting for?</p>
              <p className="text-white/50 text-sm mb-4">Your adaptation target drives the demand engine — every meal generated is calibrated to support this outcome.</p>
              <div className="flex flex-wrap gap-2">
                {ADAPTATION_TARGETS.map(a => (
                  <PillButton
                    key={a.value}
                    active={adaptationTarget === a.value}
                    onClick={() => setAdaptationTarget(a.value)}
                  >
                    {a.label}
                  </PillButton>
                ))}
              </div>
              {adaptationTarget && (
                <div className="mt-4 bg-orange-950/30 border border-orange-500/20 rounded-xl px-4 py-3">
                  <p className="text-orange-300 text-xs font-semibold mb-0.5">
                    {ADAPTATION_TARGETS.find(a => a.value === adaptationTarget)?.label}
                  </p>
                  <p className="text-white/50 text-xs leading-relaxed">
                    {ADAPTATION_TARGETS.find(a => a.value === adaptationTarget)?.desc}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Athletic: Step 9 — Weekly Training Schedule (APN) ── */}
          {track === "athletic" && step === 9 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">Set your weekly training schedule</p>
              <p className="text-white/50 text-sm mb-4">
                Your nutrition automatically adjusts each day based on what you're training.
                Every session type shifts your carbohydrates, calories, and protein targets.
              </p>

              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Training Phase</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {APN_PHASES.map(p => (
                  <PillButton key={p.value} active={apnPhase === p.value} onClick={() => setApnPhase(p.value)}>
                    {p.label}
                  </PillButton>
                ))}
              </div>
              {apnPhase && (
                <div className="mb-5 bg-orange-950/20 border border-orange-500/15 rounded-xl px-3 py-2">
                  <p className="text-white/50 text-xs leading-relaxed">
                    {APN_PHASES.find(p => p.value === apnPhase)?.desc}
                  </p>
                </div>
              )}

              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Week Schedule</p>
              <div className="space-y-3">
                {APN_DAYS.map(day => {
                  const selected = weeklySchedule[day.key];
                  const selectedInfo = APN_SESSION_TYPES.find(s => s.value === selected);
                  return (
                    <div key={day.key}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-white/60 text-xs font-semibold w-8 shrink-0">{day.label}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {APN_SESSION_TYPES.map(s => (
                            <button
                              key={s.value}
                              onClick={() => setWeeklySchedule(prev => ({ ...prev, [day.key]: s.value }))}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                                selected === s.value
                                  ? "bg-orange-600 text-white"
                                  : "bg-white/8 text-white/50 border border-white/10"
                              }`}
                            >
                              {s.short}
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedInfo && selected !== "off" && (
                        <p className="text-white/30 text-xs ml-10 leading-relaxed">{selectedInfo.desc}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 bg-orange-950/20 border border-orange-500/15 rounded-xl px-4 py-3">
                <p className="text-orange-300 text-xs font-semibold mb-1">How this works</p>
                <p className="text-white/40 text-xs leading-relaxed">
                  MPM reads your schedule every morning and automatically adjusts your macro targets.
                  Power days add carbohydrates. Recovery days reduce them. No manual adjustments needed.
                </p>
              </div>
            </div>
          )}

          {/* ── Competition: Step 1 — Competition Type ── */}
          {track === "competition" && step === 1 && (
            <div>
              <p className="text-white font-bold text-lg mb-1">What type of competition?</p>
              <p className="text-white/50 text-sm mb-4">Each competition type uses a different prep timeline and peak week protocol.</p>
              <div className="space-y-5">
                {compGroups.map(group => (
                  <div key={group}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COMP_TYPES.filter(c => c.group === group).map(c => (
                        <PillButton
                          key={c.value}
                          active={compType === c.value}
                          onClick={() => { setCompType(c.value); if (c.value !== "other") setCustomSportName(""); }}
                        >
                          {c.label}
                        </PillButton>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={compType === "other" && customSportGroup === COMP_GROUP_KEYS[group] ? customSportName : ""}
                        onChange={e => handleCustomSportInput(group, COMP_GROUP_KEYS[group], e.target.value, setCompType)}
                        placeholder={`Other ${group.toLowerCase()} sport…`}
                        className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60 transition-colors ${
                          compType === "other" && customSportGroup === COMP_GROUP_KEYS[group]
                            ? "border-orange-400/60 bg-orange-600/10"
                            : "border-white/10"
                        }`}
                      />
                      {compType === "other" && customSportGroup === COMP_GROUP_KEYS[group] && customSportName.trim() && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                      )}
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
                    <button
                      type="button"
                      onClick={() => {
                        if (dateInputRef.current) {
                          try { dateInputRef.current.showPicker(); } catch { dateInputRef.current.focus(); }
                        }
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-0.5"
                    >
                      <Calendar className="w-4 h-4 text-orange-400" />
                    </button>
                    <input
                      ref={dateInputRef}
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
              <p className="text-white/50 text-sm mb-5">Optional — helps your protocol give precise guidance on cut strategy and calorie targets.</p>

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
                    MPM calculates your current phase from your event date automatically. As your event approaches, protocols shift. The calendar decides — not AI.
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
