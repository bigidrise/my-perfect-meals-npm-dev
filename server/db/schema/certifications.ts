import { pgTable, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";

export const certificationModuleProgress = pgTable("certification_module_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  certificationType: text("certification_type").notNull(),
  moduleId: text("module_id").notNull(),
  status: text("status").notNull().default("not_started"),
  score: integer("score"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqUserCertModule: unique().on(t.userId, t.certificationType, t.moduleId),
}));

export const userCertifications = pgTable("user_certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  certificationType: text("certification_type").notNull(),
  status: text("status").notNull().default("not_started"),
  score: integer("score"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  certificateNumber: text("certificate_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const businessLeads = pgTable("business_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  opportunityType: text("opportunity_type").notNull(),
  message: text("message"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
