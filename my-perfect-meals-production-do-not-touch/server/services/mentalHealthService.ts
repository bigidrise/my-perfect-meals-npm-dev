// --- NEW: server/services/mentalHealthService.ts ---
import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "../db";
import { users, journalEntries, emotionalCheckins } from "@shared/schema";
import { DateTime } from "luxon";

export interface MoodTrend {
  avgMoodScore: number;
  trendDirection: "up" | "down" | "stable";
  periodDays: number;
}

export interface JournalSummary {
  totalEntries: number;
  avgMoodScore: number;
  mostCommonMood: string;
  streakDays: number;
}

export async function getMoodTrend(userId: string, periodDays: number = 7): Promise<MoodTrend> {
  const startDate = DateTime.now().minus({ days: periodDays }).toJSDate();
  
  const checkins = await db.select()
    .from(emotionalCheckins)
    .where(and(
      eq(emotionalCheckins.userId, userId),
      gte(emotionalCheckins.createdAt, startDate)
    ))
    .orderBy(desc(emotionalCheckins.createdAt));

  if (checkins.length === 0) {
    return {
      avgMoodScore: 0,
      trendDirection: "stable",
      periodDays
    };
  }

  const avgMoodScore = checkins.reduce((sum, c) => sum + c.moodScore, 0) / checkins.length;
  
  // Simple trend: compare first half vs second half
  const midpoint = Math.floor(checkins.length / 2);
  const recentAvg = checkins.slice(0, midpoint).reduce((sum, c) => sum + c.moodScore, 0) / midpoint || 0;
  const olderAvg = checkins.slice(midpoint).reduce((sum, c) => sum + c.moodScore, 0) / (checkins.length - midpoint) || 0;
  
  let trendDirection: "up" | "down" | "stable" = "stable";
  if (recentAvg > olderAvg + 0.5) trendDirection = "up";
  else if (recentAvg < olderAvg - 0.5) trendDirection = "down";

  return {
    avgMoodScore: Math.round(avgMoodScore * 10) / 10,
    trendDirection,
    periodDays
  };
}

export async function getJournalSummary(userId: string, periodDays: number = 30): Promise<JournalSummary> {
  const startDate = DateTime.now().minus({ days: periodDays }).toJSDate();
  
  const checkins = await db.select()
    .from(emotionalCheckins)
    .where(and(
      eq(emotionalCheckins.userId, userId),
      gte(emotionalCheckins.createdAt, startDate)
    ))
    .orderBy(desc(emotionalCheckins.createdAt));

  const totalEntries = checkins.length;
  const avgMoodScore = totalEntries > 0 ? 
    checkins.reduce((sum, c) => sum + c.moodScore, 0) / totalEntries : 0;

  // Find most common mood
  const moodCounts: Record<string, number> = {};
  checkins.forEach(c => {
    moodCounts[c.moodLabel] = (moodCounts[c.moodLabel] || 0) + 1;
  });
  const mostCommonMood = Object.keys(moodCounts).reduce((a, b) => 
    moodCounts[a] > moodCounts[b] ? a : b, "neutral");

  // Calculate streak (consecutive days with entries)
  let streakDays = 0;
  const today = DateTime.now().startOf("day");
  for (let i = 0; i < periodDays; i++) {
    const checkDay = today.minus({ days: i });
    const hasEntry = checkins.some(c => 
      DateTime.fromJSDate(c.createdAt!).hasSame(checkDay, "day"));
    if (hasEntry) {
      streakDays++;
    } else if (i > 0) { // Allow missing today, but break on first gap after
      break;
    }
  }

  return {
    totalEntries,
    avgMoodScore: Math.round(avgMoodScore * 10) / 10,
    mostCommonMood,
    streakDays
  };
}

export async function generateMoodInsight(userId: string): Promise<string> {
  const trend = await getMoodTrend(userId, 14);
  const summary = await getJournalSummary(userId, 30);
  
  if (summary.totalEntries === 0) {
    return "Start tracking your mood to gain insights into your emotional patterns!";
  }

  let insight = `Over the past month, you've logged ${summary.totalEntries} entries with an average mood of ${summary.avgMoodScore}/10. `;
  
  if (trend.trendDirection === "up") {
    insight += "Great news! Your mood has been trending upward lately. ";
  } else if (trend.trendDirection === "down") {
    insight += "It looks like you've been having some challenging days recently. ";
  } else {
    insight += "Your mood has been relatively stable. ";
  }

  if (summary.streakDays > 1) {
    insight += `You're on a ${summary.streakDays}-day tracking streak - keep it up!`;
  } else {
    insight += "Try to check in daily to build helpful patterns.";
  }

  return insight;
}