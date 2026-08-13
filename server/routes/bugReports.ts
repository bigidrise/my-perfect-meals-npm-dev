/**
 * bugReports.ts — POST /api/bug-reports
 *
 * Authenticated endpoint. Inserts a record into bug_reports, then sends a
 * developer-actionable diagnostic email to support@myperfectmeals.ai.
 *
 * Contract:
 * - Requires authentication (requireAuth middleware). No unauthenticated submissions.
 * - DB insert is the authoritative record. Email failure never destroys a report —
 *   if Resend fails, we log the error and return 201 (report was stored).
 * - Diagnostics are sanitized further server-side before storage (strip any leaked keys).
 * - status defaults to 'new' for all new reports.
 */

import express from "express";
import { db } from "../db";
import { bugReports } from "../../shared/schema";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { sendBugReportEmail } from "../services/bugReportEmail";

const router = express.Router();

// ── Sanitize diagnostic payload from client ───────────────────────────────────
// Belt-and-suspenders: strip anything that looks like a sensitive key even if
// the client buffer already sanitized it.
const SENSITIVE_KEYS = /token|secret|password|auth|cookie|session|key|credential|payment|card|cvv/i;

function sanitizeDiagnostics(raw: unknown): object | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const str = JSON.stringify(raw, (key, value) => {
      if (typeof key === "string" && SENSITIVE_KEYS.test(key)) return "[REDACTED]";
      if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
      return value;
    });
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ── POST /api/bug-reports ─────────────────────────────────────────────────────

router.post("/", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const userId   = String(authUser.id);
    const userEmail = authUser.email ?? null;
    const userName  = authUser.username ?? authUser.email ?? null;

    const {
      description,
      intent,
      includeDiagnostics,
      diagnostics,
      route,
      buildVersion,
      environment,
      userAgent,
    } = req.body ?? {};

    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "description is required" });
    }

    const sanitized = includeDiagnostics ? sanitizeDiagnostics(diagnostics) : null;

    const [report] = await db
      .insert(bugReports)
      .values({
        userId,
        userEmail,
        userName,
        description:        description.trim().slice(0, 2000),
        intent:             typeof intent === "string" ? intent.trim().slice(0, 1000) || null : null,
        includeDiagnostics: !!includeDiagnostics,
        diagnostics:        sanitized,
        route:              typeof route === "string" ? route.slice(0, 500) : null,
        buildVersion:       typeof buildVersion === "string" ? buildVersion.slice(0, 50) : null,
        environment:        typeof environment === "string" ? environment.slice(0, 50) : null,
        userAgent:          typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
        status:             "new",
      })
      .returning();

    // Send developer-actionable email — failure must not fail the request
    try {
      await sendBugReportEmail(report);
    } catch (emailErr: any) {
      console.error(`[bugReports] DB insert OK (${report.id}) but email notification failed:`, emailErr.message);
    }

    res.status(201).json({ id: report.id, status: "received" });
  } catch (err: any) {
    console.error("[bugReports] POST error:", err);
    res.status(500).json({ error: "Failed to save bug report" });
  }
});

export default router;
