import { pgTable, uuid, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const userSmsSettings = pgTable("user_sms_settings", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
  phoneE164: varchar("phone_e164", { length: 20 }).notNull(),  // +1XXXXXXXXXX
  timezone: varchar("timezone", { length: 64 }).notNull().default("America/Chicago"),
  consent: boolean("consent").notNull().default(false),         // explicit opt-in
  quietStart: varchar("quiet_start", { length: 8 }).notNull().default("21:00"), // 24h HH:mm
  quietEnd: varchar("quiet_end", { length: 8 }).notNull().default("07:00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mealReminder = pgTable("meal_reminder", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  weekStart: varchar("week_start", { length: 10 }).notNull(), // YYYY-MM-DD (Monday)
  mealDateTimeZ: varchar("meal_dt_z", { length: 25 }).notNull(), // ISO with tz
  localTime: varchar("local_time", { length: 16 }).notNull(),     // 2025-08-10T12:30
  title: varchar("title", { length: 120 }).notNull(),             // e.g., Lunch
  summary: varchar("summary", { length: 240 }).notNull(),         // "Turkey bowl • 520 kcal"
  jobId: varchar("job_id", { length: 64 }),                       // queue id
  sent: boolean("sent").notNull().default(false),
  cancelled: boolean("cancelled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const smsLog = pgTable("sms_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  toE164: varchar("to_e164", { length: 20 }).notNull(),
  body: varchar("body", { length: 512 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),            // queued/sent/delivered/failed
  providerSid: varchar("provider_sid", { length: 48 }),
  meta: jsonb("meta").$type<any>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});