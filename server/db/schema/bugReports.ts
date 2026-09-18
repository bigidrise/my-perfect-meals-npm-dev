import { pgTable, text, uuid, boolean, timestamp, jsonb, pgEnum, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

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

export const bugReportAcknowledgements = pgTable("bug_report_acknowledgements", {
  id: uuid("id").primaryKey().defaultRandom(),
  bugReportId: uuid("bug_report_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  firstName: text("first_name"),
  shortReportId: text("short_report_id").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  claimToken: uuid("claim_token"),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  reportUnique: uniqueIndex("bug_report_acknowledgements_report_uniq").on(t.bugReportId),
  dueIndex: index("bug_report_acknowledgements_due_idx").on(t.status, t.availableAt),
}));

export type BugReportAcknowledgement = typeof bugReportAcknowledgements.$inferSelect;
export type NewBugReportAcknowledgement = typeof bugReportAcknowledgements.$inferInsert;
