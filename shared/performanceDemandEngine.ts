/**
 * Performance Demand Engine — Phase 2 of the Adaptive Performance Intelligence Layer
 *
 * Pure deterministic function: no AI calls, no side effects, no imports from server.
 * Safe to import on both client and server.
 *
 * Input:  PerformanceContext (the user's stored athletic profile)
 * Output: DemandProfile (fuel demand, recovery demand, adaptation demand, training load, nutrition priorities)
 *
 * This is the hidden intelligence layer. The hub visualizes it; the meal generator uses it.
 */

// ── Input types (all fields optional for backward compat) ────────────────────

export type SessionDuration = "under_30" | "30_60" | "60_90" | "90_plus";
export type RecoveryStatus  = "good" | "average" | "poor";
export type AdaptationTarget =
  | "endurance" | "recovery" | "conditioning" | "work_capacity"
  | "speed" | "power" | "fat_loss" | "muscle_gain";

export interface PerformanceContext {
  primaryGoal?:       string;
  trainingType?:      string;
  trainingFrequency?: string;   // "1-2" | "3-4" | "5-6" | "7+"
  cardioFocus?:       string;
  trainingPhase?:     string;
  twoADays?:          boolean;
  sessionDuration?:   SessionDuration;
  recoveryStatus?:    RecoveryStatus;
  adaptationTarget?:  AdaptationTarget;
  customSportName?:   string;
  activatedAt?:       string;
  updatedAt?:         string;
}

// ── Output types ─────────────────────────────────────────────────────────────

export type FuelDemand =
  | "low"       // Restricted / low volume
  | "moderate"  // Standard mixed training
  | "glycogen"  // High intensity or high volume — needs substantial carb support
  | "competition"; // Elite volume + glycolytic demand — maximum carb availability

export type RecoveryDemand = "low" | "moderate" | "high";

export type AdaptationDemand =
  | "endurance_focused"
  | "recovery_focused"
  | "power_focused"
  | "body_composition_focused";

export type TrainingLoad = "light" | "moderate" | "high" | "elite";

export interface DemandProfile {
  fuelDemand:         FuelDemand;
  recoveryDemand:     RecoveryDemand;
  adaptationDemand:   AdaptationDemand;
  trainingLoad:       TrainingLoad;
  nutritionPriorities: string[];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function freqRank(freq?: string): number {
  switch (freq) {
    case "1-2": return 1;
    case "3-4": return 2;
    case "5-6": return 3;
    case "7+":  return 4;
    default:    return 0;
  }
}

function durRank(dur?: SessionDuration | string): number {
  switch (dur) {
    case "under_30": return 1;
    case "30_60":    return 2;
    case "60_90":    return 3;
    case "90_plus":  return 4;
    default:         return 0;
  }
}

const HIGH_GLYCOLYTIC_SPORTS = new Set([
  "endurance_running", "cycling", "triathlon",
  "crossfit", "mma", "bjj", "wrestling", "boxing",
]);

const HIGH_CARDIO      = new Set(["hiit", "threshold"]);
const MODERATE_CARDIO  = new Set(["mixed", "tempo", "zone_2"]);

// ── Rule tables ───────────────────────────────────────────────────────────────

function computeFuelDemand(ctx: PerformanceContext): FuelDemand {
  const fq    = freqRank(ctx.trainingFrequency);
  const dr    = durRank(ctx.sessionDuration);
  const cardio = ctx.cardioFocus ?? "none";
  const sport  = ctx.trainingType ?? "";
  const phase  = ctx.trainingPhase ?? "";

  // Weight cut → deficit phase; fuel demand is deliberately low
  if (phase === "weight_cut") return "low";

  // Competition tier — elite volume + glycolytic demand in active season
  if (
    (fq >= 4 || ctx.twoADays) &&
    (HIGH_GLYCOLYTIC_SPORTS.has(sport) || HIGH_CARDIO.has(cardio)) &&
    phase === "in_season"
  ) return "competition";

  // Glycogen tier — high-intensity or high-volume signals
  if (fq >= 4)                                       return "glycogen";
  if (ctx.twoADays)                                  return "glycogen";
  if (dr >= 4 && fq >= 2)                            return "glycogen"; // 90+ min × 3+ days/wk
  if (HIGH_CARDIO.has(cardio) && fq >= 2)            return "glycogen";
  if (HIGH_GLYCOLYTIC_SPORTS.has(sport) && fq >= 2)  return "glycogen";
  if (MODERATE_CARDIO.has(cardio) && fq >= 3)        return "glycogen";

  // Low tier — very low volume or explicit recovery
  if (fq <= 1 && (cardio === "none" || cardio === "recovery")) return "low";
  if (dr <= 1 && fq <= 1)                            return "low";

  return "moderate";
}

function computeRecoveryDemand(ctx: PerformanceContext): RecoveryDemand {
  const fq      = freqRank(ctx.trainingFrequency);
  const dr      = durRank(ctx.sessionDuration);
  const status  = ctx.recoveryStatus ?? "good";
  const phase   = ctx.trainingPhase ?? "";

  // Always high
  if (status === "poor")                               return "high";
  if (ctx.twoADays)                                    return "high";
  if (fq >= 4)                                         return "high";
  if (fq >= 3 && dr >= 4)                              return "high"; // 5–6 days × 90+ min
  if (phase === "weight_cut" || phase === "in_season") return "high";

  // Moderate
  if (status === "average")         return "moderate";
  if (fq >= 3)                      return "moderate";
  if (dr >= 3 && fq >= 2)           return "moderate"; // 60–90 min × 3+ days

  return "low";
}

const ENDURANCE_SPORTS = new Set(["endurance_running", "cycling", "triathlon"]);
const POWER_SPORTS     = new Set([
  "powerlifting", "olympic_lifting", "strength", "mma", "boxing", "wrestling",
]);

function computeAdaptationDemand(ctx: PerformanceContext): AdaptationDemand {
  const target = ctx.adaptationTarget;
  const sport  = ctx.trainingType ?? "";
  const goal   = ctx.primaryGoal ?? "";

  // Explicit adaptation target always wins
  if (target === "endurance" || target === "conditioning") return "endurance_focused";
  if (target === "recovery")                               return "recovery_focused";
  if (target === "power" || target === "speed" || target === "work_capacity") return "power_focused";
  if (target === "fat_loss" || target === "muscle_gain")   return "body_composition_focused";

  // Fall back to sport + goal inference
  if (ENDURANCE_SPORTS.has(sport)) return "endurance_focused";
  if (POWER_SPORTS.has(sport))     return "power_focused";
  if (goal === "performance")      return "power_focused";
  if (goal === "fat_loss" || goal === "muscle_gain") return "body_composition_focused";

  return "body_composition_focused";
}

function computeTrainingLoad(ctx: PerformanceContext): TrainingLoad {
  const fq     = freqRank(ctx.trainingFrequency);
  const dr     = durRank(ctx.sessionDuration);
  const cardio = ctx.cardioFocus ?? "none";

  if (ctx.twoADays)                                     return "elite";
  if (fq >= 4)                                          return "elite";
  if (fq >= 3 && dr >= 4 && HIGH_CARDIO.has(cardio))   return "elite";

  if (fq >= 3)                              return "high";
  if (dr >= 4)                              return "high";
  if (HIGH_CARDIO.has(cardio) && fq >= 2)   return "high";

  if (fq >= 2)  return "moderate";
  if (dr >= 3)  return "moderate";

  return "light";
}

function buildNutritionPriorities(
  fuel:       FuelDemand,
  recovery:   RecoveryDemand,
  adaptation: AdaptationDemand,
  load:       TrainingLoad,
  ctx:        PerformanceContext,
): string[] {
  const p: string[] = [];

  // 1. Recovery leads when demand is high
  if (recovery === "high") p.push("Recovery support");

  // 2. Carbohydrate availability when glycogen/competition demand
  if (fuel === "competition" || fuel === "glycogen") p.push("Carbohydrate availability");

  // 3. Protein distribution — always present
  p.push("Protein distribution");

  // 4. Adaptation-specific priorities
  switch (adaptation) {
    case "endurance_focused":
      p.push("Aerobic fuel utilization");
      break;
    case "power_focused":
      p.push("Explosive power nutrients");
      break;
    case "body_composition_focused":
      p.push(ctx.primaryGoal === "fat_loss" ? "Fat oxidation priority" : "Lean muscle support");
      break;
    case "recovery_focused":
      if (!p.includes("Recovery support")) p.push("Recovery support");
      p.push("Anti-inflammatory nutrition");
      break;
  }

  // 5. Carb timing for moderate fuel (when not already added)
  if (fuel === "moderate" && !p.includes("Carbohydrate availability")) {
    p.push("Carbohydrate timing");
  }

  // 6. Hydration for high/elite load
  if (load === "high" || load === "elite") p.push("Hydration emphasis");

  // 7. Moderate recovery support (when not already added)
  if (recovery === "moderate" && !p.includes("Recovery support")) {
    p.push("Recovery support");
  }

  // Deduplicate while preserving order
  return p.filter((v, i, a) => a.indexOf(v) === i);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the demand profile for a user's performance context.
 * Pure function — no side effects, no AI, no async.
 * Returns a sensible default when context is null/undefined.
 */
export function computeDemandProfile(ctx: PerformanceContext | null | undefined): DemandProfile {
  if (!ctx) {
    return {
      fuelDemand:          "moderate",
      recoveryDemand:      "moderate",
      adaptationDemand:    "body_composition_focused",
      trainingLoad:        "moderate",
      nutritionPriorities: ["Protein distribution", "Carbohydrate timing", "Recovery support"],
    };
  }

  const fuelDemand       = computeFuelDemand(ctx);
  const recoveryDemand   = computeRecoveryDemand(ctx);
  const adaptationDemand = computeAdaptationDemand(ctx);
  const trainingLoad     = computeTrainingLoad(ctx);
  const nutritionPriorities = buildNutritionPriorities(
    fuelDemand, recoveryDemand, adaptationDemand, trainingLoad, ctx,
  );

  return { fuelDemand, recoveryDemand, adaptationDemand, trainingLoad, nutritionPriorities };
}

// ── Display helpers (used by hub + professional view) ─────────────────────────

export const FUEL_DEMAND_LABELS: Record<FuelDemand, string> = {
  low:         "Low Demand",
  moderate:    "Moderate Demand",
  glycogen:    "Glycogen Support",
  competition: "Competition Demand",
};

export const FUEL_DEMAND_COLORS: Record<FuelDemand, string> = {
  low:         "bg-blue-950/40 border-blue-500/30 text-blue-300",
  moderate:    "bg-white/5 border-white/10 text-white/70",
  glycogen:    "bg-orange-950/40 border-orange-500/30 text-orange-300",
  competition: "bg-red-950/40 border-red-500/30 text-red-300",
};

export const RECOVERY_DEMAND_LABELS: Record<RecoveryDemand, string> = {
  low:      "Low",
  moderate: "Moderate",
  high:     "High",
};

export const RECOVERY_DEMAND_COLORS: Record<RecoveryDemand, string> = {
  low:      "bg-green-950/40 border-green-500/30 text-green-300",
  moderate: "bg-yellow-950/40 border-yellow-500/30 text-yellow-300",
  high:     "bg-red-950/40 border-red-500/30 text-red-300",
};

export const ADAPTATION_DEMAND_LABELS: Record<AdaptationDemand, string> = {
  endurance_focused:        "Endurance Focused",
  recovery_focused:         "Recovery Focused",
  power_focused:            "Power Focused",
  body_composition_focused: "Body Composition",
};

export const TRAINING_LOAD_LABELS: Record<TrainingLoad, string> = {
  light:    "Light",
  moderate: "Moderate",
  high:     "High",
  elite:    "Elite",
};

export const TRAINING_LOAD_COLORS: Record<TrainingLoad, string> = {
  light:    "bg-green-950/40 border-green-500/30 text-green-300",
  moderate: "bg-white/5 border-white/10 text-white/70",
  high:     "bg-orange-950/40 border-orange-500/30 text-orange-300",
  elite:    "bg-red-950/40 border-red-500/30 text-red-300",
};
