import { pgTable, uuid, varchar, boolean, integer, timestamp, text } from "drizzle-orm/pg-core";

export const userReminderSlots = pgTable("user_reminder_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  label: text("label").notNull().default("Meal"),
  time: varchar("time", { length: 5 }).notNull().default("12:00"),
  enabled: boolean("enabled").notNull().default(true),
  type: text("type").notNull().default("meal"),
  sortOrder: integer("sort_order").notNull().default(0),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
