import { eq, desc, and, gte } from "drizzle-orm";
import { diabetesProfile, glucoseLogs } from "../../shared/schema";
import { db } from "../db";

export type MealConstraints = {
  lowGiOnly: boolean;
  fiberMinPerDay: number;
  carbCaps: { breakfast: [number, number]; lunch: [number, number]; dinner: [number, number]; snack: [number, number] };
  proteinGPerKg?: { min: number; max: number; reason?: string };
  fats?: { prefer: string[]; limitSfa: boolean };
  adjustments: { trigger: string; delta: string }[];
  flags: string[]; // e.g., ["PRE_MEAL_HIGH", "POSTMEAL_SPIKES"]
};

export async function deriveConstraints(userId: string): Promise<MealConstraints> {
  // 1) Base defaults (diabetes OFF)
  let constraints: MealConstraints = {
    lowGiOnly: false,
    fiberMinPerDay: 25,
    carbCaps: { breakfast: [30, 55], lunch: [40, 70], dinner: [40, 70], snack: [10, 25] },
    adjustments: [],
    flags: [],
  };

  const profile = await db.query.diabetesProfile.findFirst({ where: (p, { eq }) => eq(p.userId, userId) });
  if (!profile || profile.type === "NONE") return constraints;

  // 2) Diabetes baseline
  constraints.lowGiOnly = true;
  constraints.fiberMinPerDay = 30;
  constraints.carbCaps = { breakfast: [25, 30], lunch: [30, 40], dinner: [30, 40], snack: [10, 15] };

  // 3) A1C nudges
  const a1c = Number(profile.a1cPercent ?? 0);
  if (a1c >= 6.5) {
    constraints.flags.push("A1C_HIGH");
  }

  // 4) Recent glucose patterns (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await db.select().from(glucoseLogs).where(and(eq(glucoseLogs.userId, userId), gte(glucoseLogs.recordedAt, sevenDaysAgo))).orderBy(desc(glucoseLogs.recordedAt));

  const postMeals = logs.filter(l => l.context === "POST_MEAL_1H" || l.context === "POST_MEAL_2H");
  const spikes = postMeals.filter(l => l.valueMgdl > 180).length;
  const mealsLogged = postMeals.length || 1;
  const spikeRate = spikes / mealsLogged;
  if (spikeRate >= 0.3) {
    constraints.adjustments.push({ trigger: "postmeal_spike", delta: "carb_-15g_next_time" });
    constraints.flags.push("POSTMEAL_SPIKES");
  }

  // 5) Pre-meal high indicator for UI swaps
  const lastPre = logs.find(l => l.context === "PRE_MEAL");
  if (lastPre && lastPre.valueMgdl > 150) {
    constraints.flags.push("PRE_MEAL_HIGH");
  }

  // Placeholder: kidney/lipids/thyroid when labs added
  constraints.fats = { prefer: ["olive_oil", "avocado", "nuts", "salmon"], limitSfa: true };

  return constraints;
}