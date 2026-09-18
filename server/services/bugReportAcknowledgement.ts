import { sql } from "drizzle-orm";
import { db } from "../db";

const SUBJECT = "We received your My Perfect Meals report";
const MAX_ATTEMPTS = 8;
const LEASE_MS = 5 * 60_000;
const POLL_MS = 30_000;

export interface BugReportAcknowledgementEmailInput {
  to: string;
  firstName: string | null;
  shortReportId: string;
}

export interface BugReportAcknowledgementTransport {
  send(input: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey: string;
  }): Promise<void>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function shortBugReportId(reportId: string): string {
  return reportId.slice(0, 8).toUpperCase();
}

export function renderBugReportAcknowledgement(input: {
  firstName: string | null;
  shortReportId: string;
}): { subject: string; html: string } {
  const usableName = input.firstName?.trim();
  const greeting = usableName ? `Hi ${escapeHtml(usableName)},` : "Hi there,";
  const reportId = escapeHtml(input.shortReportId);

  return {
    subject: SUBJECT,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <p>${greeting}</p>
    <p>Thank you for contacting My Perfect Meals. We've received your report and our team will review it.</p>
    <p><strong>Report ID: #${reportId}</strong></p>
    <p>If you've reported a technical problem, we'll investigate the issue. If you've submitted feedback or a feature suggestion, we'll review it as part of our ongoing improvements to My Perfect Meals.</p>
    <p>There's nothing else you need to do right now. If we need additional information, we'll contact you.</p>
    <p>Thank you for helping us improve My Perfect Meals.</p>
    <p><strong>My Perfect Meals Support</strong><br>Ageless Fitness Club LLC</p>
  </div>
</body>
</html>`,
  };
}

const strictResendTransport: BugReportAcknowledgementTransport = {
  async send({ to, subject, html, idempotencyKey }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Resend is not configured");
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result: any = await resend.emails.send(
      {
        from: "My Perfect Meals <noreply@mail.myperfectmeals.com>",
        to,
        subject,
        html,
      },
      { idempotencyKey },
    );
    if (result?.error) {
      throw new Error(result.error.message || "Resend rejected acknowledgement");
    }
  },
};

export async function sendBugReportAcknowledgementEmail(
  input: BugReportAcknowledgementEmailInput,
  idempotencyKey: string,
  transport: BugReportAcknowledgementTransport = strictResendTransport,
): Promise<void> {
  const rendered = renderBugReportAcknowledgement(input);
  await transport.send({ to: input.to, idempotencyKey, ...rendered });
}

export async function claimBugReportAcknowledgement(now = new Date()): Promise<any | null> {
  const result: any = await db.execute(sql`
    UPDATE bug_report_acknowledgements AS acknowledgement
    SET
      status = 'processing',
      attempts = acknowledgement.attempts + 1,
      lease_expires_at = ${new Date(now.getTime() + LEASE_MS)},
      claim_token = gen_random_uuid(),
      updated_at = NOW()
    WHERE acknowledgement.id = (
      SELECT id
      FROM bug_report_acknowledgements
      WHERE (
        status = 'pending'
        OR (
          status = 'processing'
          AND attempts < ${MAX_ATTEMPTS}
          AND lease_expires_at < ${now}
        )
        OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS})
      )
        AND available_at <= ${now}
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);
  return (result.rows ?? result)[0] ?? null;
}

export async function deliverClaimedBugReportAcknowledgement(
  acknowledgement: any,
  transport?: BugReportAcknowledgementTransport,
): Promise<"sent" | "failed"> {
  try {
    await sendBugReportAcknowledgementEmail({
      to: acknowledgement.recipient_email,
      firstName: acknowledgement.first_name,
      shortReportId: acknowledgement.short_report_id,
    }, `bug-report-ack:${acknowledgement.bug_report_id}`, transport);
    await db.execute(sql`
      UPDATE bug_report_acknowledgements
      SET
        status = 'sent',
        sent_at = NOW(),
        lease_expires_at = NULL,
        claim_token = NULL,
        last_error = NULL,
        updated_at = NOW()
      WHERE id = ${acknowledgement.id}
        AND status = 'processing'
        AND claim_token = ${acknowledgement.claim_token}
    `);
    return "sent";
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Acknowledgement delivery failed")
      .slice(0, 500);
    const delayMinutes = Math.min(
      240,
      5 * 2 ** Math.max(0, Number(acknowledgement.attempts) - 1),
    );
    await db.execute(sql`
      UPDATE bug_report_acknowledgements
      SET
        status = 'failed',
        available_at = NOW() + (${delayMinutes} || ' minutes')::interval,
        lease_expires_at = NULL,
        claim_token = NULL,
        last_error = ${message},
        updated_at = NOW()
      WHERE id = ${acknowledgement.id}
        AND status = 'processing'
        AND claim_token = ${acknowledgement.claim_token}
    `);
    console.error("[bug-report-ack] delivery failed", {
      acknowledgementId: acknowledgement.id,
      attempts: acknowledgement.attempts,
      retryInMinutes: delayMinutes,
    });
    return "failed";
  }
}

export async function processDueBugReportAcknowledgements(
  options: { now?: Date; batchSize?: number; transport?: BugReportAcknowledgementTransport } = {},
): Promise<{ processed: number; outcomes: Array<"sent" | "failed"> }> {
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, Math.min(25, options.batchSize ?? 10));
  const outcomes: Array<"sent" | "failed"> = [];
  for (let i = 0; i < batchSize; i += 1) {
    const acknowledgement = await claimBugReportAcknowledgement(now);
    if (!acknowledgement) break;
    outcomes.push(await deliverClaimedBugReportAcknowledgement(
      acknowledgement,
      options.transport,
    ));
  }
  return { processed: outcomes.length, outcomes };
}

let wakePending = false;

export function wakeBugReportAcknowledgementWorker(): void {
  if (wakePending || process.env.NODE_ENV === "test") return;
  wakePending = true;
  setImmediate(() => {
    wakePending = false;
    void processDueBugReportAcknowledgements().catch((error) => {
      console.error("[bug-report-ack] wake failed:", error);
    });
  });
}

export function startBugReportAcknowledgementWorker(): void {
  if (process.env.NODE_ENV === "test") return;
  wakeBugReportAcknowledgementWorker();
  const timer = setInterval(wakeBugReportAcknowledgementWorker, POLL_MS);
  timer.unref();
}