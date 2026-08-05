/**
 * Confirms every signup path stamps trialStartedAt + trialEndsAt (7 days)
 * on the new user row, and that resolveAccessTier() returns PAID_FULL during
 * the trial window and FREE once it expires (BILLING_ENFORCED=true).
 *
 * Three paths under test:
 *   1. Personal (plain user, no special body flags)
 *   2. Business  (businessAccount=true)
 *   3. ProCare   (procare.professionalCategory present)
 *
 * No DB or HTTP plumbing is needed — we mirror the userValues construction
 * logic from auth.session.ts and call resolveAccessTier() directly.
 * A source-scan section guards against future regressions in the handler.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Mirror of auth.session.ts userValues construction ───────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mirrors the userValues object built in the signup handler for each path.
 * Returns only the trial-relevant fields — that is all we are asserting here.
 */
function buildUserValues(opts: {
  isBusinessAccount?: boolean;
  procare?: {
    professionalRole: string;
    professionalCategory: string;
  };
}, now: Date): {
  trialStartedAt: Date;
  trialEndsAt: Date;
  professionalRole?: string;
  role?: string;
  isProCare?: boolean;
  planLookupKey?: string;
} {
  // Base values stamped on every account — matches auth.session.ts lines 138-150
  const base: any = {
    trialStartedAt: now,
    trialEndsAt: new Date(now.getTime() + SEVEN_DAYS_MS),
  };

  // Business path — adds professionalRole="business" only; does NOT overwrite trial
  if (opts.isBusinessAccount) {
    base.professionalRole = "business";
  }

  // ProCare path — adds coach/procare fields; does NOT overwrite trial
  if (opts.procare?.professionalCategory) {
    base.role = "coach";
    base.isProCare = true;
    base.professionalRole = opts.procare.professionalRole;
    base.professionalCategory = opts.procare.professionalCategory;
    base.planLookupKey = "mpm_procare_monthly";
  }

  return base;
}

// ─── Fixed clock for deterministic tests ─────────────────────────────────────

const FIXED_NOW = new Date("2025-06-15T12:00:00Z");

// ─── 1. Personal signup ───────────────────────────────────────────────────────

describe("Signup trial stamp — personal path", () => {
  const values = buildUserValues({}, FIXED_NOW);

  it("sets trialStartedAt to now", () => {
    expect(values.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("sets trialEndsAt to exactly 7 days from now", () => {
    const expected = new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS);
    expect(values.trialEndsAt).toEqual(expected);
  });

  it("trialEndsAt is strictly after trialStartedAt", () => {
    expect(values.trialEndsAt.getTime()).toBeGreaterThan(values.trialStartedAt.getTime());
  });

  it("trial window is 7 days (604 800 000 ms)", () => {
    const delta = values.trialEndsAt.getTime() - values.trialStartedAt.getTime();
    expect(delta).toBe(SEVEN_DAYS_MS);
  });
});

// ─── 2. Business signup ───────────────────────────────────────────────────────

describe("Signup trial stamp — business path (businessAccount=true)", () => {
  const values = buildUserValues({ isBusinessAccount: true }, FIXED_NOW);

  it("sets trialStartedAt to now", () => {
    expect(values.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("sets trialEndsAt to exactly 7 days from now", () => {
    const expected = new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS);
    expect(values.trialEndsAt).toEqual(expected);
  });

  it("trial window is 7 days", () => {
    const delta = values.trialEndsAt.getTime() - values.trialStartedAt.getTime();
    expect(delta).toBe(SEVEN_DAYS_MS);
  });

  it("professionalRole is set to 'business' (business-specific field is present)", () => {
    expect(values.professionalRole).toBe("business");
  });
});

// ─── 3. ProCare signup ────────────────────────────────────────────────────────

describe("Signup trial stamp — ProCare professional path", () => {
  const values = buildUserValues({
    procare: { professionalRole: "trainer", professionalCategory: "certified" },
  }, FIXED_NOW);

  it("sets trialStartedAt to now", () => {
    expect(values.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("sets trialEndsAt to exactly 7 days from now", () => {
    const expected = new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS);
    expect(values.trialEndsAt).toEqual(expected);
  });

  it("trial window is 7 days", () => {
    const delta = values.trialEndsAt.getTime() - values.trialStartedAt.getTime();
    expect(delta).toBe(SEVEN_DAYS_MS);
  });

  it("ProCare-specific fields are present alongside the trial stamp", () => {
    expect(values.role).toBe("coach");
    expect(values.isProCare).toBe(true);
    expect(values.planLookupKey).toBe("mpm_procare_monthly");
  });
});

// ─── 4. resolveAccessTier — trial → PAID_FULL, expired → FREE ────────────────
// (BILLING_ENFORCED must be true so the trial check is reached)

describe("resolveAccessTier with BILLING_ENFORCED=true — trial scenarios", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resolveAccessTierFn: (user: any, now?: Date) => "PAID_FULL" | "FREE";

  beforeAll(async () => {
    process.env.BILLING_ENFORCED = "true";
    jest.resetModules();
    const mod = await import("../lib/accessTier");
    resolveAccessTierFn = mod.resolveAccessTier;
  });

  afterAll(() => {
    delete process.env.BILLING_ENFORCED;
  });

  // ── Personal user within trial ───────────────────────────────────────────
  it("personal user with active trial → PAID_FULL", () => {
    const values = buildUserValues({}, FIXED_NOW);
    // Evaluate at FIXED_NOW (1 second after signup, still within trial)
    const checkTime = new Date(FIXED_NOW.getTime() + 1000);
    expect(resolveAccessTierFn({ trialEndsAt: values.trialEndsAt }, checkTime)).toBe("PAID_FULL");
  });

  // ── Business user within trial ───────────────────────────────────────────
  it("business user with active trial → PAID_FULL", () => {
    const values = buildUserValues({ isBusinessAccount: true }, FIXED_NOW);
    const checkTime = new Date(FIXED_NOW.getTime() + 1000);
    expect(resolveAccessTierFn({ trialEndsAt: values.trialEndsAt }, checkTime)).toBe("PAID_FULL");
  });

  // ── ProCare user within trial ────────────────────────────────────────────
  it("ProCare user with active trial → PAID_FULL", () => {
    const values = buildUserValues({
      procare: { professionalRole: "physician", professionalCategory: "certified" },
    }, FIXED_NOW);
    const checkTime = new Date(FIXED_NOW.getTime() + 1000);
    // ProCare also has planLookupKey="mpm_procare_monthly" which would short-circuit
    // to PAID_FULL via the paid-plan check. Test the trial path by omitting it.
    expect(resolveAccessTierFn({ trialEndsAt: values.trialEndsAt }, checkTime)).toBe("PAID_FULL");
  });

  // ── Trial still active on day 6 of 7 ────────────────────────────────────
  it("user checked on day 6 of trial → still PAID_FULL", () => {
    const values = buildUserValues({}, FIXED_NOW);
    const day6 = new Date(FIXED_NOW.getTime() + 6 * 24 * 60 * 60 * 1000);
    expect(resolveAccessTierFn({ trialEndsAt: values.trialEndsAt }, day6)).toBe("PAID_FULL");
  });

  // ── Trial expired (simulated by setting trialEndsAt to now-1ms) ──────────
  it("personal user after trial expires → FREE", () => {
    const expiredTrialEndsAt = new Date(FIXED_NOW.getTime() - 1);
    expect(resolveAccessTierFn({ trialEndsAt: expiredTrialEndsAt }, FIXED_NOW)).toBe("FREE");
  });

  it("business user after trial expires → FREE", () => {
    const expiredTrialEndsAt = new Date(FIXED_NOW.getTime() - 1);
    expect(resolveAccessTierFn(
      { trialEndsAt: expiredTrialEndsAt, professionalRole: "business" },
      FIXED_NOW,
    )).toBe("FREE");
  });

  it("ProCare user after trial expires (no active plan) → FREE", () => {
    const expiredTrialEndsAt = new Date(FIXED_NOW.getTime() - 1);
    // Omit planLookupKey to isolate the trial branch
    expect(resolveAccessTierFn(
      { trialEndsAt: expiredTrialEndsAt, isProCare: true },
      FIXED_NOW,
    )).toBe("FREE");
  });

  // ── Boundary: trial ends exactly at check time → FREE ────────────────────
  it("trialEndsAt === now (boundary) → FREE (trial is over, not strictly less)", () => {
    expect(resolveAccessTierFn({ trialEndsAt: FIXED_NOW }, FIXED_NOW)).toBe("FREE");
  });

  // ── 7-day simulation: user signs up at T=0, checked at T+7d+1ms → FREE ──
  it("user checked 7 days and 1 ms after signup → FREE (trial fully expired)", () => {
    const signupTime = FIXED_NOW;
    const trialEndsAt = new Date(signupTime.getTime() + SEVEN_DAYS_MS);
    const checkTime = new Date(trialEndsAt.getTime() + 1); // 1 ms past expiry
    expect(resolveAccessTierFn({ trialEndsAt }, checkTime)).toBe("FREE");
  });
});

// ─── 5. Source scan — auth.session.ts must stamp trial on all paths ───────────

describe("auth.session.ts source scan — trial fields in userValues", () => {
  const signupFilePath = path.resolve(__dirname, "../routes/auth.session.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(signupFilePath, "utf-8");
  });

  it("trialStartedAt is assigned in the base userValues object (before path branches)", () => {
    // The assignment must appear before the if(isBusinessAccount) and procare blocks.
    // Use the branch form "if (isBusinessAccount)" to avoid matching the earlier
    // variable declaration "const isBusinessAccount = ...".
    const trialStartedIdx = source.indexOf("trialStartedAt:");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    const procareIdx = source.indexOf("if (procare && procare.professionalCategory)");
    expect(trialStartedIdx).toBeGreaterThan(0);
    expect(trialStartedIdx).toBeLessThan(businessBranchIdx);
    expect(trialStartedIdx).toBeLessThan(procareIdx);
  });

  it("trialEndsAt is assigned in the base userValues object (before path branches)", () => {
    const trialEndsIdx = source.indexOf("trialEndsAt:");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    const procareIdx = source.indexOf("if (procare && procare.professionalCategory)");
    expect(trialEndsIdx).toBeGreaterThan(0);
    expect(trialEndsIdx).toBeLessThan(businessBranchIdx);
    expect(trialEndsIdx).toBeLessThan(procareIdx);
  });

  it("trialEndsAt is set to 7 days (7 * 24 * 60 * 60 * 1000 ms) from now", () => {
    // Accept any form that computes the 7-day offset in milliseconds
    const sevenDayPattern = /trialEndsAt:\s*new Date\(Date\.now\(\)\s*\+\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/;
    expect(sevenDayPattern.test(source)).toBe(true);
  });

  it("the ProCare branch does NOT overwrite trialEndsAt", () => {
    // Extract the ProCare block (from "if (procare &&" to the closing "}")
    const procareStart = source.indexOf("if (procare && procare.professionalCategory)");
    // Find the matching brace by scanning forward
    let depth = 0;
    let procareEnd = procareStart;
    for (let i = procareStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) { procareEnd = i; break; }
      }
    }
    const procareBlock = source.slice(procareStart, procareEnd);
    expect(procareBlock).not.toContain("trialEndsAt");
  });

  it("the business branch does NOT overwrite trialEndsAt", () => {
    const businessStart = source.indexOf("if (isBusinessAccount)");
    let depth = 0;
    let businessEnd = businessStart;
    for (let i = businessStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) { businessEnd = i; break; }
      }
    }
    const businessBlock = source.slice(businessStart, businessEnd);
    expect(businessBlock).not.toContain("trialEndsAt");
  });
});
