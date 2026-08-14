/**
 * Tests for trial-expiry reminder email label logic.
 *
 * Covers:
 *  1. formatTrialSourceLabel — all four source values
 *  2. sendTrialExpiryReminderEmail — label text appears in generated HTML
 *  3. runTrialExpiryReminders (cron) — selects trialSource and passes it
 *     through to sendTrialExpiryReminderEmail
 */

// ── Capture array shared by the resend mock ──────────────────────────────────
// Declared here (module scope) so both the mock factory and the test suites
// can reference the same array without any async gymnastics.
const resendSendCalls: Array<{ subject: string; html: string }> = [];

// Top-level mock — Jest hoists this before any import resolution so the
// ESM-only svix/uuid transitive deps inside `resend` are never loaded.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockImplementation(
        async (payload: { subject: string; html: string }) => {
          resendSendCalls.push({ subject: payload.subject, html: payload.html });
          return { data: { id: "mock-email-id" }, error: null };
        }
      ),
    },
  })),
}));

// ─── 1. formatTrialSourceLabel unit tests ────────────────────────────────────

describe("formatTrialSourceLabel", () => {
  let formatTrialSourceLabel: (trialSource?: string | null) => string;

  beforeAll(async () => {
    const mod = await import("../services/emailService");
    formatTrialSourceLabel = mod.formatTrialSourceLabel;
  });

  it("returns 'Admin Trial' for admin_grant", () => {
    expect(formatTrialSourceLabel("admin_grant")).toBe("Admin Trial");
  });

  it("returns 'Clinical Trial' for clinic_grant", () => {
    expect(formatTrialSourceLabel("clinic_grant")).toBe("Clinical Trial");
  });

  it("returns 'Promotional Trial' for promotion", () => {
    expect(formatTrialSourceLabel("promotion")).toBe("Promotional Trial");
  });

  it("returns 'Free Trial' for standard_signup", () => {
    expect(formatTrialSourceLabel("standard_signup")).toBe("Free Trial");
  });

  it("returns 'Free Trial' for null", () => {
    expect(formatTrialSourceLabel(null)).toBe("Free Trial");
  });

  it("returns 'Free Trial' for undefined", () => {
    expect(formatTrialSourceLabel(undefined)).toBe("Free Trial");
  });

  it("returns 'Free Trial' for an unrecognised string", () => {
    expect(formatTrialSourceLabel("unknown_value")).toBe("Free Trial");
  });
});

// ─── 2. sendTrialExpiryReminderEmail — label rendered in HTML ────────────────

describe("sendTrialExpiryReminderEmail — rendered HTML contains the correct label", () => {
  let sendTrialExpiryReminderEmail: (args: {
    to: string;
    firstName: string;
    daysRemaining: number;
    trialEndsAt: Date;
    trialSource?: string | null;
  }) => Promise<unknown>;

  beforeAll(async () => {
    // RESEND_API_KEY must be present so the module initialises the resend instance
    process.env.RESEND_API_KEY = "re_test_fake_key";
    const mod = await import("../services/emailService");
    sendTrialExpiryReminderEmail = mod.sendTrialExpiryReminderEmail;
  });

  afterAll(() => {
    delete process.env.RESEND_API_KEY;
  });

  beforeEach(() => {
    // Clear captured calls before each test so assertions are isolated
    resendSendCalls.length = 0;
  });

  async function getGeneratedHtml(trialSource: string | null | undefined): Promise<string> {
    await sendTrialExpiryReminderEmail({
      to: "user@example.com",
      firstName: "Test",
      daysRemaining: 3,
      trialEndsAt: new Date("2026-09-01T00:00:00Z"),
      trialSource,
    });
    return resendSendCalls[resendSendCalls.length - 1]?.html ?? "";
  }

  it("includes 'admin trial' text for admin_grant", async () => {
    const html = await getGeneratedHtml("admin_grant");
    expect(html.toLowerCase()).toContain("admin trial");
  });

  it("includes 'clinical trial' text for clinic_grant", async () => {
    const html = await getGeneratedHtml("clinic_grant");
    expect(html.toLowerCase()).toContain("clinical trial");
  });

  it("includes 'promotional trial' text for promotion", async () => {
    const html = await getGeneratedHtml("promotion");
    expect(html.toLowerCase()).toContain("promotional trial");
  });

  it("includes 'free trial' text for null (standard signup)", async () => {
    const html = await getGeneratedHtml(null);
    expect(html.toLowerCase()).toContain("free trial");
  });
});

// ─── 3. runTrialExpiryReminders — selects trialSource and passes it ──────────

describe("runTrialExpiryReminders — trialSource threading", () => {
  const emailCalls: Array<{
    to: string;
    trialSource: string | null | undefined;
  }> = [];

  // Fake DB user with trialSource set to clinic_grant
  const fakeUser = {
    id: 42,
    email: "patient@example.com",
    firstName: "Alice",
    trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    trialRemindersSent: [],
    planLookupKey: null,
    trialSource: "clinic_grant",
  };

  beforeAll(async () => {
    jest.resetModules();

    // ── Mock DB ──────────────────────────────────────────────────────────────
    jest.mock("../db", () => ({
      db: {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([fakeUser]),
          }),
        }),
        execute: jest.fn().mockResolvedValue(undefined),
      },
    }));

    // ── Mock email service — prevents the real resend init path ─────────────
    jest.mock("../services/emailService", () => ({
      sendTrialExpiryReminderEmail: jest.fn().mockImplementation(
        async (args: { to: string; trialSource?: string | null }) => {
          emailCalls.push({ to: args.to, trialSource: args.trialSource });
          return { id: "mock-id" };
        }
      ),
      formatTrialSourceLabel: jest.fn(),
    }));

    const mod = await import("../cron/trialReminders");
    await mod.runTrialExpiryReminders();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("calls sendTrialExpiryReminderEmail at least once for the candidate user", () => {
    expect(emailCalls.length).toBeGreaterThan(0);
  });

  it("passes the trialSource value from the DB row to the email function", () => {
    const call = emailCalls.find((c) => c.to === fakeUser.email);
    expect(call).toBeDefined();
    expect(call!.trialSource).toBe("clinic_grant");
  });

  it("does not coerce trialSource to a different value before passing it", () => {
    const callsForUser = emailCalls.filter((c) => c.to === fakeUser.email);
    for (const c of callsForUser) {
      expect(c.trialSource).toBe("clinic_grant");
    }
  });
});
