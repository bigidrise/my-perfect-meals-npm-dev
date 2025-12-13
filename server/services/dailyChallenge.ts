import { db } from "../db";
import { userDailyChallenges } from "../db/schema/mindset";
import { formatLocalDateKey } from "../util/time";
import { eq, and } from "drizzle-orm";

type MissSummary = {
  categories: Record<string, number>;    // e.g., { Nutrition: 2, Focus: 1 }
  psychTagsMissed: Record<string, number>; // e.g., { low_consistency: 2 }
};

const TEMPLATES: Array<{
  match: (m: MissSummary, tags: string[]) => boolean;
  build: (m: MissSummary, tags: string[]) => { title: string; instructions: string; tags: string[] };
}> = [
  {
    match: (m, tags) => (m.psychTagsMissed["low_consistency"] || 0) > 0 || tags.includes("needs_habit_help"),
    build: () => ({
      title: "Habit Stack One Tiny Action",
      instructions: "After your morning coffee, do a 60-second task (e.g., 10 bodyweight squats or filling your water bottle). Do it today—no excuses. Log it in the app.",
      tags: ["habits","consistency","stacking"]
    })
  },
  {
    match: (m, tags) => (m.categories["Mindfulness"] || 0) > 0 || tags.includes("stress_mgmt"),
    build: () => ({
      title: "Box Breathing x4",
      instructions: "Four cycles of box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. Do it now or before your next meal.",
      tags: ["mindfulness","stress"]
    })
  },
  {
    match: (m, tags) => (m.categories["Nutrition"] || 0) > 0,
    build: () => ({
      title: "Protein Anchor",
      instructions: "Add a palm-size protein to your very next meal (chicken, fish, eggs, Greek yogurt, tofu). Take 10 seconds to plan it right now.",
      tags: ["nutrition","protein"]
    })
  },
  {
    match: (m, tags) => (m.categories["Focus"] || 0) > 0 || tags.includes("focus_training"),
    build: () => ({
      title: "Batch Distractions",
      instructions: "Silence notifications for 25 minutes. Put your phone face down. Park all pings into a 5-minute break after the 25.",
      tags: ["focus","deep_work"]
    })
  },
  {
    match: (m, tags) => (m.categories["Fitness"] || 0) > 0,
    build: () => ({
      title: "2-Minute Movement",
      instructions: "Set a timer for 2 minutes and move: brisk walk, stairs, or 20 slow squats. Done > perfect.",
      tags: ["fitness","movement"]
    })
  }
];

export async function upsertDailyChallenge({
  userId,
  localIsoDate,
  missSummary,
  userPsychTags
}: {
  userId: string;
  localIsoDate: string;        // e.g., "2025-08-10"
  missSummary: MissSummary;
  userPsychTags: string[];
}) {
  const dateKey = formatLocalDateKey(localIsoDate);
  // If today already has a challenge, return it (idempotent)
  const existing = await db.select().from(userDailyChallenges)
    .where(and(eq(userDailyChallenges.userId, userId), eq(userDailyChallenges.dateKey, dateKey)));
  if (existing.length > 0) return existing[0];

  // Pick first matching template; else default
  const tpl = TEMPLATES.find(t => t.match(missSummary, userPsychTags))
    ?? { build: () => ({
      title: "One Glass Now",
      instructions: "Drink a full glass of water now. Then set a reminder to repeat before each meal today.",
      tags: ["hydration","baseline"]
    }) };

  const { title, instructions, tags } = tpl.build(missSummary, userPsychTags);

  const row = await db.insert(userDailyChallenges).values({
    userId, dateKey, title, instructions, tags
  }).returning();
  return row[0];
}

export function summarizeMisses(items: Array<{ category: string; psychTags: string[]; correct: boolean }>): MissSummary {
  const categories: Record<string, number> = {};
  const psychTagsMissed: Record<string, number> = {};
  for (const it of items) {
    if (!it.correct) {
      categories[it.category] = (categories[it.category] || 0) + 1;
      for (const t of it.psychTags || []) {
        psychTagsMissed[t] = (psychTagsMissed[t] || 0) + 1;
      }
    }
  }
  return { categories, psychTagsMissed };
}