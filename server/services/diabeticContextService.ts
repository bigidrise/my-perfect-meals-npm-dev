import { db } from "../db";
import { glucoseLogs, diabetesProfile, Guardrails, DEFAULT_GUARDRAILS } from "../../shared/diabetes-schema";
import { eq, desc } from "drizzle-orm";

export type GlucoseState = 
  | "low"           // <70 mg/dL - hypoglycemia risk
  | "low-normal"    // 70-80 mg/dL - lower end of normal
  | "in-range"      // 80-120 mg/dL - optimal fasting range
  | "elevated"      // 121-180 mg/dL - above target
  | "high-risk";    // >180 mg/dL - hyperglycemia risk

export interface DiabeticContext {
  hasDiabetes: boolean;
  diabetesType: "NONE" | "T1D" | "T2D";
  latestGlucose: {
    value: number;
    context: string;
    state: GlucoseState;
    recordedAt: Date;
    ageMinutes: number;
  } | null;
  hypoHistory: boolean;
}

export interface DiabeticGuardrails {
  fastingMin: number;
  fastingMax: number;
  postMealMax: number;
  carbLimit: number;
  fiberMin: number;
  giCap: number;
  mealFrequency: number;
}

export function classifyGlucose(valueMgdl: number, context: string): GlucoseState {
  if (valueMgdl < 70) return "low";
  if (valueMgdl <= 80) return "low-normal";
  
  if (context === "FASTED" || context === "PRE_MEAL") {
    if (valueMgdl <= 120) return "in-range";
    if (valueMgdl <= 180) return "elevated";
    return "high-risk";
  }
  
  if (context === "POST_MEAL_1H" || context === "POST_MEAL_2H") {
    if (valueMgdl <= 140) return "in-range";
    if (valueMgdl <= 180) return "elevated";
    return "high-risk";
  }
  
  if (valueMgdl <= 140) return "in-range";
  if (valueMgdl <= 180) return "elevated";
  return "high-risk";
}

export async function getDiabeticContext(userId: string): Promise<DiabeticContext> {
  const profile = await db.query.diabetesProfile.findFirst({
    where: (p, { eq }) => eq(p.userId, userId)
  });

  const [latestLog] = await db.select()
    .from(glucoseLogs)
    .where(eq(glucoseLogs.userId, userId))
    .orderBy(desc(glucoseLogs.recordedAt))
    .limit(1);

  let latestGlucose: DiabeticContext["latestGlucose"] = null;
  
  if (latestLog) {
    const recordedAt = new Date(latestLog.recordedAt);
    const now = new Date();
    const ageMinutes = Math.floor((now.getTime() - recordedAt.getTime()) / (1000 * 60));
    
    latestGlucose = {
      value: latestLog.valueMgdl,
      context: latestLog.context,
      state: classifyGlucose(latestLog.valueMgdl, latestLog.context),
      recordedAt,
      ageMinutes
    };
  }

  return {
    hasDiabetes: profile?.type !== "NONE" && profile?.type !== undefined,
    diabetesType: (profile?.type as "NONE" | "T1D" | "T2D") || "NONE",
    latestGlucose,
    hypoHistory: profile?.hypoHistory || false
  };
}

export async function getDiabeticGuardrails(userId: string): Promise<DiabeticGuardrails> {
  const profile = await db.query.diabetesProfile.findFirst({
    where: (p, { eq }) => eq(p.userId, userId)
  });

  const guardrails = profile?.guardrails as Guardrails | null;
  
  return {
    fastingMin: guardrails?.fastingMin ?? DEFAULT_GUARDRAILS.fastingMin!,
    fastingMax: guardrails?.fastingMax ?? DEFAULT_GUARDRAILS.fastingMax!,
    postMealMax: guardrails?.postMealMax ?? DEFAULT_GUARDRAILS.postMealMax!,
    carbLimit: guardrails?.carbLimit ?? DEFAULT_GUARDRAILS.carbLimit!,
    fiberMin: guardrails?.fiberMin ?? DEFAULT_GUARDRAILS.fiberMin!,
    giCap: guardrails?.giCap ?? DEFAULT_GUARDRAILS.giCap!,
    mealFrequency: guardrails?.mealFrequency ?? DEFAULT_GUARDRAILS.mealFrequency!
  };
}

export function getGlucoseBasedMealGuidance(context: DiabeticContext): string {
  if (!context.latestGlucose) {
    return "No recent glucose data available. Generate a balanced diabetic-friendly meal with moderate carbohydrates.";
  }

  const { value, state, ageMinutes, context: readingContext } = context.latestGlucose;
  const staleData = ageMinutes > 240;
  
  if (staleData) {
    return `Last glucose reading (${value} mg/dL) is over 4 hours old. Generate a balanced diabetic-friendly meal with moderate carbohydrates.`;
  }

  switch (state) {
    case "low":
      return `Current glucose is ${value} mg/dL (LOW). ${context.hypoHistory ? "User has history of hypoglycemia. " : ""}Generate a meal with adequate carbohydrates (30-45g) to help stabilize blood sugar while avoiding rapid spikes.`;
    
    case "low-normal":
      return `Current glucose is ${value} mg/dL (lower-normal range). Generate a balanced meal with 25-35g carbohydrates to maintain stable levels.`;
    
    case "in-range":
      return `Current glucose is ${value} mg/dL (in optimal range). Generate a balanced diabetic-friendly meal that maintains this good control, keeping carbs moderate (20-35g).`;
    
    case "elevated":
      return `Current glucose is ${value} mg/dL (elevated above target). Generate a lower-carb meal (15-25g carbs max) with emphasis on protein and fiber to help bring levels down.`;
    
    case "high-risk":
      return `Current glucose is ${value} mg/dL (high - needs attention). Generate a very low-carb meal (under 15g carbs) with high protein and fiber. Prioritize non-starchy vegetables.`;
    
    default:
      return "Generate a balanced diabetic-friendly meal with moderate carbohydrates.";
  }
}
