import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Audit Log — Phase 3 HIPAA Compliance
 *
 * Immutable append-only record of every PHI read/write/auth event.
 * Retention: 6 years minimum (HIPAA § 164.530(j)).
 *
 * Rules:
 *   - Never store the VALUE of a T1 field — only log which field changed and who changed it.
 *   - Never store email, name, auth tokens, or note body content in this table.
 *   - metadata MUST NOT contain raw PHI values — use resource_id + table + field_name instead.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id"),
  actorUserId: varchar("actor_user_id", { length: 64 }),
  targetUserId: varchar("target_user_id", { length: 64 }),
  action: varchar("action", { length: 64 }).notNull(),
  resourceType: varchar("resource_type", { length: 64 }),
  resourceId: text("resource_id"),
  tableName: varchar("table_name", { length: 64 }),
  fieldName: varchar("field_name", { length: 256 }),
  route: text("route"),
  ipAddress: varchar("ip_address", { length: 64 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  actorIdx: index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
  targetIdx: index("audit_log_target_idx").on(t.targetUserId, t.createdAt),
  orgIdx: index("audit_log_org_idx").on(t.orgId, t.createdAt),
  actionIdx: index("audit_log_action_idx").on(t.action, t.createdAt),
}));

export type AuditLogRow = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
