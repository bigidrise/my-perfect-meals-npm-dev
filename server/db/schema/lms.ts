import { pgTable, uuid, text, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";

export const certModules = pgTable("cert_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  certType: text("cert_type").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  moduleType: text("module_type").notNull().default("quiz"),
  videoUrl: text("video_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  passingScorePct: integer("passing_score_pct").default(80),
  questionLimit: integer("question_limit").default(5),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqCertSlug: unique().on(t.certType, t.slug),
}));

export const certQuestions = pgTable("cert_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  certType: text("cert_type").notNull(),
  moduleSlug: text("module_slug").notNull(),
  questionText: text("question_text").notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const certQuestionOptions = pgTable("cert_question_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id").notNull(),
  optionText: text("option_text").notNull(),
  isCorrect: boolean("is_correct").default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const lmsUpdateModules = pgTable("lms_update_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  targetRoles: text("target_roles").array(),
  isRequired: boolean("is_required").default(false),
  relatedCertType: text("related_cert_type"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userLmsUpdates = pgTable("user_lms_updates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  updateModuleId: uuid("update_module_id").notNull(),
  videoWatched: boolean("video_watched").default(false),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqUserUpdate: unique().on(t.userId, t.updateModuleId),
}));
