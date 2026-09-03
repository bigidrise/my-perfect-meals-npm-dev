/**
 * Adaptive Performance Nutrition — Protocol Resolver
 *
 * Pure deterministic function. No AI, no async, no side effects.
 * Input:  user's weeklyTrainingSchedule + performanceProtocolConfig + today's date.
 * Output: resolved daily macro targets for today's session type.
 *
 * Hierarchy position: between ProCare (wins over everything) and self-set Macro Calculator.
 * Medical safety layers (renal, cardiac, diabetes, pregnancy) always override this resolver.
 */

export type SessionType =
  | "strength"
  | "power"
  | "endurance"
  | "sport_practice"
  | "competition"
  | "recovery"
  | "off";

export type TrainingPhase =
  | "stabilization"
  | "strength"
  | "power"
  | "peaking"
  | "in_season"
  | "off_season";

export interface WeeklyTrainingSchedule {
  monday:    SessionType;
  tuesday:   SessionType;
  wednesday: SessionType;
  thursday:  SessionType;
  friday:    SessionType;
  saturday:  SessionType;
  sunday:    SessionType;
  trainingPhase: TrainingPhase;
  activatedAt: string;
  updatedAt: string;
}

export interface SessionModifier {
  carbsAdjustG:      number;
  caloriesAdjustKcal: number;
  proteinAdjustG:    number;
}

export interface PerformanceProtocolConfig {
  // baselineCalories/Protein/Carbs/Fat are DEPRECATED.
  // Performance Protocol does not own baseline macros — the Macro Calculator does.
  // These fields remain here only for backward compatibility with old DB records.
  // resolveTodayTargets() ignores them when a fresh `baseline` is passed.
  baselineCalories?: number;
  baselineProteinG?: number;
  baselineCarbsG?:   number;
  baselineFatG?:     number;
  sessionModifiers: Record<SessionType, SessionModifier>;
  generatedAt: string;
}

/** Live baseline supplied by the Macro Calculator — always from DB columns, never from a snapshot. */
export interface MacroBaseline {
  calories:      number;
  proteinG:      number;
  carbsG:        number;
  fatG:          number;
  starchyCarbsG: number;
  fibrousCarbsG: number;
}

export interface ResolvedSessionTargets {
  sessionType:   SessionType;
  sessionLabel:  string;
  trainingPhase: TrainingPhase;
  calories:      number;
  proteinG:      number;
  carbsG:        number;
  fatG:          number;
  starchyCarbsG: number;
  fibrousCarbsG: number;
  description:   string;
}

export const SESSION_LABELS: Record<SessionType, string> = {
  strength:       "Strength Training",
  power:          "Power Training",
  endurance:      "Endurance Training",
  sport_practice: "Sport Practice",
  competition:    "Competition Day",
  recovery:       "Recovery Day",
  off:            "Rest Day",
};

const SESSION_DESCRIPTIONS: Record<SessionType, string> = {
  strength:       "Resistance training — moderate carbohydrate support active.",
  power:          "Explosive output day — additional carbohydrate and protein support active.",
  endurance:      "Aerobic fuel priority — elevated carbohydrate availability active.",
  sport_practice: "Mixed demand day — moderate carbohydrate support active.",
  competition:    "Competition fueling — maximum carbohydrate availability active.",
  recovery:       "Recovery emphasis — reduced carbohydrates, anti-inflammatory foods prioritized.",
  off:            "Rest day — reduced caloric targets, lean protein and vegetables emphasized.",
};

const DOW_KEYS: Array<keyof Omit<WeeklyTrainingSchedule, "trainingPhase" | "activatedAt" | "updatedAt">> =
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function getDayKey(date: Date) {
  return DOW_KEYS[date.getDay()];
}

/**
 * Build default session modifiers from a user's primary performance goal.
 * Called once at setup time — stored in performanceProtocolConfig.sessionModifiers.
 * Coaches can override individual values later via ProCare.
 */
export function buildDefaultModifiers(primaryGoal: string): Record<SessionType, SessionModifier> {
  const presets: Record<string, Record<SessionType, SessionModifier>> = {
    performance: {
      strength:       { carbsAdjustG:  30, caloriesAdjustKcal:  120, proteinAdjustG:  5 },
      power:          { carbsAdjustG:  60, caloriesAdjustKcal:  240, proteinAdjustG: 10 },
      endurance:      { carbsAdjustG:  80, caloriesAdjustKcal:  320, proteinAdjustG:  0 },
      sport_practice: { carbsAdjustG:  45, caloriesAdjustKcal:  180, proteinAdjustG:  5 },
      competition:    { carbsAdjustG: 100, caloriesAdjustKcal:  400, proteinAdjustG: 10 },
      recovery:       { carbsAdjustG: -40, caloriesAdjustKcal: -160, proteinAdjustG:  0 },
      off:            { carbsAdjustG: -60, caloriesAdjustKcal: -240, proteinAdjustG: -5 },
    },
    muscle_gain: {
      strength:       { carbsAdjustG:  40, caloriesAdjustKcal:  160, proteinAdjustG: 10 },
      power:          { carbsAdjustG:  30, caloriesAdjustKcal:  120, proteinAdjustG: 10 },
      endurance:      { carbsAdjustG:  40, caloriesAdjustKcal:  160, proteinAdjustG:  0 },
      sport_practice: { carbsAdjustG:  30, caloriesAdjustKcal:  120, proteinAdjustG:  5 },
      competition:    { carbsAdjustG:  60, caloriesAdjustKcal:  240, proteinAdjustG:  5 },
      recovery:       { carbsAdjustG: -20, caloriesAdjustKcal:  -80, proteinAdjustG:  0 },
      off:            { carbsAdjustG: -30, caloriesAdjustKcal: -120, proteinAdjustG:  0 },
    },
    fat_loss: {
      strength:       { carbsAdjustG:  20, caloriesAdjustKcal:   80, proteinAdjustG:  5 },
      power:          { carbsAdjustG:  30, caloriesAdjustKcal:  120, proteinAdjustG:  5 },
      endurance:      { carbsAdjustG:  40, caloriesAdjustKcal:  160, proteinAdjustG:  0 },
      sport_practice: { carbsAdjustG:  25, caloriesAdjustKcal:  100, proteinAdjustG:  0 },
      competition:    { carbsAdjustG:  50, caloriesAdjustKcal:  200, proteinAdjustG:  5 },
      recovery:       { carbsAdjustG: -20, caloriesAdjustKcal:  -80, proteinAdjustG:  0 },
      off:            { carbsAdjustG: -30, caloriesAdjustKcal: -120, proteinAdjustG:  0 },
    },
    maintenance: {
      strength:       { carbsAdjustG:  20, caloriesAdjustKcal:   80, proteinAdjustG:  0 },
      power:          { carbsAdjustG:  40, caloriesAdjustKcal:  160, proteinAdjustG:  5 },
      endurance:      { carbsAdjustG:  50, caloriesAdjustKcal:  200, proteinAdjustG:  0 },
      sport_practice: { carbsAdjustG:  30, caloriesAdjustKcal:  120, proteinAdjustG:  0 },
      competition:    { carbsAdjustG:  60, caloriesAdjustKcal:  240, proteinAdjustG:  5 },
      recovery:       { carbsAdjustG: -20, caloriesAdjustKcal:  -80, proteinAdjustG:  0 },
      off:            { carbsAdjustG: -30, caloriesAdjustKcal: -120, proteinAdjustG:  0 },
    },
  };
  return presets[primaryGoal] ?? presets["maintenance"];
}

/**
 * Resolve today's macro targets from a weekly training schedule + protocol config.
 *
 * `baseline` must be the live Macro Calculator values from the DB
 * (dailyCalorieTarget / dailyProteinTarget / dailyCarbsTarget / dailyFatTarget).
 * It is never read from `config` — the protocol config no longer stores a baseline snapshot.
 *
 * For backward compatibility with old DB records that still carry baselineCalories etc.,
 * those fields are silently ignored when `baseline` is supplied.
 *
 * Pure function — pass `now` for testability; defaults to current system time.
 */
export function resolveTodayTargets(
  schedule: WeeklyTrainingSchedule,
  config: PerformanceProtocolConfig,
  baseline: MacroBaseline,
  now: Date = new Date(),
): ResolvedSessionTargets {
  const dayKey   = getDayKey(now);
  const sessionType: SessionType = (schedule[dayKey] as SessionType) ?? "off";
  const mod      = config.sessionModifiers[sessionType] ?? { carbsAdjustG: 0, caloriesAdjustKcal: 0, proteinAdjustG: 0 };

  const calories      = Math.max(0, baseline.calories + mod.caloriesAdjustKcal);
  const proteinG      = Math.max(0, baseline.proteinG  + mod.proteinAdjustG);
  const carbsG        = Math.max(0, baseline.carbsG    + mod.carbsAdjustG);
  const fatG          = baseline.fatG;
  // Training carb adjustments apply to starchy carbs only — fibrous carbs are fixed.
  const starchyCarbsG = Math.max(0, baseline.starchyCarbsG + mod.carbsAdjustG);
  const fibrousCarbsG = baseline.fibrousCarbsG;

  return {
    sessionType,
    sessionLabel:  SESSION_LABELS[sessionType],
    trainingPhase: schedule.trainingPhase,
    calories,
    proteinG,
    carbsG,
    fatG,
    starchyCarbsG,
    fibrousCarbsG,
    description: SESSION_DESCRIPTIONS[sessionType],
  };
}
