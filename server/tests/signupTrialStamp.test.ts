/**
 * Confirms the trial stamp behavior after the Phase 2.5 change:
 *   - Signup does NOT stamp trialStartedAt / trialEndsAt (trial clock is idle until onboarding)
 *   - Onboarding completion (/api/user/complete-onboarding) stamps a 7-day trial
 *   - An existing trial (business invite / promotion) is never overwritten
 *   - resolveAccessTier() returns PAID_FULL during the trial window and FREE once expired
 *
 * No DB or HTTP plumbing needed — we mirror the logic from auth.session.ts and
 * routes.ts (complete-onboarding) and call resolveAccessTier() directly.
 * Source-scan sections guard against future regressions.
 */

import * as fs from "fs";
import * as path from "path";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Mirror of auth.session.ts userValues — trial fields ABSENT ──────────────

function buildSignupUserValues(opts: {
  isBusinessAccount?: boolean;
  procare?: {
    professionalRole: string;
    professionalCategory: string;
  };
}): { trialStartedAt?: Date; trialEndsAt?: Date; professionalRole?: string; role?: string; isProCare?: boolean; planLookupKey?: string } {
  // Base values — no trial fields (mirrors current auth.session.ts)
  const base: any = {};

  if (opts.isBusinessAccount) {
    base.professionalRole = "business";
  }
  if (opts.procare?.professionalCategory) {
    base.role = "coach";
    base.isProCare = true;
    base.professionalRole = opts.procare.professionalRole;
    base.planLookupKey = "mpm_procare_monthly";
  }
  return base;
}

// ─── Mirror of complete-onboarding trial stamp logic ─────────────────────────

function applyOnboardingTrialStamp(existingUser: {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
}, now: Date): { trialStartedAt: Date; trialEndsAt: Date } {
  return {
    trialStartedAt: existingUser.trialStartedAt ?? now,
    trialEndsAt: existingUser.trialEndsAt ?? new Date(now.getTime() + SEVEN_DAYS_MS),
  };
}

const FIXED_NOW = new Date("2025-06-15T12:00:00Z");

// ─── 1. Signup does NOT stamp a trial ────────────────────────────────────────

describe("Signup — no trial stamp on account creation", () => {
  it("personal signup: trialStartedAt is not set", () => {
    const v = buildSignupUserValues({});
    expect(v.trialStartedAt).toBeUndefined();
  });

  it("personal signup: trialEndsAt is not set", () => {
    const v = buildSignupUserValues({});
    expect(v.trialEndsAt).toBeUndefined();
  });

  it("business signup: trialStartedAt is not set", () => {
    const v = buildSignupUserValues({ isBusinessAccount: true });
    expect(v.trialStartedAt).toBeUndefined();
  });

  it("business signup: trialEndsAt is not set", () => {
    const v = buildSignupUserValues({ isBusinessAccount: true });
    expect(v.trialEndsAt).toBeUndefined();
  });

  it("ProCare signup: trialStartedAt is not set", () => {
    const v = buildSignupUserValues({ procare: { professionalRole: "trainer", professionalCategory: "certified" } });
    expect(v.trialStartedAt).toBeUndefined();
  });

  it("ProCare signup: trialEndsAt is not set", () => {
    const v = buildSignupUserValues({ procare: { professionalRole: "trainer", professionalCategory: "certified" } });
    expect(v.trialEndsAt).toBeUndefined();
  });
});

// ─── 2. Onboarding completion stamps a 7-day trial ───────────────────────────

describe("Onboarding completion — trial stamped at completion", () => {
  const userWithNoTrial = { trialStartedAt: null, trialEndsAt: null };
  const stamp = applyOnboardingTrialStamp(userWithNoTrial, FIXED_NOW);

  it("sets trialStartedAt to the completion timestamp", () => {
    expect(stamp.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("sets trialEndsAt to exactly 7 days after completion", () => {
    const expected = new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS);
    expect(stamp.trialEndsAt).toEqual(expected);
  });

  it("trial window is exactly 7 days (604 800 000 ms)", () => {
    const delta = stamp.trialEndsAt.getTime() - stamp.trialStartedAt.getTime();
    expect(delta).toBe(SEVEN_DAYS_MS);
  });

  it("trialEndsAt is strictly after trialStartedAt", () => {
    expect(stamp.trialEndsAt.getTime()).toBeGreaterThan(stamp.trialStartedAt.getTime());
  });
});

// ─── 3. Existing trial is never overwritten ───────────────────────────────────

describe("Onboarding completion — existing trial preserved (business invite / promotion)", () => {
  // Simulate a user who already received a 14-day trial from a business invite
  const existingTrialStart = new Date("2025-06-10T00:00:00Z");
  const existingTrialEnd   = new Date("2025-06-24T00:00:00Z"); // 14-day window
  const userWithTrial = { trialStartedAt: existingTrialStart, trialEndsAt: existingTrialEnd };

  // complete-onboarding runs on Jun 15 — should NOT shorten the 14-day window
  const stamp = applyOnboardingTrialStamp(userWithTrial, FIXED_NOW);

  it("trialStartedAt is not overwritten when already set", () => {
    expect(stamp.trialStartedAt).toEqual(existingTrialStart);
  });

  it("trialEndsAt is not overwritten when already set", () => {
    expect(stamp.trialEndsAt).toEqual(existingTrialEnd);
  });

  it("the longer business-invite window is preserved, not replaced by the 7-day standard", () => {
    const preservedWindow = stamp.trialEndsAt.getTime() - stamp.trialStartedAt.getTime();
    expect(preservedWindow).toBeGreaterThan(SEVEN_DAYS_MS);
  });
});

// ─── 4. resolveAccessTier — trial → PAID_FULL, expired → FREE ────────────────

describe("resolveAccessTier with BILLING_ENFORCED=true — trial scenarios", () => {
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

  it("user with active trial (from onboarding stamp) → PAID_FULL", () => {
    const stamp = applyOnboardingTrialStamp({ trialStartedAt: null, trialEndsAt: null }, FIXED_NOW);
    const checkTime = new Date(FIXED_NOW.getTime() + 1000); // 1 sec after onboarding
    expect(resolveAccessTierFn({ trialEndsAt: stamp.trialEndsAt }, checkTime)).toBe("PAID_FULL");
  });

  it("user checked on day 6 of their 7-day trial → PAID_FULL", () => {
    const stamp = applyOnboardingTrialStamp({ trialStartedAt: null, trialEndsAt: null }, FIXED_NOW);
    const day6 = new Date(FIXED_NOW.getTime() + 6 * 24 * 60 * 60 * 1000);
    expect(resolveAccessTierFn({ trialEndsAt: stamp.trialEndsAt }, day6)).toBe("PAID_FULL");
  });

  it("user checked 7 days and 1 ms after onboarding → FREE (trial fully expired)", () => {
    const stamp = applyOnboardingTrialStamp({ trialStartedAt: null, trialEndsAt: null }, FIXED_NOW);
    const checkTime = new Date(stamp.trialEndsAt.getTime() + 1);
    expect(resolveAccessTierFn({ trialEndsAt: stamp.trialEndsAt }, checkTime)).toBe("FREE");
  });

  it("trialEndsAt === now (boundary) → FREE", () => {
    expect(resolveAccessTierFn({ trialEndsAt: FIXED_NOW }, FIXED_NOW)).toBe("FREE");
  });

  it("user with no trial at all (trialEndsAt null) → FREE", () => {
    expect(resolveAccessTierFn({ trialEndsAt: null }, FIXED_NOW)).toBe("FREE");
  });

  it("business user with active trial → PAID_FULL", () => {
    const stamp = applyOnboardingTrialStamp({ trialStartedAt: null, trialEndsAt: null }, FIXED_NOW);
    const checkTime = new Date(FIXED_NOW.getTime() + 1000);
    expect(resolveAccessTierFn({ trialEndsAt: stamp.trialEndsAt, professionalRole: "business" }, checkTime)).toBe("PAID_FULL");
  });

  it("business user after trial expires → FREE", () => {
    const expiredTrialEndsAt = new Date(FIXED_NOW.getTime() - 1);
    expect(resolveAccessTierFn({ trialEndsAt: expiredTrialEndsAt, professionalRole: "business" }, FIXED_NOW)).toBe("FREE");
  });

  it("ProCare user after trial expires (no active plan) → FREE", () => {
    const expiredTrialEndsAt = new Date(FIXED_NOW.getTime() - 1);
    expect(resolveAccessTierFn({ trialEndsAt: expiredTrialEndsAt, isProCare: true }, FIXED_NOW)).toBe("FREE");
  });
});

// ─── 5. Source scan — auth.session.ts must NOT stamp trial ───────────────────

describe("auth.session.ts source scan — no trial fields in userValues", () => {
  const signupFilePath = path.resolve(__dirname, "../routes/auth.session.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(signupFilePath, "utf-8");
  });

  it("trialStartedAt is NOT assigned in the signup userValues object", () => {
    // The userValues literal block runs from "const userValues: any = {" to its closing "}"
    // We verify the field is absent by checking it doesn't appear before the isBusinessAccount branch
    const userValuesStart = source.indexOf("const userValues: any = {");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    expect(userValuesStart).toBeGreaterThan(0);
    const userValuesBlock = source.slice(userValuesStart, businessBranchIdx);
    expect(userValuesBlock).not.toContain("trialStartedAt:");
  });

  it("trialEndsAt is NOT assigned in the signup userValues object", () => {
    const userValuesStart = source.indexOf("const userValues: any = {");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    const userValuesBlock = source.slice(userValuesStart, businessBranchIdx);
    expect(userValuesBlock).not.toContain("trialEndsAt:");
  });
});

// ─── 6. Source scan — routes.ts complete-onboarding must stamp trial ─────────

describe("routes.ts source scan — trial stamped at onboarding completion", () => {
  const routesFilePath = path.resolve(__dirname, "../../server/routes.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(routesFilePath, "utf-8");
  });

  it("trialStartedAt is stamped inside the complete-onboarding handler", () => {
    const handlerStart = source.indexOf('"/api/user/complete-onboarding"');
    // Find the next handler start (next app.post/app.get) to bound the search
    const handlerEnd = source.indexOf("// Recipe routes", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain("trialStartedAt");
  });

  it("trialEndsAt is stamped inside the complete-onboarding handler", () => {
    const handlerStart = source.indexOf('"/api/user/complete-onboarding"');
    const handlerEnd = source.indexOf("// Recipe routes", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain("trialEndsAt");
  });

  it("existing trialEndsAt is not overwritten (guard clause present)", () => {
    const handlerStart = source.indexOf('"/api/user/complete-onboarding"');
    const handlerEnd = source.indexOf("// Recipe routes", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    // The guard "!existingUser.trialEndsAt" protects the existing window
    expect(handlerBlock).toContain("!existingUser.trialEndsAt");
  });

  it("trialEndsAt is returned in the response JSON", () => {
    const handlerStart = source.indexOf('"/api/user/complete-onboarding"');
    const handlerEnd = source.indexOf("// Recipe routes", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain("trialEndsAt:");
  });
});
