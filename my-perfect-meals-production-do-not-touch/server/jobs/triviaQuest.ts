import cron from "node-cron";
import { db } from "../db";
import { weeklyLeaderboard, userTriviaStats } from "../db/schema/trivia";
import { users } from "../../shared/schema";
import { getWeekStart } from "../util/date";
import { eq, desc, and } from "drizzle-orm";

// Weekly leaderboard reset and rewards (Sundays at midnight UTC)
cron.schedule("0 0 * * SUN", async () => {
  console.log("[trivia-quest] Weekly leaderboard reset starting...");
  
  const weekStart = getWeekStart(new Date());
  
  // Get top 10 players from last week
  const topPlayers = await db.select()
    .from(weeklyLeaderboard)
    .where(eq(weeklyLeaderboard.weekStart, weekStart))
    .orderBy(desc(weeklyLeaderboard.score))
    .limit(10);
    
  // Award XP bonuses
  for (let i = 0; i < topPlayers.length; i++) {
    const player = topPlayers[i];
    const bonus = i === 0 ? 200 : i < 3 ? 100 : 50; // 1st: 200, 2nd-3rd: 100, 4th-10th: 50
    
    const currentStats = await db.select().from(userTriviaStats).where(eq(userTriviaStats.userId, player.userId));
    const currentXp = currentStats[0]?.xp || 0;
    await db.update(userTriviaStats)
      .set({ xp: currentXp + bonus })
      .where(eq(userTriviaStats.userId, player.userId));
  }
  
  console.log(`[trivia-quest] Awarded bonuses to ${topPlayers.length} top players`);
});

console.log("[trivia-quest] Weekly cron job scheduled");