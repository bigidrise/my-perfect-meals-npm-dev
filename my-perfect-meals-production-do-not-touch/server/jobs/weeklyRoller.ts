import { db } from "../db";
import { users, weeklyPlans } from "../../shared/schema";
import { sql } from "drizzle-orm";

interface UserWithAutoGen {
  id: string;
  autoGenerateWeeklyPlan: boolean;
}

async function getUsersWithAutoGen(): Promise<UserWithAutoGen[]> {
  const result = await db.select({
    id: users.id,
    autoGenerateWeeklyPlan: users.autoGenerateWeeklyPlan
  }).from(users).where(sql`${users.autoGenerateWeeklyPlan} = true`);
  
  return result;
}

async function getWeeklyPlan(userId: string) {
  const result = await db.select().from(weeklyPlans).where(sql`${weeklyPlans.userId} = ${userId}`).limit(1);
  return result[0] || null;
}

async function archiveCurrentList(userId: string, startDate: string, endDate: string) {
  // This would call the existing shopping list archive endpoint
  try {
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/shopping-list/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, periodStart: startDate, periodEnd: endDate })
    });
    
    if (!response.ok) {
      console.error(`Failed to archive shopping list for user ${userId}`);
    }
  } catch (error) {
    console.error(`Error archiving shopping list for user ${userId}:`, error);
  }
}

export async function runWeeklyRoller() {
  try {
    const users = await getUsersWithAutoGen();
    const today = new Date();

    console.log(`Running weekly roller for ${users.length} users with auto-generate enabled`);

    for (const u of users) {
      const cur = await getWeeklyPlan(u.id);
      if (!cur) continue;
      
      const end = new Date(cur.planEndDate);
      if (today > end) {
        console.log(`Plan expired for user ${u.id}, starting auto-generation`);
        
        // 1) Archive last week's list
        await archiveCurrentList(u.id, cur.planStartDate, cur.planEndDate);

        // 2) Generate next 7 days would be handled by the meal engine service
        // For now, we'll just log that this would happen
        console.log(`Would generate new 7-day plan for user ${u.id}`);

        // 3) The actual plan generation would be implemented here using the meal engine
        // This is a placeholder for the full implementation
      }
    }
  } catch (error) {
    console.error("Error in weekly roller:", error);
  }
}

export default runWeeklyRoller;