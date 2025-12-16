import {
  pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, primaryKey
} from "drizzle-orm/pg-core";

// === QUESTIONS ===
export const triviaQuestions = pgTable("trivia_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 50 }).notNull(),               // Nutrition | Fitness | Mental Wellness | Healthy Habits | Mindfulness | Habits | Focus | Resilience
  mindsetCategory: varchar("mindset_category", { length: 50 }).notNull().default("General"),
  psychProfileTags: jsonb("psych_profile_tags").$type<string[]>().notNull().default([]),
  question: varchar("question", { length: 1024 }).notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  answerIndex: integer("answer_index").notNull(), // server-only
  difficulty: integer("difficulty").notNull().default(1),                // 1-3
  explanation: varchar("explanation", { length: 1024 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === ROUNDS ===
export const triviaRounds = pgTable("trivia_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
  roundSize: integer("round_size").notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),          // HMAC
  timeLimitSec: integer("time_limit_sec").notNull().default(60),
  score: integer("score").notNull().default(0),
  mistakes: integer("mistakes").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
});

export const triviaRoundItems = pgTable("trivia_round_items", {
  roundId: uuid("round_id").notNull(),
  qid: uuid("qid").notNull(),
  order: integer("order").notNull(),
  pickedIndex: integer("picked_index"),
  correct: boolean("correct"),
  answeredAt: timestamp("answered_at"),
}, (t) => ({
  pk: primaryKey({ columns: [t.roundId, t.order] }),
}));

// === USER STATS ===
export const userTriviaStats = pgTable("user_trivia_stats", {
  userId: uuid("user_id").primaryKey(),
  xp: integer("xp").notNull().default(0),
  mindsetXp: integer("mindset_xp").notNull().default(0),                 // NEW: growth XP
  totalScore: integer("total_score").notNull().default(0),
  roundsPlayed: integer("rounds_played").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at"),
});

// === BADGES ===
export const badges = pgTable("badges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  icon: varchar("icon", { length: 60 }).notNull(),
  criteria: jsonb("criteria").$type<{ type: "streak"|"score"|"xp"|"mindsetXp"|"rounds"; value:number }>().notNull(),
});
export const userBadges = pgTable("user_badges", {
  userId: uuid("user_id").notNull(),
  badgeId: varchar("badge_id", { length: 64 }).notNull(),
  awardedAt: timestamp("awarded_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.badgeId] })
}));

// === WEEKLY LEADERBOARD ===
export const weeklyLeaderboard = pgTable("weekly_leaderboard", {
  weekStart: timestamp("week_start").notNull(),
  userId: uuid("user_id").notNull(),
  score: integer("score").notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.weekStart, t.userId] })
}));