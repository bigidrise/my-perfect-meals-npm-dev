import { eq } from "drizzle-orm";
import { db } from "../db";
import { weeklyPlans, users } from "../../shared/schema";

export async function getWeeklyPlan(userId: string) {
  const [row] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.userId, userId));
  return row ? { 
    plan: row.planJson, 
    params: row.lastParams, 
    updatedAt: row.updatedAt,
    planStartDate: row.planStartDate,
    planEndDate: row.planEndDate
  } : null;
}

export async function upsertWeeklyPlan(userId: string, planJson: any, lastParams: any, planStartDate?: Date, planEndDate?: Date) {
  const startDate = planStartDate || new Date();
  const endDate = planEndDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from start
  
  await db.insert(weeklyPlans).values({ 
    userId, 
    planJson, 
    lastParams, 
    planStartDate: startDate, 
    planEndDate: endDate 
  })
    .onConflictDoUpdate({ 
      target: weeklyPlans.userId, 
      set: { 
        planJson, 
        lastParams, 
        planStartDate: startDate, 
        planEndDate: endDate, 
        updatedAt: new Date() 
      } 
    });
}

export async function deleteWeeklyPlan(userId: string) {
  await db.delete(weeklyPlans).where(eq(weeklyPlans.userId, userId));
}

// Check if current plan has expired and needs regeneration
export async function checkPlanExpiry(userId: string) {
  const plan = await getWeeklyPlan(userId);
  if (!plan) return { expired: true, hasAutogen: true }; // no plan = expired, default autogen

  const now = new Date();
  const expired = now > new Date(plan.planEndDate);
  
  // Get user's auto-generation setting
  const [user] = await db
    .select({ autoGenerateWeeklyPlan: users.autoGenerateWeeklyPlan })
    .from(users)
    .where(eq(users.id, userId));

  const hasAutogen = user?.autoGenerateWeeklyPlan ?? true;
  
  return { expired, hasAutogen, plan };
}

// Generate immediate plan for new user (called after onboarding)
export async function generateImmediatePlan(userId: string, onboardingData: any) {
  // This will be called by the onboarding completion process
  const now = new Date();
  const startDate = now;
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  const defaultParams = {
    mealStructure: { 
      breakfasts: 1, 
      lunches: 1, 
      dinners: 1, 
      snacks: 0,
      days: 7
    },
    generateImages: true,
    allowDuplicates: false,
    tempDietPreference: onboardingData?.dietaryPreference,
    tempMedicalOverride: onboardingData?.medicalRestrictions
  };

  // Generate plan using meal engine (will be implemented)
  // For now, return structure so we can implement the flow
  return {
    startDate,
    endDate,
    params: defaultParams
  };
}