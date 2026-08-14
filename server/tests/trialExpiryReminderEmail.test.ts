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

// ─── 4. runTrialExpiryReminders — paid-plan guard ────────────────────────────
//
// Strategy: capture every argument that the cron passes to Drizzle's where()
// and flatten the Drizzle SQL AST to a plain string, then assert that the
// planLookupKey IS NULL / = '' guard is present in the query.
//
// This means the test FAILS if the production predicate is removed, which a
// mock-returns-[] approach would not catch.
//
// We also confirm the boundary: a user with planLookupKey = '' (empty string)
// is still in trial scope and SHOULD receive the email.

/**
 * Flatten a Drizzle SQL node tree into a plain string for assertion.
 *
 * Drizzle's sql`` tag produces nodes where:
 *   - String literals → { value: string[] }  (StringChunk — value is an array)
 *   - Compound SQL    → { queryChunks: any[] }
 *   - Column refs     → class instances with a `name` string property
 *
 * The `name` fallback is checked last so compound nodes that also have a name
 * (e.g. Column instances with queryChunks) produce their full subtree first.
 */
function flattenSql(node: any): string {
  if (!node || typeof node !== "object") return String(node ?? "");
  // StringChunk — { value: string[] }
  if (Array.isArray(node.value)) return (node.value as string[]).join("");
  // Plain string shape (older Drizzle versions)
  if (typeof node.value === "string") return node.value;
  // Compound SQL / and() — recurse; fall back to node.name if chunks are empty
  if (Array.isArray(node.queryChunks)) {
    const fromChunks = (node.queryChunks as any[]).map(flattenSql).join("");
    if (fromChunks.length > 0) return fromChunks;
  }
  // Column reference class instance — name is the column identifier
  if (typeof node.name === "string") return node.name;
  return "";
}

describe("runTrialExpiryReminders — paid-plan guard", () => {
  // ── Scenario A: validate the SQL predicate itself ─────────────────────────
  //
  // Capture every call to where() and flatten the Drizzle SQL AST.
  // Asserts that the query contains both "plan_lookup_key" and "IS NULL"
  // so that removing the guard from trialReminders.ts breaks this test.

  describe("SQL WHERE clause includes the planLookupKey IS NULL guard", () => {
    const capturedSqlFragments: string[] = [];
    const emailCallsSql: Array<{ to: string }> = [];

    beforeAll(async () => {
      jest.resetModules();

      jest.mock("../db", () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockImplementation((condition: unknown) => {
                // Capture the flattened SQL so we can assert on its content
                capturedSqlFragments.push(flattenSql(condition));
                return Promise.resolve([]);
              }),
            }),
          }),
          execute: jest.fn().mockResolvedValue(undefined),
        },
      }));

      jest.mock("../services/emailService", () => ({
        sendTrialExpiryReminderEmail: jest.fn().mockImplementation(
          async (args: { to: string }) => {
            emailCallsSql.push({ to: args.to });
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

    it("calls where() at least once (one call per milestone)", () => {
      // runTrialExpiryReminders iterates 4 milestones → 4 where() calls
      expect(capturedSqlFragments.length).toBeGreaterThan(0);
    });

    it("the WHERE clause references plan_lookup_key", () => {
      const combined = capturedSqlFragments.join(" ");
      expect(combined).toMatch(/plan_lookup_key/i);
    });

    it("the WHERE clause contains an IS NULL check", () => {
      const combined = capturedSqlFragments.join(" ");
      expect(combined).toMatch(/IS NULL/i);
    });

    it("the WHERE clause contains an empty-string check (= '')", () => {
      const combined = capturedSqlFragments.join(" ");
      // The sql template literal produces  ... OR plan_lookup_key = ''
      expect(combined).toMatch(/= ''/);
    });

    it("no email is sent when the DB returns no matching candidates", () => {
      // where() returns [] for every milestone → zero emails
      expect(emailCallsSql).toHaveLength(0);
    });
  });

  // ── Scenario B: paid subscriber mid-trial does NOT receive the email ───────
  //
  // Simulate what happens at the application level: the DB mock returns the
  // paid user for the first where() call but we also assert the SQL predicate
  // is present (reusing flattenSql), confirming the cron would have excluded
  // them in production if the query were run against a real database.

  describe("when a user upgrades mid-trial (planLookupKey = 'premium')", () => {
    const paidUser = {
      id: 101,
      email: "upgraded@example.com",
      firstName: "Carol",
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      trialRemindersSent: [],
      planLookupKey: "premium",
      trialSource: "standard_signup",
    };

    const emailCallsPaid: Array<{ to: string }> = [];
    const capturedSqlPaid: string[] = [];

    beforeAll(async () => {
      jest.resetModules();

      // Simulate the SQL guard correctly filtering the paid user: DB returns []
      // We also capture the SQL to prove the guard is expressed in the query.
      jest.mock("../db", () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockImplementation((condition: unknown) => {
                capturedSqlPaid.push(flattenSql(condition));
                // The planLookupKey guard filters paidUser out → empty result
                return Promise.resolve([]);
              }),
            }),
          }),
          execute: jest.fn().mockResolvedValue(undefined),
        },
      }));

      jest.mock("../services/emailService", () => ({
        sendTrialExpiryReminderEmail: jest.fn().mockImplementation(
          async (args: { to: string }) => {
            emailCallsPaid.push({ to: args.to });
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

    it("the query contains the planLookupKey IS NULL guard that excludes paid users", () => {
      const combined = capturedSqlPaid.join(" ");
      expect(combined).toMatch(/plan_lookup_key/i);
      expect(combined).toMatch(/IS NULL/i);
    });

    it("no email is sent to the upgraded user", () => {
      const calls = emailCallsPaid.filter((c) => c.to === paidUser.email);
      expect(calls).toHaveLength(0);
    });
  });

  // ── Scenario C: empty-string planLookupKey (boundary — still on trial) ────
  //
  // planLookupKey = '' satisfies the SQL guard (OR planLookupKey = ''), so
  // the DB mock returns the user and the email SHOULD be sent.

  describe("when planLookupKey = '' (empty string boundary — still on trial)", () => {
    const freeUser = {
      id: 102,
      email: "free-user@example.com",
      firstName: "Dave",
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      trialRemindersSent: [],
      planLookupKey: "",
      trialSource: "standard_signup",
    };

    const emailCallsFree: Array<{ to: string }> = [];

    beforeAll(async () => {
      jest.resetModules();

      jest.mock("../db", () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              // Empty planLookupKey satisfies the guard → row is returned
              where: jest.fn().mockResolvedValue([freeUser]),
            }),
          }),
          execute: jest.fn().mockResolvedValue(undefined),
        },
      }));

      jest.mock("../services/emailService", () => ({
        sendTrialExpiryReminderEmail: jest.fn().mockImplementation(
          async (args: { to: string }) => {
            emailCallsFree.push({ to: args.to });
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

    it("sends the reminder email to the user with an empty planLookupKey", () => {
      const calls = emailCallsFree.filter((c) => c.to === freeUser.email);
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
