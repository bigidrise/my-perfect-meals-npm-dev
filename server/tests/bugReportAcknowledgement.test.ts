import fs from "node:fs";
import path from "node:path";

const mockExecute = jest.fn();

jest.mock("../db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import {
  claimBugReportAcknowledgement,
  deliverClaimedBugReportAcknowledgement,
  renderBugReportAcknowledgement,
  sendBugReportAcknowledgementEmail,
  shortBugReportId,
} from "../services/bugReportAcknowledgement";

function queryText(query: any): string {
  return query?.queryChunks
    ?.map((chunk: any) =>
      typeof chunk === "string" ? chunk : chunk?.value ?? "",
    )
    .join("") ?? String(query);
}

describe("bug report acknowledgement privacy and identity", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  test("uses the established uppercase eight-character display ID", () => {
    expect(shortBugReportId("5b910f75-1111-2222-3333-444444444444"))
      .toBe("5B910F75");
  });

  test("renders the approved copy with a resolved first name", () => {
    const rendered = renderBugReportAcknowledgement({
      firstName: "Betty",
      shortReportId: "5B910F75",
    });
    expect(rendered.subject).toBe("We received your My Perfect Meals report");
    expect(rendered.html).toContain("Hi Betty,");
    expect(rendered.html).toContain("Report ID: #5B910F75");
    expect(rendered.html).toContain("Ageless Fitness Club LLC");
    expect(rendered.html).not.toContain("24 hours");
  });

  test("uses the neutral greeting and escapes profile text", () => {
    expect(renderBugReportAcknowledgement({
      firstName: null,
      shortReportId: "5B910F75",
    }).html).toContain("Hi there,");

    const escaped = renderBugReportAcknowledgement({
      firstName: "<Betty>",
      shortReportId: "5B910F75",
    }).html;
    expect(escaped).toContain("Hi &lt;Betty&gt;,");
    expect(escaped).not.toContain("Hi <Betty>,");
  });

  test("the transport receives only recipient, subject, and privacy-limited HTML", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await sendBugReportAcknowledgementEmail({
      to: "account@example.com",
      firstName: "Betty",
      shortReportId: "5B910F75",
    }, "bug-report-ack:full-report-uuid", { send });

    expect(send).toHaveBeenCalledWith({
      to: "account@example.com",
      subject: "We received your My Perfect Meals report",
      html: expect.stringContaining("Report ID: #5B910F75"),
      idempotencyKey: "bug-report-ack:full-report-uuid",
    });
    const serialized = JSON.stringify(send.mock.calls);
    for (const forbidden of [
      "diagnostics",
      "stack",
      "userAgent",
      "buildVersion",
      "healthConditions",
      "5b910f75-1111-2222-3333-444444444444",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("bug report acknowledgement durable retry behavior", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  test("claim query excludes sent rows and recovers expired leases", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await expect(claimBugReportAcknowledgement(
      new Date("2026-09-18T12:00:00Z"),
    )).resolves.toBeNull();

    const query = queryText(mockExecute.mock.calls[0][0]);
    expect(query).toContain("status = 'pending'");
    expect(query).toContain("status = 'processing'");
    expect(query).toContain("lease_expires_at");
    expect(query).toContain("status = 'failed'");
    expect(query).not.toContain("status = 'sent'");
    expect(query).toContain("FOR UPDATE SKIP LOCKED");
  });

  test("successful delivery is recorded as sent", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const send = jest.fn().mockResolvedValue(undefined);

    await expect(deliverClaimedBugReportAcknowledgement({
      id: "ack-1",
      bug_report_id: "5b910f75-1111-2222-3333-444444444444",
      recipient_email: "account@example.com",
      first_name: "Betty",
      short_report_id: "5B910F75",
      attempts: 1,
      claim_token: "claim-1",
    }, { send })).resolves.toBe("sent");

    expect(send).toHaveBeenCalledTimes(1);
    const update = queryText(mockExecute.mock.calls[0][0]);
    expect(update).toContain("status = 'sent'");
    expect(update).toContain("sent_at");
    expect(update).toContain("claim_token");
  });

  test("delivery failure records a retry without throwing", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const send = jest.fn().mockRejectedValue(new Error("provider unavailable"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(deliverClaimedBugReportAcknowledgement({
      id: "ack-1",
      bug_report_id: "5b910f75-1111-2222-3333-444444444444",
      recipient_email: "account@example.com",
      first_name: null,
      short_report_id: "5B910F75",
      attempts: 1,
      claim_token: "claim-1",
    }, { send })).resolves.toBe("failed");

    const update = queryText(mockExecute.mock.calls[0][0]);
    expect(update).toContain("status = 'failed'");
    expect(update).toContain("available_at");
    expect(update).toContain("last_error");
    expect(update).toContain("claim_token");
    errorSpy.mockRestore();
  });

  test("schema enforces one acknowledgement job per full report UUID", () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "server/db/migrations/runBugReportsMigration.ts"),
      "utf8",
    );
    expect(migration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS bug_report_acknowledgements_report_uniq",
    );
    expect(migration).toContain("ON bug_report_acknowledgements (bug_report_id)");
  });
});

describe("bug report modal Report ID contract", () => {
  test("captures the successful response and displays only the short ID", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/BugReportModal.tsx"),
      "utf8",
    );
    expect(source).toContain("setShortReportId(displayId)");
    expect(source).toContain("Report ID: #{shortReportId}");
    expect(source).not.toContain("Report ID: #{result.id}");
  });
});