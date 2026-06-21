/**
 * Carb Response Engine — v1.0
 *
 * Pure deterministic math engine (zero AI, zero I/O).
 * Drives carb-cycle phase transitions for Performance Nutrition users.
 *
 * Size categories (by body weight):
 *   small  < 150 lb
 *   medium 150–220 lb
 *   large  > 220 lb
 *
 * Refeed stop cap: max lbs that can be dropped during a refeed before
 * the engine triggers an exit back to low-carb.
 *   small  0.75 % of body weight
 *   medium 1.25 % of body weight
 *   large  1.75 % of body weight
 *
 * Carb bump on refeed start: +0.25 g/lb, capped per size tier.
 *   small  cap 30 g
 *   medium cap 50 g
 *   large  cap 75 g
 *
 * Fat offset: removes fat to keep the calorie delta roughly neutral.
 *   fatOffsetG = carbBumpG × (4/9) × 0.85
 *
 * Stall detection: ≥7 log entries, all carbsG ≤ 100, max−min weight ≤ 0.6 lb.
 *
 * Safety floor: carb target never goes below 50 g.
 */

export type CarbSizeCategory = "small" | "medium" | "large";
export type CarbCyclePhase = "low_carb" | "refeed" | "inactive";

export interface WeightLogEntry {
  date: string;
  weight: number;
  carbsG: number;
}

export interface CarbCycleState {
  phase: CarbCyclePhase;
  carbTargetG: number;
  fatTargetAdjustG: number;
  refeedStartDate: string | null;
  refeedStartWeightLb: number | null;
  refeedStopCapLb: number;
  weightLog: WeightLogEntry[];
  lastUpdated: string;
  manualOverride?: boolean;
}

export interface CarbEngineResult {
  sizeCategory: CarbSizeCategory;
  carbBumpG: number;
  fatOffsetG: number;
  refeedStopCapLb: number;
  stallDetected: boolean;
  refeedExitTriggered: boolean;
  recommendation: "start_refeed" | "continue_refeed" | "exit_refeed" | "hold" | "inactive";
  safetyFloor: 50;
}

const STALL_WINDOW = 7;
const STALL_CARB_MAX_G = 100;
const STALL_WEIGHT_SPREAD_LB = 0.6;
const SAFETY_FLOOR_G = 50;

const SIZE_CONFIG: Record<CarbSizeCategory, { refeedCapPct: number; carbCapG: number }> = {
  small:  { refeedCapPct: 0.0075, carbCapG: 30 },
  medium: { refeedCapPct: 0.0125, carbCapG: 50 },
  large:  { refeedCapPct: 0.0175, carbCapG: 75 },
};

export function getSizeCategory(bodyWeightLb: number): CarbSizeCategory {
  if (bodyWeightLb < 150) return "small";
  if (bodyWeightLb <= 220) return "medium";
  return "large";
}

export function computeRefeedStopCap(bodyWeightLb: number): number {
  const cat = getSizeCategory(bodyWeightLb);
  return Math.round(bodyWeightLb * SIZE_CONFIG[cat].refeedCapPct * 10) / 10;
}

export function computeCarbBump(bodyWeightLb: number): number {
  const cat = getSizeCategory(bodyWeightLb);
  const raw = bodyWeightLb * 0.25;
  return Math.min(Math.round(raw), SIZE_CONFIG[cat].carbCapG);
}

export function computeFatOffset(carbBumpG: number): number {
  return Math.round(carbBumpG * (4 / 9) * 0.85 * 10) / 10;
}

export function detectStall(weightLog: WeightLogEntry[]): boolean {
  if (weightLog.length < STALL_WINDOW) return false;
  const last7 = weightLog.slice(-STALL_WINDOW);

  // Require strictly 7 consecutive calendar days (no gaps, no duplicates)
  for (let i = 1; i < last7.length; i++) {
    const prev = new Date(last7[i - 1].date + "T00:00:00Z");
    const curr = new Date(last7[i].date + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;
    if (diffDays !== 1) return false;
  }

  const allLowCarb = last7.every((e) => e.carbsG <= STALL_CARB_MAX_G);
  if (!allLowCarb) return false;
  const weights = last7.map((e) => e.weight);
  const spread = Math.max(...weights) - Math.min(...weights);
  return spread <= STALL_WEIGHT_SPREAD_LB;
}

export function runCarbEngine(
  bodyWeightLb: number,
  state: CarbCycleState,
): CarbEngineResult {
  const sizeCategory = getSizeCategory(bodyWeightLb);
  const carbBumpG = computeCarbBump(bodyWeightLb);
  const fatOffsetG = computeFatOffset(carbBumpG);
  const refeedStopCapLb = computeRefeedStopCap(bodyWeightLb);
  const stallDetected = detectStall(state.weightLog);

  let refeedExitTriggered = false;
  if (state.phase === "refeed" && state.refeedStartWeightLb !== null) {
    const latestWeight = state.weightLog.at(-1)?.weight ?? state.refeedStartWeightLb;
    const dropped = state.refeedStartWeightLb - latestWeight;
    if (dropped >= refeedStopCapLb) refeedExitTriggered = true;
  }

  let recommendation: CarbEngineResult["recommendation"];
  if (state.phase === "inactive") {
    recommendation = "inactive";
  } else if (state.phase === "refeed") {
    recommendation = refeedExitTriggered ? "exit_refeed" : "continue_refeed";
  } else {
    recommendation = stallDetected ? "start_refeed" : "hold";
  }

  return {
    sizeCategory,
    carbBumpG,
    fatOffsetG,
    refeedStopCapLb,
    stallDetected,
    refeedExitTriggered,
    recommendation,
    safetyFloor: 50,
  };
}

export function buildInitialCarbCycleState(
  bodyWeightLb: number,
  baseCarbTargetG: number,
): CarbCycleState {
  const refeedStopCapLb = computeRefeedStopCap(bodyWeightLb);
  return {
    phase: "low_carb",
    carbTargetG: Math.max(baseCarbTargetG, SAFETY_FLOOR_G),
    fatTargetAdjustG: 0,
    refeedStartDate: null,
    refeedStartWeightLb: null,
    refeedStopCapLb,
    weightLog: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function applyRefeedTransition(
  state: CarbCycleState,
  bodyWeightLb: number,
  baseCarbTargetG: number,
): CarbCycleState {
  const carbBumpG = computeCarbBump(bodyWeightLb);
  const fatOffsetG = computeFatOffset(carbBumpG);
  const refeedStopCapLb = computeRefeedStopCap(bodyWeightLb);
  const newCarbTarget = Math.max(baseCarbTargetG + carbBumpG, SAFETY_FLOOR_G);
  const latestWeight = state.weightLog.at(-1)?.weight ?? bodyWeightLb;

  return {
    ...state,
    phase: "refeed",
    carbTargetG: newCarbTarget,
    fatTargetAdjustG: -fatOffsetG,
    refeedStartDate: new Date().toISOString().split("T")[0],
    refeedStartWeightLb: latestWeight,
    refeedStopCapLb,
    lastUpdated: new Date().toISOString(),
    manualOverride: false,
  };
}

export function applyLowCarbTransition(
  state: CarbCycleState,
  baseCarbTargetG: number,
): CarbCycleState {
  return {
    ...state,
    phase: "low_carb",
    carbTargetG: Math.max(baseCarbTargetG, SAFETY_FLOOR_G),
    fatTargetAdjustG: 0,
    refeedStartDate: null,
    refeedStartWeightLb: null,
    lastUpdated: new Date().toISOString(),
    manualOverride: false,
  };
}

export { SAFETY_FLOOR_G };
