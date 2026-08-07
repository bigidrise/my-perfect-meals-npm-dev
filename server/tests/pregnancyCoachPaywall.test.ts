/**
 * Pregnancy Coach — paywall guard unit tests
 *
 * Tests the /api/pregnancy/ask paywall in isolation using a minimal Express
 * app that mounts ONLY the pregnancyCoach router. Every test pre-seeds
 * req.authUser so the guard fires before any DB or OpenAI call.
 *
 * Scenarios covered (per the requireClinicalAccess contract):
 *   ✗ FREE user with null planLookupKey  → 403  (null-key bypass must NOT apply to free/expired)
 *   ✗ FREE user with mpm_free key        → 403
 *   ✗ PAID_FULL basic subscriber         → 403
 *   ✗ PAID_FULL premium subscriber       → 403
 *   ✓ PAID_FULL ultimate subscriber      → not 403 (passes paywall; may fail downstream for other reasons)
 *   ✓ PAID_FULL clinical_business_monthly→ not 403
 *   ✓ PAID_FULL + null key (internal)    → not 403 (founder/internal bypass)
 *   ✗ Unauthenticated (no authUser)      → 401
 *   - BILLING_ENFORCED=false             → not 403 (paywall disabled)
 */

import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Express app that:
 *   1. Injects a fake authUser (simulates requireAuth + resolveAccessTier)
 *   2. Mounts the pregnancyCoach router at /api/pregnancy
 *   3. Falls back to a 500 if anything past the paywall throws
 *      (we only care about 401/403 in these tests)
 */
async function buildApp(authUser: Record<string, unknown> | null) {
  const app = express();
  app.use(express.json());

  // Inject authUser the same way requireAuth does
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (authUser !== null) {
      (req as any).authUser = authUser;
      // resolveUserId() inside the route also reads req.session.userId
      (req as any).session = { userId: authUser.id ?? "test-user-id" };
    }
    next();
  });

  // Suppress any post-paywall errors so the test response is clean
  // (DB/OpenAI calls will reject; we don't care about those here)
  const router = (await import("../routes/pregnancyCoach")).default;
  app.use("/api/pregnancy", router);

  // Catch-all error handler so uncaught throws don't hang supertest
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });

  return app;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("POST /api/pregnancy/ask — paywall guard", () => {
  const originalEnv = process.env.BILLING_ENFORCED;

  beforeAll(() => {
    process.env.BILLING_ENFORCED = "true";
  });

  afterAll(() => {
    process.env.BILLING_ENFORCED = originalEnv;
  });

  // ── Unauthenticated ───────────────────────────────────────────────────────

  it("returns 401 when there is no authenticated user", async () => {
    const app = await buildApp(null);
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).toBe(401);
  });

  // ── FREE / expired-trial users (null planLookupKey must NOT grant access) ──

  it("returns 403 for a FREE user with null planLookupKey (expired trial or no plan)", async () => {
    const app = await buildApp({
      id: "free-user",
      accessTier: "FREE",
      planLookupKey: null,
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CLINICAL_REQUIRED");
  });

  it("returns 403 for a FREE user with mpm_free planLookupKey", async () => {
    const app = await buildApp({
      id: "free-user-2",
      accessTier: "FREE",
      planLookupKey: "mpm_free",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CLINICAL_REQUIRED");
  });

  // ── PAID_FULL but below ultimate tier ────────────────────────────────────

  it("returns 403 for a PAID_FULL basic subscriber", async () => {
    const app = await buildApp({
      id: "basic-user",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_basic_monthly",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CLINICAL_REQUIRED");
    expect(res.body.currentTier).toBe("basic");
  });

  it("returns 403 for a PAID_FULL premium subscriber", async () => {
    const app = await buildApp({
      id: "premium-user",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_premium_monthly",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CLINICAL_REQUIRED");
    expect(res.body.currentTier).toBe("premium");
  });

  // ── PAID_FULL ultimate / clinical — should pass paywall ──────────────────

  it("does NOT return 403 for a PAID_FULL ultimate subscriber", async () => {
    const app = await buildApp({
      id: "ultimate-user",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_ultimate_monthly",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    // Paywall passes; downstream may fail (DB/OpenAI unavailable in test env)
    // — we only assert the paywall itself does NOT block.
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it("does NOT return 403 for a clinical_business_monthly subscriber", async () => {
    const app = await buildApp({
      id: "clinical-biz-user",
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  // ── PAID_FULL + null planLookupKey = internal/founder account ────────────

  it("does NOT return 403 for an internal/founder account (PAID_FULL + null planLookupKey)", async () => {
    const app = await buildApp({
      id: "founder-user",
      accessTier: "PAID_FULL",
      planLookupKey: null,
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  // ── BILLING_ENFORCED=false bypasses paywall ───────────────────────────────

  it("does NOT return 403 when BILLING_ENFORCED is false, regardless of plan", async () => {
    process.env.BILLING_ENFORCED = "false";
    const app = await buildApp({
      id: "any-user",
      accessTier: "FREE",
      planLookupKey: "mpm_free",
    });
    const res = await request(app)
      .post("/api/pregnancy/ask")
      .send({ message: "hello" });
    expect(res.status).not.toBe(403);
    // Restore
    process.env.BILLING_ENFORCED = "true";
  });
});

// ── Structural guard-order test ───────────────────────────────────────────────
// Asserts the paywall block in pregnancyCoach.ts:
//   a) checks accessTier !== "PAID_FULL" BEFORE the null-key bypass
//   b) treats non-null planLookupKey as requiring "ultimate" tier

import * as fs from "fs";
import * as path from "path";

describe("pregnancyCoach.ts — paywall guard structure", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(
      path.resolve(__dirname, "../routes/pregnancyCoach.ts"),
      "utf-8"
    );
  });

  it("imports getTierForLookupKey from shared planFeatures", () => {
    expect(src).toMatch(/getTierForLookupKey/);
    expect(src).toMatch(/@shared\/planFeatures|\.\.\/\.\.\/shared\/planFeatures/);
  });

  it("checks accessTier !== PAID_FULL (free-user rejection)", () => {
    expect(src).toMatch(/accessTier\s*!==\s*["']PAID_FULL["']/);
  });

  it("returns 403 CLINICAL_REQUIRED for non-PAID_FULL users", () => {
    expect(src).toMatch(/CLINICAL_REQUIRED/);
  });

  it("null planLookupKey bypass is guarded by PAID_FULL check (guard order)", () => {
    // The PAID_FULL check (indexOf) must appear before the null-key bypass
    const paidFullIdx = src.indexOf('accessTier !== "PAID_FULL"');
    const nullKeyIdx = src.indexOf("null planLookupKey with PAID_FULL");
    expect(paidFullIdx).toBeGreaterThan(-1);
    expect(nullKeyIdx).toBeGreaterThan(-1);
    expect(paidFullIdx).toBeLessThan(nullKeyIdx);
  });

  it("non-null planLookupKey requires ultimate tier", () => {
    expect(src).toMatch(/getTierForLookupKey\(planLookupKey\)/);
    expect(src).toMatch(/tier\s*!==\s*["']ultimate["']/);
  });
});
