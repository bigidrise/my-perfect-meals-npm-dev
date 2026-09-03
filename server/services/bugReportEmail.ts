/**
 * bugReportEmail.ts — developer-actionable diagnostic email for bug reports.
 *
 * The email is structured so it can be copied directly into an AI coding/debugging
 * agent with the prompt "diagnose this bug."
 *
 * Rules:
 * - Never include passwords, session tokens, cookies, request/response bodies,
 *   payment info, medical/chat/meal contents.
 * - Source file/component/line only reported when genuinely present in captured stack.
 * - "Not identified from captured diagnostics." when evidence is absent.
 * - Uses generic sendEmail() so email failure is handled by the caller.
 */

import type { BugReport } from "../../shared/schema";
import type { DiagnosticError, DiagnosticRequest } from "../../client/src/lib/diagnosticsBuffer";
import { sendEmail } from "./email";

const SUPPORT_EMAIL = "support@myperfectmeals.ai";

interface DiagnosticsPayload {
  errors?:         DiagnosticError[];
  failedRequests?: DiagnosticRequest[];
  capturedAt?:     string;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  } catch { return iso; }
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Parse a stack line to extract file/component/line if genuinely present */
function parseStackLocation(stack: string | undefined): string {
  if (!stack) return "Not identified from captured diagnostics.";
  const lines = stack.split("\n");
  // Find the first line that looks like a source reference (at ... file:line:col)
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("at ")) {
      return esc(trimmed.slice(0, 200));
    }
  }
  return "Not identified from captured diagnostics.";
}

/** Identify the most likely failing area from diagnostic evidence */
function buildDeveloperSummary(
  route:    string | null | undefined,
  diag:     DiagnosticsPayload | null,
  reportId: string,
): string {
  const page = esc(route || "Unknown");

  const allErrors   = diag?.errors ?? [];
  const failedReqs  = diag?.failedRequests ?? [];

  // Prefer a real app error over infrastructure noise (Vite/HMR/WS).
  // Only fall back to an infrastructure error if that's all we have.
  const appErrors  = allErrors.filter(e => !e.isInfrastructure);
  const firstError = appErrors[0] ?? allErrors[0];
  const infraOnly  = allErrors.length > 0 && appErrors.length === 0;

  const recentErrorMsg = firstError
    ? esc(firstError.message.slice(0, 200)) +
      (infraOnly ? " <em style=\"color:#6b7280;\">(dev infrastructure — not an app error)</em>" : "")
    : "Not identified from captured diagnostics.";

  const sourceLocation = firstError
    ? parseStackLocation(firstError.stack)
    : "Not identified from captured diagnostics.";

  const failedEndpoints = failedReqs.length > 0
    ? failedReqs.map(r => `${r.method} ${esc(r.path)} → ${r.status}`).join("<br>")
    : "None captured.";

  // Build a brief event sequence (most recent first = already sorted by buffer)
  const allEvents: Array<{ ts: string; label: string }> = [];
  (diag?.errors ?? []).slice(0, 5).forEach(e =>
    allEvents.push({
      ts: e.timestamp,
      label: `Error: ${esc(e.message.slice(0, 100))}` +
        (e.isInfrastructure ? " <em style=\"color:#6b7280;\">[dev infra]</em>" : ""),
    })
  );
  (diag?.failedRequests ?? []).slice(0, 5).forEach(r =>
    allEvents.push({ ts: r.timestamp, label: `${r.method} ${esc(r.path)} → ${r.status}` })
  );
  allEvents.sort((a, b) => b.ts.localeCompare(a.ts));
  const sequence = allEvents.length > 0
    ? allEvents.map(e => `${formatDate(e.ts)} — ${e.label}`).join("<br>")
    : "Not identified from captured diagnostics.";

  return `
    <tr><td colspan="2" style="padding:12px 0 4px;font-size:13px;font-weight:700;color:#f59e0b;border-top:1px solid #374151;">
      Developer Diagnostic Summary
    </td></tr>
    <tr>
      <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Page affected</td>
      <td style="padding:3px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${page}</td>
    </tr>
    <tr>
      <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Most recent error</td>
      <td style="padding:3px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${recentErrorMsg}</td>
    </tr>
    <tr>
      <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Likely file/component</td>
      <td style="padding:3px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${sourceLocation}</td>
    </tr>
    <tr>
      <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Failed endpoint(s)</td>
      <td style="padding:3px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${failedEndpoints}</td>
    </tr>
    <tr>
      <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;border-bottom:1px solid #374151;">Event sequence</td>
      <td style="padding:3px 0 12px;font-size:12px;color:#f3f4f6;font-family:monospace;border-bottom:1px solid #374151;">${sequence}</td>
    </tr>
  `;
}

export async function sendBugReportEmail(report: BugReport): Promise<void> {
  const diag = report.includeDiagnostics
    ? (report.diagnostics as DiagnosticsPayload | null)
    : null;

  const errors:   DiagnosticError[]   = diag?.errors         ?? [];
  const requests: DiagnosticRequest[] = diag?.failedRequests  ?? [];

  const errorsHtml = errors.length === 0
    ? `<tr><td colspan="2" style="font-size:12px;color:#6b7280;font-style:italic;padding:3px 0;">None captured.</td></tr>`
    : errors.map((e, i) => `
        <tr>
          <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">#${i + 1}</td>
          <td style="padding:3px 0;font-size:12px;color:#f3f4f6;">
            <span style="font-family:monospace;">${esc(e.message)}</span><br>
            ${e.source ? `<span style="color:#6b7280;">Source: ${esc(e.source)}</span><br>` : ""}
            ${e.stack
              ? `<span style="color:#6b7280;font-family:monospace;font-size:11px;">${esc(e.stack).replace(/\n/g, "<br>")}</span><br>`
              : ""}
            <span style="color:#6b7280;font-size:11px;">${formatDate(e.timestamp)}</span>
          </td>
        </tr>
      `).join("");

  const requestsHtml = requests.length === 0
    ? `<tr><td colspan="2" style="font-size:12px;color:#6b7280;font-style:italic;padding:3px 0;">None captured.</td></tr>`
    : requests.map((r, i) => `
        <tr>
          <td style="padding:3px 12px 3px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">#${i + 1}</td>
          <td style="padding:3px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">
            ${r.method} ${esc(r.path)} → <strong>${r.status}</strong>
            ${r.duration != null ? ` — ${r.duration}ms` : ""}
            <br><span style="color:#6b7280;font-size:11px;">${formatDate(r.timestamp)}</span>
          </td>
        </tr>
      `).join("");

  const devSummary = buildDeveloperSummary(report.route, diag, report.id);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#111827;font-family:system-ui,-apple-system,sans-serif;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#1f2937;border-radius:12px;overflow:hidden;">
    <!-- Header -->
    <div style="background:#f59e0b;padding:16px 24px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">🐛</span>
      <div>
        <h1 style="margin:0;font-size:16px;font-weight:700;color:#000;">Bug Report #${report.id.slice(0, 8).toUpperCase()}</h1>
        <p style="margin:2px 0 0;font-size:12px;color:#1f2937;">My Perfect Meals — ${esc(report.environment ?? "unknown")}</p>
      </div>
    </div>

    <div style="padding:24px;">
      <!-- Metadata table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Report ID</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${report.id}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">User</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;">${esc(report.userName ?? "")} &lt;${esc(report.userEmail ?? "")}&gt; (${esc(report.userId ?? "")})</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Page</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${esc(report.route ?? "unknown")}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Build version</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;font-family:monospace;">${esc(report.buildVersion ?? "unknown")}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Timestamp</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;">${formatDate(report.createdAt?.toISOString())}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#9ca3af;white-space:nowrap;vertical-align:top;">Browser</td>
          <td style="padding:4px 0;font-size:12px;color:#f3f4f6;word-break:break-word;">${esc(report.userAgent ?? "unknown")}</td>
        </tr>
      </table>

      <!-- User description -->
      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px;font-weight:700;color:#f59e0b;margin:0 0 8px;">What happened?</h2>
        <div style="background:#111827;border-radius:8px;padding:12px;font-size:13px;color:#f3f4f6;white-space:pre-wrap;word-break:break-word;">${esc(report.description)}</div>
      </div>

      ${report.intent ? `
      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px;font-weight:700;color:#f59e0b;margin:0 0 8px;">What were they trying to do?</h2>
        <div style="background:#111827;border-radius:8px;padding:12px;font-size:13px;color:#f3f4f6;white-space:pre-wrap;word-break:break-word;">${esc(report.intent)}</div>
      </div>
      ` : ""}

      ${diag ? `
      <!-- Recent client errors -->
      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px;font-weight:700;color:#f59e0b;margin:0 0 8px;">Recent client errors (most recent first)</h2>
        <div style="background:#111827;border-radius:8px;padding:12px;">
          <table style="width:100%;border-collapse:collapse;">${errorsHtml}</table>
        </div>
      </div>

      <!-- Recent failed API requests -->
      <div style="margin-bottom:20px;">
        <h2 style="font-size:13px;font-weight:700;color:#f59e0b;margin:0 0 8px;">Recent failed API requests (most recent first)</h2>
        <div style="background:#111827;border-radius:8px;padding:12px;">
          <table style="width:100%;border-collapse:collapse;">${requestsHtml}</table>
        </div>
      </div>
      ` : `
      <p style="font-size:12px;color:#6b7280;font-style:italic;margin-bottom:20px;">User opted out of diagnostic information.</p>
      `}

      <!-- Developer Diagnostic Summary -->
      <div style="background:#111827;border-radius:8px;padding:12px;">
        <table style="width:100%;border-collapse:collapse;">${devSummary}</table>
      </div>

      <!-- Footer note -->
      <p style="margin-top:20px;font-size:11px;color:#6b7280;text-align:center;">
        This report does not contain passwords, authentication tokens, cookies, or sensitive user data.<br>
        Reported via My Perfect Meals in-app diagnostic system.
      </p>
    </div>
  </div>
</body>
</html>`;

  const shortId = report.id.slice(0, 8).toUpperCase();
  const subject = `🐛 Bug Report #${shortId} — ${esc(report.route ?? "unknown page")} [${esc(report.environment ?? "?")}]`;

  await sendEmail({ to: SUPPORT_EMAIL, subject, html });
}
