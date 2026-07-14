import { pgTable, uuid, text, timestamp, integer, boolean, unique, jsonb } from "drizzle-orm/pg-core";

// NOTE: user_certifications has a unique constraint on (user_id, certification_type)
// added via migration (not drizzle-kit push — that tool times out on this project).
// Constraint name: uniq_user_cert_type
export const certificationModuleProgress = pgTable("certification_module_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  certificationType: text("certification_type").notNull(),
  moduleId: text("module_id").notNull(),
  status: text("status").notNull().default("not_started"),
  score: integer("score"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  videoWatchedPct: integer("video_watched_pct").default(0),
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
  certificateName: text("certificate_name"),
  isCurrentVersion: boolean("is_current_version").default(true),
  updatesPending: integer("updates_pending").default(0),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  isCertificationTrack: boolean("is_certification_track").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqUserCertType: unique("uniq_user_cert_type").on(t.userId, t.certificationType),
}));

export const certificationQuizAttempts = pgTable("certification_quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  certificationType: text("certification_type").notNull(),
  moduleId: text("module_id").notNull(),
  status: text("status").notNull().default("in_progress"),
  answersJson: jsonb("answers_json").$type<Record<string, number>>().default({}),
  score: integer("score"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  uniqUserCertModuleAttempt: unique("uniq_user_cert_module_attempt").on(t.userId, t.certificationType, t.moduleId),
}));

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
