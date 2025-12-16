import { pgTable, uuid, varchar, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const userDailyChallenges = pgTable("user_daily_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD (local)
  title: varchar("title", { length: 140 }).notNull(),
  instructions: varchar("instructions", { length: 1024 }).notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  remindedAt: timestamp("reminded_at"),
});