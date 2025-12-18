import { db } from "../db";
import { badges } from "../db/schema/trivia";

export async function seedBadges() {
  const badgeData = [
    {
      id: "first_perfect",
      name: "Perfect Round",
      description: "Got every question right in a round",
      icon: "🎯",
      criteria: { type: "streak" as const, value: 7 }
    },
    {
      id: "streak_master",
      name: "Streak Master",
      description: "Answered 10 questions correctly in a row",
      icon: "🔥",
      criteria: { type: "streak" as const, value: 10 }
    },
    {
      id: "knowledge_seeker",
      name: "Knowledge Seeker",
      description: "Earned 500 XP",
      icon: "📚",
      criteria: { type: "xp" as const, value: 500 }
    },
    {
      id: "mindset_master",
      name: "Mindset Master",
      description: "Earned 100 Mindset XP from growth questions",
      icon: "🧠",
      criteria: { type: "mindsetXp" as const, value: 100 }
    },
    {
      id: "dedicated_player",
      name: "Dedicated Player",
      description: "Played 25 rounds",
      icon: "⭐",
      criteria: { type: "rounds" as const, value: 25 }
    },
    {
      id: "high_scorer",
      name: "High Scorer",
      description: "Scored 800+ points in a single round",
      icon: "🏆",
      criteria: { type: "score" as const, value: 800 }
    },
    {
      id: "nutrition_guru",
      name: "Nutrition Guru",
      description: "Master of nutrition knowledge",
      icon: "🥗",
      criteria: { type: "xp" as const, value: 1000 }
    }
  ];

  for (const badge of badgeData) {
    await db.insert(badges).values(badge).onConflictDoNothing();
  }
  
  console.log(`[badge-service] Seeded ${badgeData.length} badges`);
}