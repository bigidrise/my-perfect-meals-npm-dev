/**
 * Macro Calculator Engine — SERVER SIDE ONLY
 *
 * [P3.2] Moved from client/src/pages/MacroCalculator.tsx to protect proprietary
 * nutrition intelligence: Mifflin-St Jeor BMR, tiered protein model, adaptive
 * fibrous carb system, clinical adjustment pipeline (insulin resistance, menopause,
 * high stress, waist-height risk), body-type tilt, and strategy layer.
 *
 * Exposed via POST /api/macro-calculator/compute — authenticated, rate-limited.
 */

export type Goal = "loss" | "maint" | "gain";
export type Sex = "male" | "female";
export type BodyType = "ecto" | "meso" | "endo";
export type UserType = "general" | "committed" | "athlete";
export type CutIntensity = "hard" | "moderate" | "none";
export type CutStyle = "balanced" | "lowCarb";

export type PerformanceOverlay = "standard" | "performance" | "competition_prep" | "recovery" | "recomp";
export type PerformanceControlMode = "self_guided" | "coach_controlled";

const OVERLAY_MACRO_DEFAULTS: Record<PerformanceOverlay, Partial<Pick<MacroComputeInput, "goal"|"cutIntensity"|"cutStyle"|"starchyCarbCap_g">>> = {
  standard:          {},
  performance:       { cutIntensity: "none" },
  competition_prep:  { goal: "loss", cutIntensity: "hard", cutStyle: "lowCarb", starchyCarbCap_g: 30 },
  recovery:          { cutIntensity: "none", cutStyle: "balanced" },
  recomp:            { goal: "maint", cutIntensity: "moderate", cutStyle: "balanced" },
};

/**
 * Applies performance overlay defaults to a partial MacroComputeInput.
 * Overlay defaults are applied ONLY for fields not explicitly provided (undefined).
 * Explicit caller-provided values always win.
 * Returns the merged input — does not mutate the original.
 */
export function resolvePerformanceMacroStrategy(
  base: Partial<MacroComputeInput>,
  overlay: PerformanceOverlay,
): Partial<MacroComputeInput> {
  if (overlay === "standard") return base;
  const defaults = OVERLAY_MACRO_DEFAULTS[overlay] ?? {};
  const merged: Partial<MacroComputeInput> = { ...defaults };
  for (const key of Object.keys(base) as (keyof MacroComputeInput)[]) {
    if (base[key] !== undefined) {
      (merged as any)[key] = base[key];
    }
  }
  return merged;
}

export interface MacroComputeInput {
  sex: Sex;
  kg: number;
  cm: number;
  age: number;
  activity: string;
  goal: Goal;
  userType: UserType;
  bodyType: BodyType;
  highWaistRisk: boolean;
  menopause: boolean;
  insulinResistance: boolean;
  highStress: boolean;
  mealsPerDay: number;
  fibrousCarbSafetyCap_g: number;
  cutIntensity: CutIntensity;
  cutStyle: CutStyle;
  starchyCarbCap_g: number | null;
  allowZeroStarchyOnLowDay: boolean;
  strictMode: boolean;
}

export interface MacroResult {
  calories: number;
  protein: { g: number; kcal: number };
  fat: { g: number; kcal: number };
  carbs: { g: number; kcal: number; starchy: number; fibrous: number };
  vegetableCupsPerMeal?: number;
  vegetableCupsPerDay?: number;
  safetyFloorUnmet?: boolean;
  safetyFloorReason?: string;
}

export interface MacroComputeOutput {
  bmr: number;
  tdee: number;
  target: number;
  macros: MacroResult;
}

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const STARCHY_MULT: Record<Goal, number> = { loss: 0.25, maint: 0.55, gain: 1.25 };
const FAT_MULT: Record<Goal, number> = { loss: 0.35, maint: 0.42, gain: 0.5 };

function mifflin({ sex, kg, cm, age }: { sex: Sex; kg: number; cm: number; age: number }): number {
  const b = 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
  return Math.max(800, Math.round(b));
}

function goalAdjust(tdee: number, goal: Goal): number {
  if (goal === "loss") return Math.round(tdee * 0.85);
  if (goal === "gain") return Math.round(tdee * 1.1);
  return Math.round(tdee);
}

function calcProtein(lb: number, goal: Goal, userType: UserType = "general"): number {
  let raw: number;

  if (userType === "general") {
    if (goal === "loss") raw = lb * 0.8;
    else if (goal === "gain") raw = lb * 0.9;
    else raw = lb * 0.7;
  } else if (userType === "committed") {
    if (goal === "loss") raw = lb * 1.0;
    else if (goal === "gain") raw = lb * 1.1;
    else raw = lb * 0.9;
  } else {
    raw = lb * 1.1;
  }

  return Math.min(260, Math.round(raw));
}

function calcMacrosBase({ lb, goal, userType }: { lb: number; goal: Goal; userType: UserType }) {
  const proteinG = calcProtein(lb, goal, userType);
  const fibrousG = Math.max(40, Math.round(lb * 0.25));
  let starchyG = Math.round(lb * (STARCHY_MULT[goal] ?? 0.45));
  const fatG = Math.round(lb * (FAT_MULT[goal] ?? 0.35));

  let carbsG = starchyG + fibrousG;
  let calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  if (calories < 1200) {
    starchyG += Math.ceil((1200 - calories) / 4);
    carbsG = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  } else if (calories > 4000) {
    starchyG = Math.max(0, starchyG - Math.ceil((calories - 4000) / 4));
    carbsG = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  }

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

interface InputAdjConfig {
  age: number;
  activity: string;
  highWaistRisk: boolean;
  menopause: boolean;
  insulinResistance: boolean;
  highStress: boolean;
  mealsPerDay: number;
  fibrousCarbSafetyCap_g: number;
}

function applyInputAdjustments(base: any, cfg: InputAdjConfig) {
  const fibrousBase = base.carbs.fibrous as number;

  const ACTIVITY_STARCH: Record<string, number> = {
    sedentary: 0.85,
    light: 0.95,
    moderate: 1.0,
    very: 1.1,
    extra: 1.2,
  };
  let starchyG = Math.round((base.carbs.starchy as number) * (ACTIVITY_STARCH[cfg.activity] ?? 1.0));
  const baselineAfterActivity = starchyG;

  let starchyMult = 1.0;
  let proteinMult = 1.0;
  let fatMult = 1.0;
  let extraCupsPerMeal = 0;

  if (cfg.insulinResistance) {
    starchyMult *= 0.6;
    if (cfg.highWaistRisk) starchyMult *= 0.85;
  } else if (cfg.highWaistRisk) {
    starchyMult *= 0.75;
  }

  if (cfg.age > 55) {
    starchyMult *= 0.9;
    proteinMult *= 1.05;
  }

  if (cfg.menopause) {
    starchyMult *= 0.85;
    fatMult *= 1.1;
  }

  if (cfg.highStress) {
    starchyMult *= 0.8;
    proteinMult *= 1.1;
    extraCupsPerMeal += 1;
  }

  starchyMult = Math.max(starchyMult, 0.5);

  starchyG = Math.max(0, Math.round(starchyG * starchyMult));
  let proteinG = Math.min(260, Math.round((base.protein.g as number) * proteinMult));
  let fatG = Math.round((base.fat.g as number) * fatMult);

  const starchyReduction = baselineAfterActivity > 0 ? starchyG / baselineAfterActivity : 0;
  if (starchyG === 0) {
    extraCupsPerMeal += 2;
  } else if (starchyReduction < 0.5) {
    extraCupsPerMeal += 2;
  } else if (starchyReduction < 0.75) {
    extraCupsPerMeal += 1;
  }

  const addedFibrous = extraCupsPerMeal > 0 ? Math.round(cfg.mealsPerDay * extraCupsPerMeal * 5) : 0;
  const fibrousG = Math.min(cfg.fibrousCarbSafetyCap_g, fibrousBase + addedFibrous);

  const carbsG = starchyG + fibrousG;
  const calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

interface StrategyConfig {
  lb: number;
  mealsPerDay: number;
  cutIntensity: CutIntensity;
  cutStyle: CutStyle;
  starchyCarbCap_g: number | null;
  allowZeroStarchyOnLowDay: boolean;
  fibrousCarbSafetyCap_g: number;
  strictMode: boolean;
}

function applyStrategyLayer(base: any, cfg: StrategyConfig) {
  let proteinG = base.protein.g as number;
  let fatG = base.fat.g as number;
  let starchyG = base.carbs.starchy as number;
  const fibrousBase = Math.min(base.carbs.fibrous as number, cfg.fibrousCarbSafetyCap_g);
  const baselineStarchyG = starchyG;

  if (cfg.cutIntensity === "hard") {
    proteinG = Math.round(proteinG * 1.1);
    if (cfg.cutStyle === "balanced") {
      starchyG = Math.round(starchyG * 0.7);
      fatG = Math.round(cfg.lb * 0.3);
    } else if (cfg.cutStyle === "lowCarb") {
      starchyG = Math.round(starchyG * 0.4);
      fatG = Math.round(cfg.lb * 0.55);
    }
  }

  if (cfg.starchyCarbCap_g !== null && cfg.starchyCarbCap_g !== undefined) {
    starchyG = Math.min(starchyG, cfg.starchyCarbCap_g);
  }

  starchyG = Math.max(0, Math.round(starchyG));

  const starchyRatio = baselineStarchyG > 0 ? starchyG / baselineStarchyG : 0;
  let cupsPerMeal: number;
  if (starchyG === 0) {
    cupsPerMeal = 6;
  } else if (starchyRatio < 0.25) {
    cupsPerMeal = 5;
  } else if (starchyRatio < 0.5) {
    cupsPerMeal = 4;
  } else if (starchyRatio < 0.75) {
    cupsPerMeal = 3.5;
  } else {
    cupsPerMeal = 3;
  }

  const computedFibrous = Math.round(cfg.mealsPerDay * cupsPerMeal * 5);
  const fibrousG = Math.min(cfg.fibrousCarbSafetyCap_g, Math.max(fibrousBase, computedFibrous));
  const vegetableCupsPerDay = Math.round(cfg.mealsPerDay * cupsPerMeal);

  const carbsG = starchyG + fibrousG;
  const calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
    vegetableCupsPerMeal: cupsPerMeal,
    vegetableCupsPerDay,
  };
}

function applyBodyTypeTilt(base: any, bodyType: BodyType, activity: string) {
  if (bodyType === "meso") return base;

  const fibrousG = base.carbs.fibrous as number;
  let starchyG = base.carbs.starchy as number;

  if (bodyType === "endo") {
    const shiftPct = activity === "sedentary" ? 0.1 : activity === "light" ? 0.12 : 0.15;
    starchyG = Math.max(0, Math.round(starchyG * (1 - shiftPct)));
  } else if (bodyType === "ecto") {
    starchyG = Math.round(starchyG * 1.15);
  }

  const carbsG = fibrousG + starchyG;
  const calories = base.protein.g * 4 + carbsG * 4 + base.fat.g * 9;

  return {
    ...base,
    calories,
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

function finalSafetyPass(base: any, { strictMode }: { strictMode: boolean }) {
  if (strictMode) return base;

  let starchyG = base.carbs.starchy as number;
  const fibrousG = base.carbs.fibrous as number;
  const proteinG = base.protein.g as number;
  const fatG = base.fat.g as number;

  let carbsG = starchyG + fibrousG;
  let calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  if (calories < 1200) {
    if (starchyG > 0) {
      starchyG += Math.ceil((1200 - calories) / 4);
      carbsG = starchyG + fibrousG;
      calories = proteinG * 4 + carbsG * 4 + fatG * 9;
    } else {
      return { ...base, safetyFloorUnmet: true, safetyFloorReason: "starchy_at_zero" };
    }
  } else if (calories > 4000) {
    starchyG = Math.max(0, starchyG - Math.ceil((calories - 4000) / 4));
    carbsG = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  }

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

/**
 * Full macro compute pipeline — entry point for the API route.
 * Runs: base → input adjustments → strategy layer → body-type tilt → safety pass
 */
export function computeMacros(input: MacroComputeInput): MacroComputeOutput {
  const {
    sex, kg, cm, age, activity, goal, userType, bodyType,
    highWaistRisk, menopause, insulinResistance, highStress,
    mealsPerDay, fibrousCarbSafetyCap_g,
    cutIntensity, cutStyle, starchyCarbCap_g, allowZeroStarchyOnLowDay, strictMode,
  } = input;

  const lb = Math.round(kg * 2.20462);
  const bmr = mifflin({ sex, kg, cm, age });
  const tdee = Math.round(bmr * (ACTIVITY_FACTORS[activity] ?? ACTIVITY_FACTORS.moderate));

  const base = calcMacrosBase({ lb, goal, userType });

  const adjResult = applyInputAdjustments(base, {
    age,
    activity: activity || "moderate",
    highWaistRisk,
    menopause,
    insulinResistance,
    highStress,
    mealsPerDay,
    fibrousCarbSafetyCap_g,
  });

  const stratResult = applyStrategyLayer(adjResult, {
    lb, mealsPerDay, cutIntensity, cutStyle,
    starchyCarbCap_g, allowZeroStarchyOnLowDay, fibrousCarbSafetyCap_g, strictMode,
  });

  const tiltResult = applyBodyTypeTilt(stratResult, bodyType, activity);
  const macros = finalSafetyPass(tiltResult, { strictMode });

  return {
    bmr,
    tdee,
    target: macros.calories,
    macros: macros as MacroResult,
  };
}
