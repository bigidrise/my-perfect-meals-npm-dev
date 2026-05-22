/**
 * Audit Log Helper — Phase 3 HIPAA Compliance
 *
 * Fire-and-forget. NEVER throws. NEVER blocks a request.
 * If the DB write fails, the error goes to stderr only — the request is never affected.
 *
 * Rules (from docs/phi-boundary.md):
 *   - Log that a field changed, not its value.
 *   - meta MUST NOT contain raw PHI values (T1 field values, note body, lab numbers, etc.)
 *   - Safe in meta: resource IDs, action flags (enabled/disabled), counts, route context.
 *
 * Usage:
 *   logAudit({
 *     actor: req.authUser.id,
 *     target: clientUserId,
 *     orgId: req.authUser.organizationId,
 *     action: "WRITE",
 *     resourceType: "oncology_context",
 *     table: "users",
 *     field: "oncology_support_context",
 *     route: req.path,
 *     ip: getClientIp(req),
 *     meta: { enabled: body.enabled },  // flag only — no PHI values
 *   });
 */

import { db } from "../db";
import { auditLog } from "../db/schema/auditLog";

export type AuditAction =
  | "READ"          // T1 field read by a non-owner (coach, physician)
  | "WRITE"         // T1/T2 field created or updated
  | "DELETE"        // T1/T2 record deleted
  | "AUTH_LOGIN"    // Successful authentication
  | "AUTH_LOGOUT"   // Session invalidated
  | "AUTH_SIGNUP"   // New account created
  | "AUTH_RESET"    // Password reset initiated or completed
  | "ORG_VIOLATION"; // Cross-org access attempt (blocked)

export interface AuditEntry {
  actor: string;               // actorUserId — the authenticated caller
  target?: string | null;      // targetUserId — data owner (omit for self-access / auth events)
  orgId?: string | null;       // effective org of the actor (from req.authUser.organizationId)
  action: AuditAction;
  resourceType: string;        // e.g. "oncology_context" | "glp1_protocol" | "clinical_lab" | "client_note" | "auth"
  resourceId?: string | null;  // row ID or entity identifier when available
  table?: string | null;       // DB table name
  field?: string | null;       // specific field(s) changed/accessed (comma-separated for multi)
  route?: string | null;       // Express route path — no query params, no PHI
  ip?: string | null;          // Client IP
  meta?: Record<string, unknown> | null; // Non-PHI context only
}

/**
 * Write an audit log entry. Fire-and-forget — always returns immediately.
 */
export function logAudit(entry: AuditEntry): void {
  setImmediate(() => {
    db.insert(auditLog)
      .values({
        actorUserId: entry.actor,
        targetUserId: entry.target ?? null,
        orgId: entry.orgId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        tableName: entry.table ?? null,
        fieldName: entry.field ?? null,
        route: entry.route ?? null,
        ipAddress: entry.ip ?? null,
        metadata: (entry.meta ?? null) as any,
      })
      .then(() => { /* intentionally empty */ })
      .catch((err: any) => {
        // Write to stderr directly — never create a logging loop
        process.stderr.write(
          `[auditLog] DB write failed: ${err?.message ?? String(err)}\n`
        );
      });
  });
}

/**
 * Extract a safe client IP from an Express request.
 * Handles X-Forwarded-For (proxy/CDN) gracefully.
 */
export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? null;
  }
  return req.ip ?? null;
}
