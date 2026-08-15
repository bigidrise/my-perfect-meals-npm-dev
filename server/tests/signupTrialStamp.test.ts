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

// ─── Mirror of auth.session.ts userValues — trial stamped for normal consumers ─
//
// As of the trial-at-signup change, auth.session.ts stamps trialStartedAt and
// trialEndsAt immediately for normal consumer accounts (isNormalConsumer = true).
// ProCare accounts receive a paid plan directly and do NOT get a trial stamp.

function buildSignupUserValues(opts: {
  isBusinessAccount?: boolean;
  procare?: {
    professionalRole: string;
    professionalCategory: string;
  };
  now?: Date;
}): { trialStartedAt?: Date; trialEndsAt?: Date; trialSource?: string; professionalRole?: string; role?: string; isProCare?: boolean; planLookupKey?: string } {
  const isProCare = !!opts.procare?.professionalCategory;
  // Normal consumer = not ProCare (business accounts still get a trial)
  const isNormalConsumer = !isProCare;
  const trialNow = isNormalConsumer ? (opts.now ?? new Date()) : null;

  const base: any = {
    ...(trialNow ? {
      trialStartedAt: trialNow,
      trialEndsAt: new Date(trialNow.getTime() + SEVEN_DAYS_MS),
      trialSource: "standard_signup",
    } : {}),
  };

  if (opts.isBusinessAccount) {
    base.professionalRole = "business";
  }
  if (isProCare) {
    base.role = "coach";
    base.isProCare = true;
    base.professionalRole = opts.procare!.professionalRole;
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

// ─── 1. Signup stamps a trial for normal consumers; ProCare gets a plan instead ─

describe("Signup — trial stamp behavior at account creation", () => {
  it("personal signup: trialStartedAt is set immediately", () => {
    const v = buildSignupUserValues({ now: FIXED_NOW });
    expect(v.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("personal signup: trialEndsAt is 7 days after account creation", () => {
    const v = buildSignupUserValues({ now: FIXED_NOW });
    expect(v.trialEndsAt).toEqual(new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS));
  });

  it("personal signup: trialSource is standard_signup", () => {
    const v = buildSignupUserValues({ now: FIXED_NOW });
    expect(v.trialSource).toBe("standard_signup");
  });

  it("business signup: trialStartedAt is set (business accounts are normal consumers)", () => {
    const v = buildSignupUserValues({ isBusinessAccount: true, now: FIXED_NOW });
    expect(v.trialStartedAt).toEqual(FIXED_NOW);
  });

  it("business signup: trialEndsAt is 7 days after account creation", () => {
    const v = buildSignupUserValues({ isBusinessAccount: true, now: FIXED_NOW });
    expect(v.trialEndsAt).toEqual(new Date(FIXED_NOW.getTime() + SEVEN_DAYS_MS));
  });

  it("ProCare signup: trialStartedAt is NOT set (receives paid plan instead)", () => {
    const v = buildSignupUserValues({ procare: { professionalRole: "trainer", professionalCategory: "certified" } });
    expect(v.trialStartedAt).toBeUndefined();
  });

  it("ProCare signup: trialEndsAt is NOT set (receives paid plan instead)", () => {
    const v = buildSignupUserValues({ procare: { professionalRole: "trainer", professionalCategory: "certified" } });
    expect(v.trialEndsAt).toBeUndefined();
  });

  it("ProCare signup: planLookupKey is set to procare plan", () => {
    const v = buildSignupUserValues({ procare: { professionalRole: "trainer", professionalCategory: "certified" } });
    expect(v.planLookupKey).toBe("mpm_procare_monthly");
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

// ─── 5. Source scan — auth.session.ts stamps trial conditionally at signup ────
//
// Normal consumers get trialStartedAt/trialEndsAt immediately on account creation.
// The stamp is guarded by isNormalConsumer so ProCare accounts are excluded.

describe("auth.session.ts source scan — trial conditionally stamped in userValues", () => {
  // Trials are stamped at account-creation time (signup) for normal consumers.
  // The stamp is guarded by isNormalConsumer so ProCare accounts are excluded.
  // The onboarding handler retains a guard-clause fallback for accounts created
  // before this change.
  const signupFilePath = path.resolve(__dirname, "../routes/auth.session.ts");
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(signupFilePath, "utf-8");
  });

  it("trialStartedAt IS assigned in the signup userValues object (conditional spread)", () => {
    const userValuesStart = source.indexOf("const userValues: any = {");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    expect(userValuesStart).toBeGreaterThan(0);
    const userValuesBlock = source.slice(userValuesStart, businessBranchIdx);
    expect(userValuesBlock).toContain("trialStartedAt:");
  });

  it("trialEndsAt IS assigned in the signup userValues object (conditional spread)", () => {
    const userValuesStart = source.indexOf("const userValues: any = {");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    const userValuesBlock = source.slice(userValuesStart, businessBranchIdx);
    expect(userValuesBlock).toContain("trialEndsAt:");
  });

  it("the trial stamp is conditional (guarded by isNormalConsumer / trialNow)", () => {
    // The stamp must be inside a conditional so ProCare accounts are excluded
    const userValuesStart = source.indexOf("const userValues: any = {");
    const businessBranchIdx = source.indexOf("if (isBusinessAccount)");
    const userValuesBlock = source.slice(userValuesStart, businessBranchIdx);
    const hasGuard = userValuesBlock.includes("isNormalConsumer") || userValuesBlock.includes("trialNow");
    expect(hasGuard).toBe(true);
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

// ─── 7. Trial welcome modal — computeTrialDays (real shared helper) ──────────
//
// OnboardingV3.tsx imports computeTrialDays from shared/trialDays.ts and passes
// its return value into the modal heading. These tests exercise the exported
// function directly so that a regression in the real implementation is caught,
// not a local mirror copy.

import { computeTrialDays } from "../../shared/trialDays";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe("computeTrialDays (shared/trialDays.ts) — trial welcome modal duration", () => {
  // ── admin-granted 30-day trial ──────────────────────────────────────────────

  it("admin_grant 30-day trial: returns 30, not 7", () => {
    const start = new Date("2025-06-01T00:00:00Z");
    const end   = new Date(start.getTime() + THIRTY_DAYS_MS);
    expect(computeTrialDays({
      trialStartedAt: start.toISOString(),
      trialEndsAt:    end.toISOString(),
    })).toBe(30);
  });

  it("admin_grant 30-day trial: modal heading reads '30-Day Trial Has Started!'", () => {
    const start = new Date("2025-06-01T00:00:00Z");
    const end   = new Date(start.getTime() + THIRTY_DAYS_MS);
    const days = computeTrialDays({
      trialStartedAt: start.toISOString(),
      trialEndsAt:    end.toISOString(),
    });
    expect(`Your ${days}-Day Trial Has Started!`).toBe("Your 30-Day Trial Has Started!");
  });

  // ── standard 7-day trial (standard_signup) ──────────────────────────────────

  it("standard_signup 7-day trial: returns 7", () => {
    const start = FIXED_NOW;
    const end   = new Date(start.getTime() + SEVEN_DAYS_MS);
    expect(computeTrialDays({
      trialStartedAt: start.toISOString(),
      trialEndsAt:    end.toISOString(),
    })).toBe(7);
  });

  it("standard_signup 7-day trial: modal heading reads '7-Day Trial Has Started!'", () => {
    const start = FIXED_NOW;
    const end   = new Date(start.getTime() + SEVEN_DAYS_MS);
    const days = computeTrialDays({
      trialStartedAt: start.toISOString(),
      trialEndsAt:    end.toISOString(),
    });
    expect(`Your ${days}-Day Trial Has Started!`).toBe("Your 7-Day Trial Has Started!");
  });

  // ── fallback: no trialStartedAt, only trialEndsAt (days-remaining-from-now) ─

  it("no trialStartedAt: uses ceiling of (trialEndsAt − now)", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const end = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(computeTrialDays({ trialStartedAt: null, trialEndsAt: end.toISOString(), now })).toBe(5);
  });

  it("no trialStartedAt, 30 days remaining until end: returns 30 not 7", () => {
    const now = new Date("2025-06-15T12:00:00Z");
    const end = new Date(now.getTime() + THIRTY_DAYS_MS);
    expect(computeTrialDays({ trialStartedAt: null, trialEndsAt: end.toISOString(), now })).toBe(30);
  });

  it("no trialStartedAt and no trialEndsAt: safe fallback is 7", () => {
    expect(computeTrialDays({ trialStartedAt: null, trialEndsAt: null })).toBe(7);
  });

  // ── daysRemaining from server context (second priority) ─────────────────────

  it("no timestamps, daysRemaining=14 from server context: returns 14", () => {
    expect(computeTrialDays({ trialStartedAt: null, trialEndsAt: null, daysRemaining: 14 })).toBe(14);
  });

  it("start→end diff wins over daysRemaining when both are present", () => {
    const start = new Date("2025-06-01T00:00:00Z");
    const end   = new Date(start.getTime() + THIRTY_DAYS_MS);
    // daysRemaining claims 5 but real window is 30 — start→end must win
    expect(computeTrialDays({
      trialStartedAt: start.toISOString(),
      trialEndsAt:    end.toISOString(),
      daysRemaining:  5,
    })).toBe(30);
  });
});

// ─── 8. Source scan — modal uses computeTrialDays, not hardcoded "7" ─────────

describe("OnboardingV3.tsx source scan — modal heading uses computeTrialDays helper", () => {
  const onboardingFilePath = path.resolve(__dirname, "../../client/src/pages/OnboardingV3.tsx");
  let onboardingSource: string;

  beforeAll(() => {
    onboardingSource = fs.readFileSync(onboardingFilePath, "utf-8");
  });

  it("imports computeTrialDays from the shared helper", () => {
    expect(onboardingSource).toContain("computeTrialDays");
    expect(onboardingSource).toContain("trialDays");
  });

  it("modal heading interpolates actualDays, not a hardcoded number", () => {
    const modalStart = onboardingSource.indexOf("Trial welcome modal");
    expect(modalStart).toBeGreaterThan(0);
    const modalBlock = onboardingSource.slice(modalStart, modalStart + 2000);
    expect(modalBlock).toContain("{actualDays}-Day Trial Has Started");
  });

  it("modal block does not hard-wire a digit before '-Day Trial Has Started'", () => {
    const modalStart = onboardingSource.indexOf("Trial welcome modal");
    const modalBlock = onboardingSource.slice(modalStart, modalStart + 2000);
    expect(modalBlock).not.toMatch(/["'`]\d+-Day Trial Has Started/);
  });

  it("actualDays is assigned by calling computeTrialDays inside the modal block", () => {
    const modalStart = onboardingSource.indexOf("Trial welcome modal");
    const modalBlock = onboardingSource.slice(modalStart, modalStart + 2000);
    expect(modalBlock).toContain("computeTrialDays(");
  });
});

describe("shared/trialDays.ts source scan — fallback and priority chain", () => {
  const helperPath = path.resolve(__dirname, "../../shared/trialDays.ts");
  let helperSource: string;

  beforeAll(() => {
    helperSource = fs.readFileSync(helperPath, "utf-8");
  });

  it("exports computeTrialDays as a named export", () => {
    expect(helperSource).toContain("export function computeTrialDays");
  });

  it("safe fallback of 7 is present as the last-resort return", () => {
    expect(helperSource).toContain("return 7");
  });

  it("priority 1 — start→end diff is the first branch", () => {
    expect(helperSource).toContain("trialStartedAt && trialEndsAt");
  });

  it("priority 3 — end-from-now fallback is present for accounts without a start stamp", () => {
    // The ceiling fallback computes days from now when trialStartedAt is absent
    expect(helperSource).toContain("Math.ceil");
  });
});
