/**
 * chefBudgetEnforcement.test.ts
 *
 * Endpoint-level tests for POST /api/meals/chef-budget and the underlying
 * budget enforcement service.
 *
 * The chef-budget endpoint is the server-authoritative per-meal budget
 * resolver — the same logic the /api/meals/generate handler applies before
 * calling the AI. Testing it independently proves:
 *
 *   1. The budget is always computed for req.authUser.id, never body userId.
 *   2. A tampered/different body userId is silently ignored.
 *   3. Resolution failure returns HTTP 503 (fail-closed), not a 200 with
 *      client-supplied macros.
 *   4. Exhausted starch slots produce starchAllowed=false in the response.
 *   5. Clinical ceilings (diabetic carb cap, GLP-1 fat ceiling) are applied.
 *   6. Post-log reduced remaining budget flows through correctly.
 *
 * Strategy: mount only the chefBudget router in a minimal Express app.
 * requireAuth and requireEssentialAccess are mocked so the auth flow
 * does not hit the database. resolveDailyNutritionState is mocked so
 * budget tests run without a database. computeNextMealBudget is intentionally
 * NOT mocked — it is a pure function verified in nutritionStateBudget.test.ts.
 */

import * as fs from "fs";
import * as path from "path";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { buildFallbackPrescription } from "../../shared/dailyNutritionPrescription";
import type { DailyNutritionState } from "../../shared/dailyNutritionPrescription";

// ── Module mocks (hoisted by Jest before any imports) ─────────────────────────

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    // If the test injected an authUser via buildApp, let it through.
    // If authUser is explicitly null (unauthenticated scenario), return 401.
    if ((req as any).__testAuthUser === null) {
      return _res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    if ((req as any).__testAuthUser) {
      (req as any).authUser = (req as any).__testAuthUser;
    }
    next();
  },
  // Exported type shim — not used at runtime in tests
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireEssentialAccess", () => ({
  requireEssentialAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/nutritionStateService", () => ({
  resolveDailyNutritionState: jest.fn(),
  deriveGenerationContext: jest.requireActual("../services/nutritionStateService")
    .deriveGenerationContext,
}));

// ── Imports that rely on the mocks above ─────────────────────────────────────

import { resolveDailyNutritionState as mockResolve } from "../services/nutritionStateService";

const mockResolveDNS = mockResolve as jest.MockedFunction<typeof mockResolve>;

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal Express app with the chefBudget router mounted.
 *
 * @param authUser  The authUser to inject into req — pass null to simulate
 *                  an unauthenticated request (results in 401).
 */
async function buildApp(authUser: Record<string, unknown> | null) {
  const app = express();
  app.use(express.json());

  // Signal to the mocked requireAuth what to do
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).__testAuthUser = authUser;
    next();
  });

  const router = (await import("../routes/chefBudget")).default;
  app.use("/api/meals/chef-budget", router);

  // Generic error handler
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });

  return app;
}

function makeAuthUser(id: string): Record<string, unknown> {
  return { id, planLookupKey: "mpm_ultimate", accessTier: "PAID_FULL", paymentStatus: "PAID_FULL" };
}

/** Build a baseline DailyNutritionState. */
function makeState(overrides: Partial<DailyNutritionState> = {}): DailyNutritionState {
  const prescription = {
    ...buildFallbackPrescription("2026-08-13"),
    source: "user_default" as const,
    caloriesTarget:     2000,
    proteinTarget:       150,
    carbsTarget:         200,
    fatTarget:            67,
    starchyCarbsTarget:  100,
    fibrousCarbsTarget:  100,
    starchMealsAllowed:    2,
    starchMealsUsed:       0,
    starchMealsRemaining:  2,
    starchyCarbsConsumed:  0,
    starchyCarbsRemaining: 100,
    gramsPerRemainingStarchMeal: 50,
  };

  const zeros = {
    calories: 0, protein: 0, totalCarbs: 0,
    starchyCarbs: 0, fibrousCarbs: 0, fat: 0,
    starchMeals: 0, mealCount: 0,
  };

  return {
    date: "2026-08-13",
    resolvedPrescription: prescription,
    consumed: { ...zeros },
    planned:  { ...zeros },
    remaining: {
      calories: 2000, protein: 150, totalCarbs: 200,
      starchyCarbs: 100, fibrousCarbs: 100, fat: 67,
      starchMeals: 2, nonStarchMeals: 2,
    },
    mealPlan: {
      mealsPerDay: 4, mealsConsumed: 0, mealsPlanned: 0, mealsRemaining: 4,
      starchMealsPerDay: 2, starchMealsConsumed: 0, starchMealsPlanned: 0,
      starchMealsRemaining: 2,
      starchDistributionStrategy: "even",
      gramsPerRemainingStarchMeal: 50,
      isZeroStarchDay: false,
    },
    activeConstraints: {
      performanceActive: false,
      glp1Active:        false,
      diabeticActive:    false,
      clinicalActive:    false,
      procareActive:     false,
    },
    ...overrides,
  };
}

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ── 1. Unauthenticated ────────────────────────────────────────────────────────

describe("POST /api/meals/chef-budget — authentication", () => {
  it("returns 401 when there is no authenticated user", async () => {
    const app = await buildApp(null);
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });
    expect(res.status).toBe(401);
  });
});

// ── 2. Successful budget override ─────────────────────────────────────────────

describe("POST /api/meals/chef-budget — successful override", () => {
  it("returns per-meal budget computed from server state (4 meals remaining)", async () => {
    mockResolveDNS.mockResolvedValue(makeState());
    const app = await buildApp(makeAuthUser("user-abc"));

    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    // 2000 kcal ÷ 4 meals = 500 per meal
    expect(res.body.remainingMacros.calories).toBe(500);
    expect(res.body.remainingMacros.protein).toBe(38);   // round(150/4)
    expect(res.body.remainingMacros.carbs).toBe(50);     // 200/4
    expect(res.body.remainingMacros.fat).toBe(17);       // round(67/4)
    expect(res.body.starchAllowed).toBe(true);
  });

  it("resolves state for req.authUser.id — ignores body requestedUserId (tampered userId)", async () => {
    mockResolveDNS.mockResolvedValue(makeState());
    const app = await buildApp(makeAuthUser("real-auth-user"));

    await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", requestedUserId: "tampered-other-user" });

    // The service must be called with the AUTHENTICATED user's ID, not the body one
    expect(mockResolveDNS).toHaveBeenCalledWith("real-auth-user", "2026-08-13");
    expect(mockResolveDNS).not.toHaveBeenCalledWith("tampered-other-user", expect.any(String));
  });
});

// ── 3. Post-log reduced budget ────────────────────────────────────────────────

describe("POST /api/meals/chef-budget — post-log reduced remaining", () => {
  it("returns a smaller budget after one meal is logged (3 meals left)", async () => {
    mockResolveDNS.mockResolvedValue(
      makeState({
        consumed: {
          calories: 500, protein: 38, totalCarbs: 50,
          starchyCarbs: 25, fibrousCarbs: 25, fat: 17,
          starchMeals: 1, mealCount: 1,
        },
        remaining: {
          calories: 1500, protein: 112, totalCarbs: 150,
          starchyCarbs: 75, fibrousCarbs: 75, fat: 50,
          starchMeals: 1, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 1, mealsPlanned: 0, mealsRemaining: 3,
          starchMealsPerDay: 2, starchMealsConsumed: 1, starchMealsPlanned: 0,
          starchMealsRemaining: 1,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: 75,
          isZeroStarchDay: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    expect(res.body.remainingMacros.calories).toBe(500);  // 1500 / 3
    expect(res.body.remainingMacros.protein).toBe(37);    // round(112/3)
    expect(res.body.remainingMacros.carbs).toBe(50);      // 150/3
    expect(res.body.starchAllowed).toBe(true);            // 1 starch slot still remains
  });
});

// ── 4. Exhausted starch-slot gate ─────────────────────────────────────────────

describe("POST /api/meals/chef-budget — exhausted starch gate", () => {
  it("returns starchAllowed=false when both starch slots are used", async () => {
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 1000, protein: 75, totalCarbs: 100,
          starchyCarbs: 30, fibrousCarbs: 70, fat: 34,
          starchMeals: 0, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
          starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
          starchMealsRemaining: 0,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: undefined,
          isZeroStarchDay: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    expect(res.body.starchAllowed).toBe(false);
    expect(res.body.budget.starchyBudget).toBe(0);
    expect(res.body.budget.clinicalNotes).toContain(
      "starch_slots_exhausted_rerouted_to_fibrous",
    );
  });
});

// ── 5. Resolver failure → fail-closed ─────────────────────────────────────────

describe("POST /api/meals/chef-budget — fail-closed on resolver error", () => {
  it("returns 503 when resolveDailyNutritionState throws (DB timeout)", async () => {
    mockResolveDNS.mockRejectedValue(new Error("DB connection timeout"));

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(503);
    expect(res.body.source).toBe("budget_error");
  });

  it("returns 503 when user is not found in DB", async () => {
    mockResolveDNS.mockRejectedValue(new Error("User not found: ghost-user"));

    const app = await buildApp(makeAuthUser("ghost-user"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(503);
    expect(res.body.source).toBe("budget_error");
  });
});

// ── 6. Clinical ceilings ──────────────────────────────────────────────────────

describe("POST /api/meals/chef-budget — clinical ceilings", () => {
  it("applies diabetic carb ceiling (≤35g/meal) and exposes clinical note", async () => {
    mockResolveDNS.mockResolvedValue(
      makeState({
        activeConstraints: {
          performanceActive: false,
          glp1Active: false,
          diabeticActive: true,
          clinicalActive: false,
          procareActive: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", generationContext: "diabetic" });

    expect(res.status).toBe(200);
    // 200g carbs / 4 meals = 50g raw → clamped to 35g diabetic ceiling
    expect(res.body.remainingMacros.carbs).toBe(35);
    expect(res.body.budget.clinicalNotes).toContain("diabetic_carb_ceiling_applied_35g");
  });

  it("applies GLP-1 per-meal fat ceiling (fatTarget ÷ mealsPerDay)", async () => {
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 2000, protein: 150, totalCarbs: 200,
          starchyCarbs: 100, fibrousCarbs: 100, fat: 200, // inflated remaining fat
          starchMeals: 2, nonStarchMeals: 2,
        },
        activeConstraints: {
          performanceActive: false,
          glp1Active: true,
          diabeticActive: false,
          clinicalActive: false,
          procareActive: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", generationContext: "glp1" });

    expect(res.status).toBe(200);
    // fatTarget=67 ÷ 4 meals = 17g ceiling; raw per-meal = round(200/4)=50g → clamped
    expect(res.body.remainingMacros.fat).toBe(17);
    expect(res.body.budget.clinicalNotes).toContain("glp1_per_meal_fat_ceiling_applied");
  });
});

// ── 7. Server starch fields propagated (partial consumption) ─────────────────

describe("POST /api/meals/chef-budget — server starch fields propagated", () => {
  it("returns server-authoritative starch slot count and gram budget", async () => {
    // After one starch meal logged: 1 slot used, 75g starchy carbs consumed
    mockResolveDNS.mockResolvedValue(
      makeState({
        consumed: {
          calories: 500, protein: 38, totalCarbs: 100,
          starchyCarbs: 75, fibrousCarbs: 25, fat: 17,
          starchMeals: 1, mealCount: 1,
        },
        remaining: {
          calories: 1500, protein: 112, totalCarbs: 100,
          starchyCarbs: 25, fibrousCarbs: 75, fat: 50,
          starchMeals: 1, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 1, mealsPlanned: 0, mealsRemaining: 3,
          starchMealsPerDay: 2, starchMealsConsumed: 1, starchMealsPlanned: 0,
          starchMealsRemaining: 1,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: 25,
          isZeroStarchDay: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    // Starch not exhausted — one slot remains
    expect(res.body.starchAllowed).toBe(true);
    // Server-authoritative starch fields must reflect actual remaining, not original allocation
    expect(res.body.starchMealsRemaining).toBe(1);
    expect(res.body.starchyCarbsRemaining).toBe(25);  // 100g - 75g consumed
    expect(res.body.gramsPerRemainingStarchMeal).toBe(25); // 25g for the 1 remaining slot
  });

  it("returns starchyCarbsRemaining=0 when all starchy carbs are consumed", async () => {
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 1000, protein: 75, totalCarbs: 100,
          starchyCarbs: 0, fibrousCarbs: 100, fat: 34,
          starchMeals: 0, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
          starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
          starchMealsRemaining: 0,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: undefined,
          isZeroStarchDay: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    expect(res.body.starchAllowed).toBe(false);
    expect(res.body.starchMealsRemaining).toBe(0);
    expect(res.body.starchyCarbsRemaining).toBe(0);
    expect(res.body.gramsPerRemainingStarchMeal).toBeUndefined();
  });
});

// ── 9. Beverage pipeline bypass closure (structural) ─────────────────────────

describe("unifiedMealPipeline.ts — starch enforcement applied before beverage early-return", () => {
  const pipelineSrc = fs.readFileSync(
    path.resolve(__dirname, "../services/unifiedMealPipeline.ts"),
    "utf-8",
  );

  it("applies forceStarch:false enforcement before the beverageIntent early return", () => {
    // The enforcement block must appear before detectBeverageIntent / beverageIntent check
    const enforceIdx = pipelineSrc.indexOf("forceFiberBased || starchContext?.isZeroStarchDay");
    const beverageIdx = pipelineSrc.indexOf("const beverageIntent = detectBeverageIntent");
    expect(enforceIdx).toBeGreaterThan(-1);
    expect(beverageIdx).toBeGreaterThan(-1);
    expect(enforceIdx).toBeLessThan(beverageIdx);
  });

  it("strips forceStarch before beverage branch when forceFiberBased is set", () => {
    // Must set forceStarch: false when forceFiberBased is true
    expect(pipelineSrc).toMatch(/forceStarch\s*:\s*false/);
  });

  it("passes starchContext and remainingMacros to generateBeverageFromDescription", () => {
    // The call site must forward server-authoritative budget into the beverage pipeline
    const callBlock = pipelineSrc.slice(
      pipelineSrc.indexOf("generateBeverageFromDescription("),
      pipelineSrc.indexOf(");", pipelineSrc.indexOf("generateBeverageFromDescription(")) + 2,
    );
    expect(callBlock).toMatch(/starchContext/);
    expect(callBlock).toMatch(/remainingMacros/);
  });

  it("injects STARCH CONSTRAINT into beverage prompt when forceFiberBased is true", () => {
    // The beverage prompt builder must emit a no-starch instruction when the slot is exhausted
    expect(pipelineSrc).toMatch(/STARCH CONSTRAINT/);
    expect(pipelineSrc).toMatch(/forceFiberBased.*isZeroStarchDay|isZeroStarchDay.*forceFiberBased/);
  });

  it("uses AI-returned starchyCarbs instead of hard-coding zero", () => {
    // Must read nutrition.starchyCarbs from the AI response, not always set starchyCarbs: 0
    const beverageFn = pipelineSrc.slice(
      pipelineSrc.indexOf("async function generateBeverageFromDescription"),
      pipelineSrc.indexOf("export async function generateFromDescriptionUnified"),
    );
    expect(beverageFn).toMatch(/nutrition\.starchyCarbs/);
    // Hard-coded zero must not be assigned unconditionally
    expect(beverageFn).not.toMatch(/starchyCarbs\s*:\s*0,/);
  });
});

// ── 8. forceStarch bypass closure (structural) ───────────────────────────────
//
// The /api/meals/generate handler must strip forceStarch and set
// forceFiberBased=true when the server budget reports no starch slots remain.
// These structural tests read routes.ts source code to assert the invariant is
// present so a future refactor cannot silently re-open the bypass.

describe("routes.ts — forceStarch bypass is closed when starch slots are exhausted", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(__dirname, "../routes.ts"),
    "utf-8",
  );

  it("strips forceStarch to false when chefBudget.starchAllowed is false", () => {
    // The handler must set forceStarch: false in the exhausted-starch branch
    expect(routesSrc).toMatch(/forceStarch\s*:\s*false/);
  });

  it("sets forceFiberBased to true when starch slots are exhausted", () => {
    // forceFiberBased: true prevents auto-starch-from-description in the pipeline
    expect(routesSrc).toMatch(/forceFiberBased\s*:\s*true/);
  });

  it("conditions forceStarch strip on the server starchAllowed flag", () => {
    // The guard must check the server budget — not a client flag.
    // Accepts both negated form (!chefBudget.starchAllowed) and ternary form
    // (chefBudget.starchAllowed ? ... : ...) as both correctly gate on server state.
    const hasNegated  = /!chefBudget\.starchAllowed/.test(routesSrc);
    const hasTernary  = /chefBudget\.starchAllowed\s*\?/.test(routesSrc);
    expect(hasNegated || hasTernary).toBe(true);
  });
});

describe("POST /api/meals/chef-budget — starch gate cannot be bypassed", () => {
  it("returns starchAllowed=false even when body contains forceStarch hint", async () => {
    // The budget endpoint ignores any body fields attempting to force starch —
    // the decision is solely based on server-resolved mealPlan.starchMealsRemaining.
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 800, protein: 60, totalCarbs: 80,
          starchyCarbs: 20, fibrousCarbs: 60, fat: 27,
          starchMeals: 0, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
          starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
          starchMealsRemaining: 0,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: undefined,
          isZeroStarchDay: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      // Client attempts to signal starch should be forced — server must ignore this
      .send({ dateISO: "2026-08-13", forceStarch: true });

    expect(res.status).toBe(200);
    // Server budget always wins over client hint
    expect(res.body.starchAllowed).toBe(false);
    expect(res.body.budget.starchyBudget).toBe(0);
  });

  it("starch gate applies regardless of generationContext", async () => {
    // Even a performance context cannot unlock a starch slot that is exhausted
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 800, protein: 60, totalCarbs: 80,
          starchyCarbs: 20, fibrousCarbs: 60, fat: 27,
          starchMeals: 0, nonStarchMeals: 2,
        },
        mealPlan: {
          mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
          starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
          starchMealsRemaining: 0,
          starchDistributionStrategy: "even",
          gramsPerRemainingStarchMeal: undefined,
          isZeroStarchDay: false,
        },
        activeConstraints: {
          performanceActive: true,
          glp1Active: false, diabeticActive: false,
          clinicalActive: false, procareActive: false,
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", generationContext: "performance_training_day" });

    expect(res.status).toBe(200);
    expect(res.body.starchAllowed).toBe(false);
  });
});

// ── 8. Input validation ───────────────────────────────────────────────────────

describe("POST /api/meals/chef-budget — input validation", () => {
  it("returns 400 for a malformed dateISO", async () => {
    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("defaults to today when dateISO is omitted", async () => {
    mockResolveDNS.mockResolvedValue(makeState());
    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({});
    expect(res.status).toBe(200);
    // Verify the service was called with a valid ISO date (today)
    const calledDate = (mockResolveDNS.mock.calls[0] as any)[1] as string;
    expect(/^\d{4}-\d{2}-\d{2}$/.test(calledDate)).toBe(true);
  });
});

// ── 10. effectiveUserId security (structural) ─────────────────────────────────
//
// Structural tests asserting that routes.ts derives effectiveUserId from the
// authenticated session (req.authUser.id) BEFORE the enforcement gateway and
// profile-strategy DB query for create-with-chef — so a tampered/omitted body
// userId cannot bypass the authenticated user's allergy/religious/protocol enforcement.

describe("routes.ts — effectiveUserId guards safety & profile resolution", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(__dirname, "../routes.ts"),
    "utf-8",
  );

  it("derives effectiveUserId before the enforcement gateway block", () => {
    // effectiveUserId must appear above runEnforcement in source order
    const effectiveIdx = routesSrc.indexOf("const effectiveUserId");
    const enforcementIdx = routesSrc.indexOf("runEnforcement({");
    expect(effectiveIdx).toBeGreaterThan(-1);
    expect(enforcementIdx).toBeGreaterThan(-1);
    expect(effectiveIdx).toBeLessThan(enforcementIdx);
  });

  it("passes effectiveUserId (not body userId) to runEnforcement", () => {
    // Find the runEnforcement block and verify it uses effectiveUserId
    const block = routesSrc.slice(
      routesSrc.indexOf("runEnforcement({"),
      routesSrc.indexOf("});", routesSrc.indexOf("runEnforcement({")) + 3,
    );
    expect(block).toMatch(/userId\s*:\s*effectiveUserId/);
  });

  it("queries nutrition strategy profile with effectiveUserId, not body userId", () => {
    // The nutritionStrategy DB lookup must use eq(users.id, effectiveUserId)
    const strategyBlock = routesSrc.slice(
      routesSrc.indexOf("Auto-enrich nutritionStrategy"),
      routesSrc.indexOf("Auto-enrich nutritionStrategy") + 2000,
    );
    expect(strategyBlock).toMatch(/eq\(users\.id,\s*effectiveUserId\)/);
    // Must NOT use the raw body userId for this query
    expect(strategyBlock).not.toMatch(/eq\(users\.id,\s*userId\)/);
  });

  it("effectiveUserId is pinned to req.authUser.id for create-with-chef", () => {
    // The effectiveUserId expression must reference authUser.id for create-with-chef
    expect(routesSrc).toMatch(/effectiveUserId[\s\S]*?authUser\.id|authUser\.id[\s\S]*?effectiveUserId/);
  });
});
