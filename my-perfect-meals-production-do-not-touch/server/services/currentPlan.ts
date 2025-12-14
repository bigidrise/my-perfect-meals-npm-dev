import { getWeeklyPlan, upsertWeeklyPlan } from "../db/repo.weeklyPlan";

export async function getCurrentPlan(userId: string) {
  const planData = await getWeeklyPlan(userId);
  if (!planData) return null;
  
  return {
    plan: planData.plan,
    meta: planData.params,
    updatedAt: planData.updatedAt,
    planStartDate: planData.planStartDate,
    planEndDate: planData.planEndDate
  };
}

export async function setCurrentPlan(userId: string, plan: any, meta: any) {
  await upsertWeeklyPlan(userId, plan, meta);
}