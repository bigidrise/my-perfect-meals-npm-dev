import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dumbbell, Trophy, ChevronRight, ChevronLeft, Zap, Calendar as CalendarIcon, Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export interface PerformanceNutritionSetupFormProps {
  onSave?: () => void;
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

const ATHLETIC_GOALS: { value: AthleticGoal; labelKey: string; descKey: string }[] = [
  { value: "fat_loss",    labelKey: "performanceSetup.goals.fatLoss.label",     descKey: "performanceSetup.goals.fatLoss.desc" },
  { value: "muscle_gain", labelKey: "performanceSetup.goals.muscleGain.label",  descKey: "performanceSetup.goals.muscleGain.desc" },
  { value: "maintenance", labelKey: "performanceSetup.goals.maintenance.label", descKey: "performanceSetup.goals.maintenance.desc" },
  { value: "performance", labelKey: "performanceSetup.goals.performance.label", descKey: "performanceSetup.goals.performance.desc" },
];

const TRAINING_TYPES: { value: TrainingType; labelKey: string; group: string }[] = [
  { value: "strength",          labelKey: "performanceSetup.trainingTypes.strength",        group: "Iron Sports" },
  { value: "hypertrophy",       labelKey: "performanceSetup.trainingTypes.hypertrophy",     group: "Iron Sports" },
  { value: "powerlifting",      labelKey: "performanceSetup.trainingTypes.powerlifting",    group: "Iron Sports" },
  { value: "olympic_lifting",   labelKey: "performanceSetup.trainingTypes.olympicLifting",  group: "Iron Sports" },
  { value: "mma",               labelKey: "performanceSetup.trainingTypes.mma",             group: "Combat Sports" },
  { value: "boxing",            labelKey: "performanceSetup.trainingTypes.boxing",          group: "Combat Sports" },
  { value: "wrestling",         labelKey: "performanceSetup.trainingTypes.wrestling",       group: "Combat Sports" },
  { value: "bjj",               labelKey: "performanceSetup.trainingTypes.bjj",             group: "Combat Sports" },
  { value: "crossfit",          labelKey: "performanceSetup.trainingTypes.crossfit",        group: "Mixed" },
  { value: "endurance_running", labelKey: "performanceSetup.trainingTypes.running",         group: "Endurance" },
  { value: "cycling",           labelKey: "performanceSetup.trainingTypes.cycling",         group: "Endurance" },
  { value: "triathlon",         labelKey: "performanceSetup.trainingTypes.triathlon",       group: "Endurance" },
  { value: "tactical",          labelKey: "performanceSetup.trainingTypes.tactical",        group: "Other" },
  { value: "general_fitness",   labelKey: "performanceSetup.trainingTypes.generalFitness",  group: "Other" },
];

const TRAINING_FREQS: { value: TrainingFrequency; labelKey: string }[] = [
  { value: "1-2", labelKey: "performanceSetup.freqs.oneTwo" },
  { value: "3-4", labelKey: "performanceSetup.freqs.threeFour" },
  { value: "5-6", labelKey: "performanceSetup.freqs.fiveSix" },
  { value: "7+",  labelKey: "performanceSetup.freqs.sevenPlus" },
];

const CARDIO_OPTS: { value: CardioFocus; labelKey: string; descKey: string }[] = [
  { value: "none",      labelKey: "performanceSetup.cardio.none.label",      descKey: "performanceSetup.cardio.none.desc" },
  { value: "recovery",  labelKey: "performanceSetup.cardio.recovery.label",  descKey: "performanceSetup.cardio.recovery.desc" },
  { value: "zone_2",    labelKey: "performanceSetup.cardio.zone2.label",     descKey: "performanceSetup.cardio.zone2.desc" },
  { value: "tempo",     labelKey: "performanceSetup.cardio.tempo.label",     descKey: "performanceSetup.cardio.tempo.desc" },
  { value: "threshold", labelKey: "performanceSetup.cardio.threshold.label", descKey: "performanceSetup.cardio.threshold.desc" },
  { value: "hiit",      labelKey: "performanceSetup.cardio.hiit.label",      descKey: "performanceSetup.cardio.hiit.desc" },
  { value: "mixed",     labelKey: "performanceSetup.cardio.mixed.label",     descKey: "performanceSetup.cardio.mixed.desc" },
];

const ATHLETIC_PHASES: { value: AthleticPhase; labelKey: string; descKey: string }[] = [
  { value: "off_season",  labelKey: "performanceSetup.phases.offSeason.label", descKey: "performanceSetup.phases.offSeason.desc" },
  { value: "pre_season",  labelKey: "performanceSetup.phases.preSeason.label", descKey: "performanceSetup.phases.preSeason.desc" },
  { value: "in_season",   labelKey: "performanceSetup.phases.inSeason.label",  descKey: "performanceSetup.phases.inSeason.desc" },
  { value: "weight_cut",  labelKey: "performanceSetup.phases.weightCut.label", descKey: "performanceSetup.phases.weightCut.desc" },
  { value: "recovery",    labelKey: "performanceSetup.phases.recovery.label",  descKey: "performanceSetup.phases.recovery.desc" },
];

const COMP_TYPES: { value: CompType; labelKey: string; group: string }[] = [
  { value: "bodybuilding_show",          labelKey: "performanceSetup.compTypes.bodybuilding",        group: "Physique" },
  { value: "mens_physique",              labelKey: "performanceSetup.compTypes.mensPhysique",        group: "Physique" },
  { value: "classic_physique",           labelKey: "performanceSetup.compTypes.classicPhysique",     group: "Physique" },
  { value: "figure",                     labelKey: "performanceSetup.compTypes.figure",              group: "Physique" },
  { value: "bikini",                     labelKey: "performanceSetup.compTypes.bikini",              group: "Physique" },
  { value: "wellness",                   labelKey: "performanceSetup.compTypes.wellness",            group: "Physique" },
  { value: "powerlifting_meet",          labelKey: "performanceSetup.compTypes.powerliftingMeet",    group: "Strength Sports" },
  { value: "strongman_competition",      labelKey: "performanceSetup.compTypes.strongman",           group: "Strength Sports" },
  { value: "olympic_weightlifting_meet", labelKey: "performanceSetup.compTypes.olympicWeightlifting",group: "Strength Sports" },
  { value: "fight_camp",                 labelKey: "performanceSetup.compTypes.fightCamp",           group: "Combat Sports" },
  { value: "wrestling_season",           labelKey: "performanceSetup.compTypes.wrestlingSeason",     group: "Combat Sports" },
  { value: "crossfit_competition",       labelKey: "performanceSetup.compTypes.crossfitCompetition", group: "Functional / Mixed" },
  { value: "hyrox",                      labelKey: "performanceSetup.compTypes.hyrox",               group: "Functional / Mixed" },
  { value: "marathon",                   labelKey: "performanceSetup.compTypes.marathon",            group: "Endurance" },
  { value: "triathlon_race",             labelKey: "performanceSetup.compTypes.triathlon",           group: "Endurance" },
  { value: "spartan_race",               labelKey: "performanceSetup.compTypes.spartanRace",         group: "Endurance" },
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

// i18n key for a group heading (identifier -> translation key)
const COMP_GROUP_LABEL_KEYS: Record<string, string> = {
  "Physique": "performanceSetup.compGroups.physique",
  "Strength Sports": "performanceSetup.compGroups.strength",
  "Combat Sports": "performanceSetup.compGroups.combat",
  "Functional / Mixed": "performanceSetup.compGroups.functional",
  "Endurance": "performanceSetup.compGroups.endurance",
};

const ATHLETIC_GROUP_LABEL_KEYS: Record<string, string> = {
  "Iron Sports": "performanceSetup.athleticGroups.iron",
  "Combat Sports": "performanceSetup.athleticGroups.combat",
  "Mixed": "performanceSetup.athleticGroups.mixed",
  "Endurance": "performanceSetup.athleticGroups.endurance",
  "Other": "performanceSetup.athleticGroups.other",
};

const SESSION_DURATIONS: { value: SessionDuration; labelKey: string; descKey: string }[] = [
  { value: "under_30", labelKey: "performanceSetup.durations.under30.label", descKey: "performanceSetup.durations.under30.desc" },
  { value: "30_60",    labelKey: "performanceSetup.durations.thirtySixty.label", descKey: "performanceSetup.durations.thirtySixty.desc" },
  { value: "60_90",    labelKey: "performanceSetup.durations.sixtyNinety.label", descKey: "performanceSetup.durations.sixtyNinety.desc" },
  { value: "90_plus",  labelKey: "performanceSetup.durations.ninetyPlus.label", descKey: "performanceSetup.durations.ninetyPlus.desc" },
];

const RECOVERY_STATUSES: { value: RecoveryStatus; labelKey: string; descKey: string }[] = [
  { value: "good",    labelKey: "performanceSetup.recovery.good.label",    descKey: "performanceSetup.recovery.good.desc" },
  { value: "average", labelKey: "performanceSetup.recovery.average.label", descKey: "performanceSetup.recovery.average.desc" },
  { value: "poor",    labelKey: "performanceSetup.recovery.poor.label",    descKey: "performanceSetup.recovery.poor.desc" },
];

const ADAPTATION_TARGETS: { value: AdaptationTarget; labelKey: string; descKey: string }[] = [
  { value: "endurance",     labelKey: "performanceSetup.adaptation.endurance.label",     descKey: "performanceSetup.adaptation.endurance.desc" },
  { value: "conditioning",  labelKey: "performanceSetup.adaptation.conditioning.label",  descKey: "performanceSetup.adaptation.conditioning.desc" },
  { value: "speed",         labelKey: "performanceSetup.adaptation.speed.label",         descKey: "performanceSetup.adaptation.speed.desc" },
  { value: "power",         labelKey: "performanceSetup.adaptation.power.label",         descKey: "performanceSetup.adaptation.power.desc" },
  { value: "work_capacity", labelKey: "performanceSetup.adaptation.workCapacity.label",  descKey: "performanceSetup.adaptation.workCapacity.desc" },
  { value: "recovery",      labelKey: "performanceSetup.adaptation.activeRecovery.label",descKey: "performanceSetup.adaptation.activeRecovery.desc" },
];

const APN_SESSION_TYPES: { value: APNSessionType; labelKey: string; shortKey: string; descKey: string }[] = [
  { value: "strength",       labelKey: "performanceSetup.sessionTypes.strength.label",      shortKey: "performanceSetup.sessionTypes.strength.short",      descKey: "performanceSetup.sessionTypes.strength.desc" },
  { value: "power",          labelKey: "performanceSetup.sessionTypes.power.label",         shortKey: "performanceSetup.sessionTypes.power.short",         descKey: "performanceSetup.sessionTypes.power.desc" },
  { value: "endurance",      labelKey: "performanceSetup.sessionTypes.endurance.label",     shortKey: "performanceSetup.sessionTypes.endurance.short",     descKey: "performanceSetup.sessionTypes.endurance.desc" },
  { value: "sport_practice", labelKey: "performanceSetup.sessionTypes.sportPractice.label", shortKey: "performanceSetup.sessionTypes.sportPractice.short", descKey: "performanceSetup.sessionTypes.sportPractice.desc" },
  { value: "competition",    labelKey: "performanceSetup.sessionTypes.competition.label",   shortKey: "performanceSetup.sessionTypes.competition.short",   descKey: "performanceSetup.sessionTypes.competition.desc" },
  { value: "recovery",       labelKey: "performanceSetup.sessionTypes.recovery.label",      shortKey: "performanceSetup.sessionTypes.recovery.short",      descKey: "performanceSetup.sessionTypes.recovery.desc" },
  { value: "off",            labelKey: "performanceSetup.sessionTypes.off.label",           shortKey: "performanceSetup.sessionTypes.off.short",           descKey: "performanceSetup.sessionTypes.off.desc" },
];

const APN_PHASES: { value: APNTrainingPhase; labelKey: string; descKey: string }[] = [
  { value: "stabilization", labelKey: "performanceSetup.apnPhases.stabilization.label", descKey: "performanceSetup.apnPhases.stabilization.desc" },
  { value: "strength",      labelKey: "performanceSetup.apnPhases.strength.label",      descKey: "performanceSetup.apnPhases.strength.desc" },
  { value: "power",         labelKey: "performanceSetup.apnPhases.power.label",         descKey: "performanceSetup.apnPhases.power.desc" },
  { value: "peaking",       labelKey: "performanceSetup.apnPhases.peaking.label",       descKey: "performanceSetup.apnPhases.peaking.desc" },
  { value: "in_season",     labelKey: "performanceSetup.apnPhases.inSeason.label",      descKey: "performanceSetup.apnPhases.inSeason.desc" },
  { value: "off_season",    labelKey: "performanceSetup.apnPhases.offSeason.label",     descKey: "performanceSetup.apnPhases.offSeason.desc" },
];

const APN_DAYS: { key: string; labelKey: string }[] = [
  { key: "monday",    labelKey: "performanceSetup.days.mon" },
  { key: "tuesday",   labelKey: "performanceSetup.days.tue" },
  { key: "wednesday", labelKey: "performanceSetup.days.wed" },
  { key: "thursday",  labelKey: "performanceSetup.days.thu" },
  { key: "friday",    labelKey: "performanceSetup.days.fri" },
  { key: "saturday",  labelKey: "performanceSetup.days.sat" },
  { key: "sunday",    labelKey: "performanceSetup.days.sun" },
];

const DEFAULT_WEEKLY_SCHEDULE: Record<string, APNSessionType> = {
  monday: "off", tuesday: "off", wednesday: "off", thursday: "off",
  friday: "off", saturday: "off", sunday: "off",
};

const ATHLETIC_TOTAL = 10;
const COMP_TOTAL = 4;

export default function PerformanceNutritionSetupForm({ onSave }: PerformanceNutritionSetupFormProps) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const existingContext    = user?.performanceContext;
  const existingCompContext = user?.competitionPrepContext;
  const existingTrack      = user?.activeProtocolTrack;

  const [step, setStep]               = useState(0);
  const [saving, setSaving]           = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [track, setTrack] = useState<ProtocolTrack | "">(existingTrack ?? "");

  // Athletic fields
  const [primaryGoal, setPrimaryGoal]           = useState<AthleticGoal | "">(existingContext?.primaryGoal ?? "");
  const [trainingType, setTrainingType]         = useState<TrainingType | "">(existingContext?.trainingType ?? "");
  const [frequency, setFrequency]               = useState<TrainingFrequency | "">(existingContext?.trainingFrequency ?? "");
  const [cardioFocus, setCardioFocus]           = useState<CardioFocus | "">(existingContext?.cardioFocus ?? "");
  const [trainingPhase, setTrainingPhase]       = useState<AthleticPhase | "">(existingContext?.trainingPhase ?? "");
  const [twoADays, setTwoADays]                 = useState<boolean>(existingContext?.twoADays ?? false);
  const [sessionDuration, setSessionDuration]   = useState<SessionDuration | "">(existingContext?.sessionDuration ?? "");
  const [recoveryStatus, setRecoveryStatus]     = useState<RecoveryStatus | "">(existingContext?.recoveryStatus ?? "");
  const [adaptationTargets, setAdaptationTargets] = useState<AdaptationTarget[]>(
    (existingContext as any)?.adaptationTargets ??
    (existingContext?.adaptationTarget ? [existingContext.adaptationTarget as AdaptationTarget] : [])
  );

  // Adaptive Performance Nutrition fields
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
  const [customSportName, setCustomSportName]   = useState<string>(
    existingContext?.customSportName ?? existingCompContext?.customSportName ?? ""
  );
  const [customSportGroup, setCustomSportGroup] = useState<string>(
    existingContext?.customSportGroup ?? existingCompContext?.customSportGroup ?? ""
  );

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
      if (step === 8) return adaptationTargets.length > 0;
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
          adaptationTarget:  adaptationTargets[0] || undefined,
          adaptationTargets: adaptationTargets.length ? adaptationTargets : undefined,
          customSportName:  trainingType === "other" ? customSportName.trim() : undefined,
          customSportGroup: trainingType === "other" ? customSportGroup : undefined,
        });
      } else {
        Object.assign(body, {
          competitionType: compType,
          division:        division || undefined,
          eventDate,
          currentWeight:   currentWeight || undefined,
          targetWeight:    targetWeight  || undefined,
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
      await queryClient.invalidateQueries({ queryKey: ["carbCycleDashboard"] });
      const label = track === "competition" ? t("performanceSetup.toast.compSaved") : t("performanceSetup.toast.athleticSaved");
      toast({ title: t("performanceSetup.toast.activated"), description: label });
      onSave?.();
    } catch {
      toast({ title: t("performanceSetup.toast.errorTitle"), description: t("performanceSetup.toast.errorDesc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleCustomSportInput(group: string, groupKey: string, value: string, setTypeFn: (v: any) => void) {
    setCustomSportName(value);
    setCustomSportGroup(groupKey);
    if (value.trim()) setTypeFn("other");
  }

  const groups      = Array.from(new Set(TRAINING_TYPES.map(t => t.group)));
  const compGroups  = Array.from(new Set(COMP_TYPES.map(c => c.group)));
  const isLastStep  = step === totalSteps - 1;

  return (
    <div className="flex flex-col flex-1">

      {/* Progress bar */}
      <div className="h-1 bg-white/10 flex-shrink-0">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: track ? `${((step + 1) / totalSteps) * 100}%` : "5%" }}
        />
      </div>

      {/* Step title */}
      <div className="px-5 pt-5 pb-1 flex-shrink-0">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">
          {t("performanceSetup.stepCount", { current: step + 1, total: track ? totalSteps : "?" })}
        </p>
      </div>

      {/* Scrollable step content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* ── Step 0: Track Selector ── */}
        {step === 0 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.track.title")}</p>
            <p className="text-white/50 text-sm mb-6">{t("performanceSetup.track.subtitle")}</p>
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
                      <p className="text-white font-bold text-sm">{t("performanceSetup.track.athleticTitle")}</p>
                      {track === "athletic" && <Check className="w-4 h-4 text-orange-400" />}
                    </div>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{t("performanceSetup.track.athleticDesc")}</p>
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
                      <p className="text-white font-bold text-sm">{t("performanceSetup.track.compTitle")}</p>
                      {track === "competition" && <Check className="w-4 h-4 text-orange-400" />}
                    </div>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{t("performanceSetup.track.compDesc")}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Athletic: Step 1 — Primary Goal ── */}
        {track === "athletic" && step === 1 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.goals.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.goals.subtitle")}</p>
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
                      <p className="font-semibold text-sm">{t(g.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(g.descKey)}</p>
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
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.trainingType.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.trainingType.subtitle")}</p>
            <div className="space-y-4">
              {groups.map(group => (
                <div key={group}>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{t(ATHLETIC_GROUP_LABEL_KEYS[group] ?? group)}</p>
                  <div className="space-y-1.5">
                    {TRAINING_TYPES.filter(tt => tt.group === group).map(tt => (
                      <button
                        key={tt.value}
                        onClick={() => { setTrainingType(tt.value); if (tt.value !== "other") setCustomSportName(""); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors text-sm font-semibold ${
                          trainingType === tt.value
                            ? "bg-orange-600/20 border-orange-400/60 text-white"
                            : "bg-white/5 border-white/10 text-white/70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{t(tt.labelKey)}</span>
                          {trainingType === tt.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                        </div>
                      </button>
                    ))}
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={trainingType === "other" && customSportGroup === ATHLETIC_GROUP_KEYS[group] ? customSportName : ""}
                        onChange={e => handleCustomSportInput(group, ATHLETIC_GROUP_KEYS[group], e.target.value, setTrainingType)}
                        placeholder={t("performanceSetup.trainingType.otherPlaceholder", { group: t(ATHLETIC_GROUP_LABEL_KEYS[group] ?? group).toLowerCase() })}
                        className={`w-full bg-white/5 border rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60 transition-colors ${
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Athletic: Step 3 — Frequency ── */}
        {track === "athletic" && step === 3 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.frequency.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.frequency.subtitle")}</p>
            <div className="flex flex-wrap gap-3 mb-6">
              {TRAINING_FREQS.map(f => (
                <PillButton
                  key={f.value}
                  active={frequency === f.value}
                  onClick={() => setFrequency(f.value)}
                >
                  {t(f.labelKey)}
                </PillButton>
              ))}
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-4 border border-white/10">
              <p className="text-white font-semibold text-sm mb-1">{t("performanceSetup.frequency.twoADayQuestion")}</p>
              <p className="text-white/50 text-xs mb-3">{t("performanceSetup.frequency.twoADayDesc")}</p>
              <div className="flex gap-3">
                <PillButton active={twoADays === true} onClick={() => setTwoADays(true)}>
                  {t("performanceSetup.frequency.yes")}
                </PillButton>
                <PillButton active={twoADays === false} onClick={() => setTwoADays(false)}>
                  {t("performanceSetup.frequency.no")}
                </PillButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Athletic: Step 4 — Cardio Focus ── */}
        {track === "athletic" && step === 4 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.cardio.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.cardio.subtitle")}</p>
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
                      <p className="font-semibold text-sm">{t(c.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(c.descKey)}</p>
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
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.phase.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.phase.subtitle")}</p>
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
                      <p className="font-semibold text-sm">{t(p.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(p.descKey)}</p>
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
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.duration.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.duration.subtitle")}</p>
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
                      <p className="font-semibold text-sm">{t(d.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(d.descKey)}</p>
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
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.recoveryStep.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.recoveryStep.subtitle")}</p>
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
                      <p className="font-semibold text-sm">{t(r.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(r.descKey)}</p>
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
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.adaptationStep.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.adaptationStep.subtitle")}</p>
            <div className="space-y-2">
              {ADAPTATION_TARGETS.map(a => (
                <button
                  key={a.value}
                  onClick={() => setAdaptationTargets(prev =>
                    prev.includes(a.value) ? prev.filter(t => t !== a.value) : [...prev, a.value]
                  )}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    adaptationTargets.includes(a.value)
                      ? "bg-orange-600/20 border-orange-400/60 text-white"
                      : "bg-white/5 border-white/10 text-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{t(a.labelKey)}</p>
                      <p className="text-xs text-white/40 mt-0.5">{t(a.descKey)}</p>
                    </div>
                    {adaptationTargets.includes(a.value) && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
            {adaptationTargets.length > 0 && (
              <div className="mt-4 space-y-2">
                {ADAPTATION_TARGETS.filter(a => adaptationTargets.includes(a.value)).map(a => (
                  <div key={a.value} className="bg-orange-950/30 border border-orange-500/20 rounded-xl px-4 py-3">
                    <p className="text-orange-300 text-xs font-semibold mb-0.5">{t(a.labelKey)}</p>
                    <p className="text-white/50 text-xs leading-relaxed">{t(a.descKey)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Athletic: Step 9 — Weekly Training Schedule (APN) ── */}
        {track === "athletic" && step === 9 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.schedule.title")}</p>
            <p className="text-white/50 text-sm mb-5">
              {t("performanceSetup.schedule.subtitle")}
            </p>

            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{t("performanceSetup.schedule.trainingPhase")}</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {APN_PHASES.map(p => (
                <PillButton key={p.value} active={apnPhase === p.value} onClick={() => setApnPhase(p.value)}>
                  {t(p.labelKey)}
                </PillButton>
              ))}
            </div>
            {apnPhase && (
              <div className="mb-5 bg-orange-950/20 border border-orange-500/15 rounded-xl px-3 py-2">
                <p className="text-white/50 text-xs leading-relaxed">
                  {(() => {
                    const descKey = APN_PHASES.find(p => p.value === apnPhase)?.descKey;
                    return descKey ? t(descKey) : "";
                  })()}
                </p>
              </div>
            )}

            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">{t("performanceSetup.schedule.weekSchedule")}</p>
            <div className="space-y-2">
              {APN_DAYS.map(day => {
                const selected     = weeklySchedule[day.key];
                const selectedInfo = APN_SESSION_TYPES.find(s => s.value === selected);
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <span className="text-white/60 text-xs font-semibold w-8 shrink-0">{t(day.labelKey)}</span>
                    <select
                      value={selected}
                      onChange={e => setWeeklySchedule(prev => ({ ...prev, [day.key]: e.target.value as APNSessionType }))}
                      className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-sm font-semibold outline-none focus:border-orange-500/60 transition-colors appearance-none"
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff60' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                    >
                      {APN_SESSION_TYPES.map(s => (
                        <option key={s.value} value={s.value} className="bg-zinc-900 text-white">
                          {t(s.labelKey)}
                        </option>
                      ))}
                    </select>
                    {selectedInfo && selected !== "off" && (
                      <span className="text-white/30 text-xs leading-relaxed hidden sm:block max-w-[140px] shrink-0">{t(selectedInfo.descKey).split("—")[0].trim()}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 bg-orange-950/20 border border-orange-500/15 rounded-xl px-4 py-3">
              <p className="text-orange-300 text-xs font-semibold mb-1">{t("performanceSetup.schedule.howItWorksTitle")}</p>
              <p className="text-white/40 text-xs leading-relaxed">
                {t("performanceSetup.schedule.howItWorksBody")}
              </p>
            </div>
          </div>
        )}

        {/* ── Competition: Step 1 — Competition Type ── */}
        {track === "competition" && step === 1 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.compTypeStep.title")}</p>
            <p className="text-white/50 text-sm mb-5">{t("performanceSetup.compTypeStep.subtitle")}</p>
            <div className="space-y-4">
              {compGroups.map(group => (
                <div key={group}>
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">{t(COMP_GROUP_LABEL_KEYS[group] ?? group)}</p>
                  <div className="space-y-1.5">
                    {COMP_TYPES.filter(c => c.group === group).map(c => (
                      <button
                        key={c.value}
                        onClick={() => { setCompType(c.value); if (c.value !== "other") setCustomSportName(""); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors text-sm font-semibold ${
                          compType === c.value
                            ? "bg-orange-600/20 border-orange-400/60 text-white"
                            : "bg-white/5 border-white/10 text-white/70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{t(c.labelKey)}</span>
                          {compType === c.value && <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />}
                        </div>
                      </button>
                    ))}
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={compType === "other" && customSportGroup === COMP_GROUP_KEYS[group] ? customSportName : ""}
                        onChange={e => handleCustomSportInput(group, COMP_GROUP_KEYS[group], e.target.value, setCompType)}
                        placeholder={t("performanceSetup.trainingType.otherPlaceholder", { group: t(COMP_GROUP_LABEL_KEYS[group] ?? group).toLowerCase() })}
                        className={`w-full bg-white/5 border rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60 transition-colors ${
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Competition: Step 2 — Event Date + Division ── */}
        {track === "competition" && step === 2 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.eventStep.title")}</p>
            <p className="text-white/50 text-sm mb-6">{t("performanceSetup.eventStep.subtitle")}</p>

            <div className="space-y-4">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">{t("performanceSetup.eventStep.eventDate")} <span className="text-orange-400">*</span></p>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm flex items-center gap-3 text-left focus:outline-none focus:border-orange-500/60"
                    >
                      <CalendarIcon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <span className={eventDate ? "text-white" : "text-white/30"}>
                        {eventDate
                          ? new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                          : t("performanceSetup.eventStep.pickDate")}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-zinc-900 border-white/20" align="start">
                    <Calendar
                      mode="single"
                      selected={eventDate ? new Date(eventDate + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, "0");
                          const d = String(date.getDate()).padStart(2, "0");
                          setEventDate(`${y}-${m}-${d}`);
                        }
                        setDatePickerOpen(false);
                      }}
                      disabled={{ before: new Date() }}
                      initialFocus
                      classNames={{
                        day_selected:  "bg-orange-600 text-white hover:bg-orange-600 hover:text-white focus:bg-orange-600",
                        day_today:     "bg-white/10 text-white",
                        nav_button:    "border border-white/20 bg-white/5 text-white",
                        caption_label: "text-white font-semibold",
                        head_cell:     "text-white/40",
                        day:           "text-white",
                        day_outside:   "text-white/20",
                        day_disabled:  "text-white/20 opacity-40",
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {eventDate && (
                  <p className="text-orange-300 text-xs mt-2">
                    {t("performanceSetup.eventStep.weeksOut", { count: Math.max(0, Math.round((new Date(eventDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))) })}
                  </p>
                )}
              </div>

              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">{t("performanceSetup.eventStep.division")} <span className="text-white/30">{t("performanceSetup.optional")}</span></p>
                <input
                  type="text"
                  value={division}
                  onChange={e => setDivision(e.target.value)}
                  placeholder={t("performanceSetup.eventStep.divisionPlaceholder")}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Competition: Step 3 — Weight Info ── */}
        {track === "competition" && step === 3 && (
          <div>
            <p className="text-white font-bold text-xl mb-1">{t("performanceSetup.weightStep.title")}</p>
            <p className="text-white/50 text-sm mb-6">{t("performanceSetup.weightStep.subtitle")}</p>

            <div className="space-y-4">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">{t("performanceSetup.weightStep.currentWeight")} <span className="text-white/30">{t("performanceSetup.optional")}</span></p>
                <input
                  type="text"
                  value={currentWeight}
                  onChange={e => setCurrentWeight(e.target.value)}
                  placeholder={t("performanceSetup.weightStep.currentPlaceholder")}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                />
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">{t("performanceSetup.weightStep.targetWeight")} <span className="text-white/30">{t("performanceSetup.optional")}</span></p>
                <input
                  type="text"
                  value={targetWeight}
                  onChange={e => setTargetWeight(e.target.value)}
                  placeholder={t("performanceSetup.weightStep.targetPlaceholder")}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
                />
              </div>

              <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-orange-300 text-xs font-semibold mb-1">{t("performanceSetup.weightStep.howItWorksTitle")}</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  {t("performanceSetup.weightStep.howItWorksBody")}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Sticky footer — back / next / save */}
      <div
        className="sticky bottom-0 bg-black/80 backdrop-blur-md border-t border-white/10 px-5 pt-3 flex gap-3 flex-shrink-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> {t("performanceSetup.back")}
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
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t("performanceSetup.saving")}</>
          ) : isLastStep ? (
            <><Zap className="w-4 h-4" /> {t("performanceSetup.activateProtocol")}</>
          ) : (
            <>{t("performanceSetup.next")} <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>

    </div>
  );
}
