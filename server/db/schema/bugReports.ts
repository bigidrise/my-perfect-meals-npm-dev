import { pgTable, text, uuid, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const bugReportStatusEnum = pgEnum("bug_report_status", ["new", "reviewing", "resolved"]);

export const bugReports = pgTable("bug_reports", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  userId:             text("user_id"),              // null if somehow unauthenticated (route blocks this, belt-and-suspenders)
  userEmail:          text("user_email"),
  userName:           text("user_name"),
  description:        text("description").notNull(), // "What happened?"
  intent:             text("intent"),                // "What were you trying to do?" (optional)
  route:              text("route"),                 // window.location.pathname at submission
  buildVersion:       text("build_version"),         // from buildVersion.ts
  environment:        text("environment"),           // 'production' | 'development'
  userAgent:          text("user_agent"),
  includeDiagnostics: boolean("include_diagnostics").notNull().default(true),
  diagnostics:        jsonb("diagnostics"),          // { errors: DiagnosticError[], failedRequests: DiagnosticRequest[] }
  status:             bugReportStatusEnum("status").notNull().default("new"),
  createdAt:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BugReport     = typeof bugReports.$inferSelect;
export type NewBugReport  = typeof bugReports.$inferInsert;
