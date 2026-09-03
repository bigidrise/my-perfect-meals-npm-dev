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
import { computeNextMealBudget } from "../services/nutritionBudget";

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

/** Build a baseline DailyNutritionState matching the current interface. */
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

  return {
    date: "2026-08-13",
    resolvedAt: "2026-08-13T00:00:00.000Z",
    prescription,
    consumed: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0, fibrousCarbs: 0,
      starchMealsLogged: 0,
      mealCount: 0,
    },
    planned: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0,
      starchMealsPlanned: 0,
      reservationCount: 0,
    },
    remaining: {
      calories: 2000, protein: 150, carbs: 200,
      starchyCarbs: 100, fibrousCarbs: 100, fat: 67,
      starchMealsRemaining: 2,
    },
    mealPlanConfig: {
      mealsPerDay: 4,
      starchMealsPerDay: 2,
      starchDistributionStrategy: "even",
    },
    activeConstraints: {
      generationContext: "standard",
      starchSlotsExhausted: false,
      calorieBudgetExhausted: false,
      proteinBudgetMet: false,
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
          calories: 500, protein: 38, carbs: 50,
          starchyCarbs: 25, fibrousCarbs: 25, fat: 17,
          starchMealsLogged: 1, mealCount: 1,
        },
        remaining: {
          calories: 1500, protein: 112, carbs: 150,
          starchyCarbs: 75, fibrousCarbs: 75, fat: 50,
          starchMealsRemaining: 1,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
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
          calories: 1000, protein: 75, carbs: 100,
          starchyCarbs: 30, fibrousCarbs: 70, fat: 34,
          starchMealsRemaining: 0,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
        },
      }),
    );

    const app = await buildApp(makeAuthUser("user-abc"));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    expect(res.status).toBe(200);
    expect(res.body.starchAllowed).toBe(false);
    expect(res.body.budget.starchyCarbsTarget).toBe(0);
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
          generationContext: "diabetic",
          starchSlotsExhausted: false,
          calorieBudgetExhausted: false,
          proteinBudgetMet: false,
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
          calories: 2000, protein: 150, carbs: 200,
          starchyCarbs: 100, fibrousCarbs: 100, fat: 200, // inflated remaining fat
          starchMealsRemaining: 2,
        },
        activeConstraints: {
          generationContext: "glp1",
          starchSlotsExhausted: false,
          calorieBudgetExhausted: false,
          proteinBudgetMet: false,
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
          calories: 500, protein: 38, carbs: 100,
          starchyCarbs: 75, fibrousCarbs: 25, fat: 17,
          starchMealsLogged: 1, mealCount: 1,
        },
        remaining: {
          calories: 1500, protein: 112, carbs: 100,
          starchyCarbs: 25, fibrousCarbs: 75, fat: 50,
          starchMealsRemaining: 1,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
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
          calories: 1000, protein: 75, carbs: 100,
          starchyCarbs: 0, fibrousCarbs: 100, fat: 34,
          starchMealsRemaining: 0,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
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

// ── 12. Unconditional gate enforcement (structural) ────────────────────────────
//
// The starch/clinical gate in /api/meals/generate must fire for every
// authenticated request regardless of:
//   (a) builder type (not just create-with-chef)
//   (b) whether the client supplied a starchContext at all
//
// Previously the gate was gated on `starchContext != null`, which allowed a
// direct builder request with no starchContext to bypass the gate entirely.
// That bypass was closed by removing the condition. These structural tests pin
// the invariant so a future refactor cannot silently re-open it.
//
// The fail-closed contract for resolver errors was also generalised: the old
// code only blocked create-with-chef on failure; other types fell back to
// client-supplied context. The new contract blocks ALL types on failure.

describe("routes.ts — clinical macro ceilings applied to all builder types (structural)", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(__dirname, "../routes.ts"),
    "utf-8",
  );

  it("overrides effectiveRemainingMacros for all types (not gated on create-with-chef)", () => {
    // The old code only overrode remainingMacros for create-with-chef, allowing
    // direct builders to bypass diabetic/GLP-1 clinical ceilings. That guard is
    // now removed — effectiveRemainingMacros is assigned unconditionally.
    //
    // We assert:
    //   (a) The unconditional assignment IS present in the source.
    //   (b) The old create-with-chef guard around remainingMacros is NOT present.
    expect(routesSrc).toMatch(/effectiveRemainingMacros\s*=\s*chefBudget\.remainingMacros/);
    // The guard `if (type === 'create-with-chef')` must not appear adjacent to
    // the remainingMacros assignment — any such block would re-create the bypass.
    const assignIdx = routesSrc.indexOf("effectiveRemainingMacros = chefBudget.remainingMacros");
    expect(assignIdx).toBeGreaterThan(-1);
    const surroundingBlock = routesSrc.slice(
      Math.max(0, assignIdx - 200),
      assignIdx + 50,
    );
    expect(surroundingBlock).not.toMatch(/if\s*\(\s*type\s*===\s*['"]create-with-chef['"]\s*\)/);
  });
});

describe("routes.ts — starch gate fires unconditionally for all builder types", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(__dirname, "../routes.ts"),
    "utf-8",
  );

  it("does not gate budget resolution on starchContext presence", () => {
    // The old bypass was: `starchContext != null` as a condition for resolving.
    // That condition must no longer appear adjacent to the budget block.
    // We look for the specific variable name that guarded the block before.
    expect(routesSrc).not.toMatch(/_shouldResolveBudget\s*=.*starchContext\s*!=\s*null/);
    expect(routesSrc).not.toMatch(/_shouldResolveBudget\s*=.*starchContext\s*!==\s*null/);
  });

  it("does not condition budget resolution on starchContext being truthy", () => {
    // A truthy check on starchContext as the sole resolution guard is the bypass pattern.
    // The gate must apply unconditionally — presence of client context is irrelevant.
    expect(routesSrc).not.toMatch(/resolveChefBudget[\s\S]{0,200}starchContext\s*!=?\s*null/);
  });

  it("fail-closed catch block does not branch on builder type", () => {
    // Old code: `if (type === 'create-with-chef') { return 503 } else { warn + continue }`
    // New code: always return 503, no type branch inside the catch block.
    // Find the BudgetResolver catch block and assert no type branch before the 503.
    const catchStart = routesSrc.indexOf("[BudgetResolver] Resolution failed");
    expect(catchStart).toBeGreaterThan(-1);
    // The block around the error log must not contain a create-with-chef type check
    const catchBlock = routesSrc.slice(
      routesSrc.lastIndexOf("} catch (err) {", catchStart),
      routesSrc.indexOf("source: \"budget_error\"", catchStart) + 30,
    );
    expect(catchBlock).not.toMatch(/type\s*===\s*['"]create-with-chef['"]/);
  });

  it("returns budget_error source on resolver failure for direct builder (structural)", () => {
    // The 503 response object's source field must be present in the catch block.
    // This confirms the fail-closed path emits the standard error envelope shape.
    const catchStart = routesSrc.indexOf("[BudgetResolver] Resolution failed");
    const catchBlock = routesSrc.slice(
      routesSrc.lastIndexOf("} catch (err) {", catchStart),
      routesSrc.indexOf("source: \"budget_error\"", catchStart) + 30,
    );
    expect(catchBlock).toMatch(/source:\s*["']budget_error["']/);
    expect(catchBlock).toMatch(/status\(503\)/);
  });
});

describe("POST /api/meals/chef-budget — starch gate cannot be bypassed", () => {
  it("returns starchAllowed=false even when body contains forceStarch hint", async () => {
    // The budget endpoint ignores any body fields attempting to force starch —
    // the decision is solely based on server-resolved mealPlan.starchMealsRemaining.
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 800, protein: 60, carbs: 80,
          starchyCarbs: 20, fibrousCarbs: 60, fat: 27,
          starchMealsRemaining: 0,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
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
    expect(res.body.budget.starchyCarbsTarget).toBe(0);
  });

  it("starch gate applies regardless of generationContext", async () => {
    // Even a performance context cannot unlock a starch slot that is exhausted
    mockResolveDNS.mockResolvedValue(
      makeState({
        remaining: {
          calories: 800, protein: 60, carbs: 80,
          starchyCarbs: 20, fibrousCarbs: 60, fat: 27,
          starchMealsRemaining: 0,
        },
        mealPlanConfig: {
          mealsPerDay: 4,
          starchMealsPerDay: 2,
          starchDistributionStrategy: "even",
        },
        activeConstraints: {
          generationContext: "performance_training_day",
          starchSlotsExhausted: true,
          calorieBudgetExhausted: false,
          proteinBudgetMet: false,
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


// ── 11. ProCare physician-for-client delegation ────────────────────────────────
//
// When a physician sends proClientId in the body, the server must:
//   (a) Verify the physician has an active care-team relationship with the client
//       via verifyPhysicianClientAccess (clientLink.active=true OR studio membership).
//   (b) If authorized → resolve budget against the CLIENT's DailyNutritionState.
//   (c) If unauthorized → return HTTP 403 with source="access_denied".
//   (d) Body userId / plain clientId (without the proClientId key) must never
//       redirect budget resolution — only server-verified proClientId is trusted.

jest.mock("../services/procareAccessService", () => ({
  verifyPhysicianClientAccess: jest.fn(),
}));

// handleOrgIsolationError is called by the route when verifyPhysicianClientAccess
// throws an OrgIsolationError (cross-org access). Mock it to return a 403 so
// the route-level test can assert the correct status without the real DB.

import { verifyPhysicianClientAccess } from "../services/procareAccessService";

const mockVerifyAccess = verifyPhysicianClientAccess as jest.MockedFunction<
  typeof verifyPhysicianClientAccess
>;

describe("POST /api/meals/chef-budget — ProCare physician delegation", () => {
  beforeEach(() => {
    mockVerifyAccess.mockReset();
  });

  it("returns 403 when proClientId is sent but physician has no active care-team link", async () => {
    mockResolveDNS.mockResolvedValue(makeState());
    mockVerifyAccess.mockResolvedValue(false); // no active care-team relationship

    const physicianId = "physician-user-001";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", proClientId: "unauthorized-client-999" });

    expect(res.status).toBe(403);
    expect(res.body.source).toBe("access_denied");
    // verifyPhysicianClientAccess must have been called with physician + client IDs
    expect(mockVerifyAccess).toHaveBeenCalledWith(physicianId, "unauthorized-client-999");
    // Budget must NOT have been resolved for the unauthorized client
    expect(mockResolveDNS).not.toHaveBeenCalledWith("unauthorized-client-999", expect.any(String));
  });

  it("resolves budget for the client when physician has an active care-team link", async () => {
    // Client has a distinct prescription (2000 kcal) so we can tell whose budget ran.
    mockResolveDNS.mockResolvedValue(
      makeState({
        prescription: {
          ...makeState().prescription,
          caloriesTarget: 2000,
          proteinTarget: 150,
          carbsTarget: 200,
          fatTarget: 67,
        },
        remaining: {
          calories: 2000, protein: 150, carbs: 200,
          starchyCarbs: 130, fibrousCarbs: 70, fat: 67,
          starchMealsRemaining: 3,
        },
      }),
    );
    mockVerifyAccess.mockResolvedValue(true); // authorized

    const physicianId = "physician-user-002";
    const clientId    = "client-user-authorized";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", proClientId: clientId });

    expect(res.status).toBe(200);
    // Budget resolved for the CLIENT, not the physician
    expect(mockResolveDNS).toHaveBeenCalledWith(clientId, "2026-08-13");
    expect(mockResolveDNS).not.toHaveBeenCalledWith(physicianId, expect.any(String));
    // 2000 ÷ 4 meals = 500 kcal per meal
    expect(res.body.remainingMacros.calories).toBe(500);
  });

  it("resolves budget for the physician's own ID when no proClientId is sent", async () => {
    mockResolveDNS.mockResolvedValue(makeState());

    const physicianId = "physician-user-003";
    const app = await buildApp(makeAuthUser(physicianId));
    await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13" });

    // verifyPhysicianClientAccess must not be called at all — no delegation
    expect(mockVerifyAccess).not.toHaveBeenCalled();
    expect(mockResolveDNS).toHaveBeenCalledWith(physicianId, "2026-08-13");
  });

  it("returns 503 (fail-closed) when verifyPhysicianClientAccess throws an unexpected error", async () => {
    // Any error thrown by verifyPhysicianClientAccess that is NOT an OrgIsolationError
    // (e.g. DB timeout, network failure) must fail closed with 503, not leave the
    // request unresolved. The real handleOrgIsolationError returns false for
    // non-OrgIsolationError instances, triggering the explicit 503 branch.
    mockResolveDNS.mockResolvedValue(makeState());
    mockVerifyAccess.mockRejectedValue(new Error("DB connection timeout"));

    const physicianId = "physician-user-005";
    const app = await buildApp(makeAuthUser(physicianId));
    const res = await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", proClientId: "some-client-000" });

    expect(res.status).toBe(503);
    expect(res.body.source).toBe("auth_error");
    // Budget must NOT have been resolved
    expect(mockResolveDNS).not.toHaveBeenCalledWith("some-client-000", expect.any(String));
  });

  it("does NOT delegate budget for a plain clientId body field (wrong key name)", async () => {
    // clientId (without the proClientId key) must never trigger delegation.
    mockResolveDNS.mockResolvedValue(makeState());

    const physicianId = "physician-user-004";
    const app = await buildApp(makeAuthUser(physicianId));
    await request(app)
      .post("/api/meals/chef-budget")
      .send({ dateISO: "2026-08-13", clientId: "sneaky-client-555" });

    expect(mockVerifyAccess).not.toHaveBeenCalled();
    expect(mockResolveDNS).toHaveBeenCalledWith(physicianId, "2026-08-13");
    expect(mockResolveDNS).not.toHaveBeenCalledWith("sneaky-client-555", expect.any(String));
  });
});

describe("chefBudgetService.ts + routes.ts — physician delegation is documented", () => {
  it("routes.ts documents ProCare physician-for-client delegation with care-team authorization", () => {
    const routesSrc = fs.readFileSync(
      path.resolve(__dirname, "../routes.ts"),
      "utf-8",
    );
    // routes.ts must describe the physician delegation behavior near the budget block
    expect(routesSrc).toMatch(/ProCare physician.*client.*delegation|physician.*proClientId.*care.team|verifyPhysicianClientAccess/i);
  });

  it("routes/chefBudget.ts documents that unauthorized proClientId returns 403", () => {
    const budgetSrc = fs.readFileSync(
      path.resolve(__dirname, "../routes/chefBudget.ts"),
      "utf-8",
    );
    expect(budgetSrc).toMatch(/403|access_denied/);
    expect(budgetSrc).toMatch(/verifyPhysicianClientAccess/);
  });
});
