import type { Pool } from "pg";

// The unchanged override module owns a housekeeping interval at import time.
// Virtualize ONLY interval scheduling; real setImmediate remains available to
// verify deferred audit behavior. Never leave a real cleanup loop running.
jest.useFakeTimers({
  doNotFake: ["Date", "hrtime", "nextTick", "performance", "queueMicrotask",
    "setImmediate", "clearImmediate", "setTimeout", "clearTimeout"],
});

let mockDevelopmentGate = true;
// Exercise the real boundary without changing any process environment variables.
jest.mock("../../services/snackCompatibilityRepair", () => ({
  developmentSnackRepairEnabled: () => mockDevelopmentGate,
}));

type BoundaryState = { readonly blockedWriteCount: number; readonly suppressedPrescriptionWrites: number };
const boundary = jest.requireActual("../../services/myPerfectMenu/developmentNoSave") as {
  withDevelopmentNoSaveDatabase<T>(pool: Pool, operation: (state: BoundaryState) => Promise<T>): Promise<T>;
  assertNoDevelopmentTestWrites(): void;
  suppressDevelopmentTestPrescriptionWrite(): boolean;
};
const prescription = jest.requireActual("../../services/prescriptionResolver") as {
  resolveDailyNutritionPrescription(input: { userId: string; dateISO: string }): Promise<Record<string, unknown>>;
};
const audit = jest.requireActual("../../lib/auditLog") as {
  logAudit(entry: { actor: string; action: "AI_PROMPT_PHI"; resourceType: string }): void;
};
const overrides = jest.requireActual("../../services/safetyPinService") as {
  logSafetyOverride(userId: string, mealRequest: string, allergen: string, builderId?: string): Promise<void>;
};
const storage = require("./storageStub.cjs") as {
  pool: Pool;
  db: { insert(table: object): { values(value: object): PromiseLike<unknown> } };
  calls: {
    direct: Array<[string, unknown]>; client: Array<[string, unknown]>;
    inserts: number; selects: Array<Record<string, unknown> | undefined>;
    executions: number; connects: number; releases: number;
    clients: string[][];
  };
  state: { rows: unknown[][]; executeRows: unknown[] | null; allowMaterialization: boolean };
  reset(): void;
};

async function verifiedNoSave<T>(operation: (state: BoundaryState) => Promise<T>): Promise<T> {
  return boundary.withDevelopmentNoSaveDatabase(storage.pool, async state => {
    const result = await operation(state);
    boundary.assertNoDevelopmentTestWrites();
    return result;
  });
}
const blocked = { code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED" };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function prescriptionRows() {
  storage.state.rows = [
    [{
      id: "synthetic-owner", planLookupKey: "pro_monthly", selectedMealBuilder: "glp1",
      medicalConditions: ["glp1"], specialtyConditions: ["glp1"],
      dailyCalorieTarget: 2000, dailyProteinTarget: 100, dailyCarbsTarget: 220, dailyFatTarget: 70,
      dailyStarchyCarbsTarget: 143, dailyFibrousCarbsTarget: 77,
      defaultStarchMealsPerDay: 3, starchPlanDefined: true, starchDistributionStrategy: "morning",
      performanceModeEnabled: false, clinicalContextCategories: [], clinicalContextResponse: null,
      weeklyTrainingSchedule: null, performanceProtocolConfig: null, weight: 175,
    }],
    [{ count: 0 }],
    [],
    [{ weight: 175 }],
  ];
  storage.state.executeRows = [{ guardrails: { mealsPerDay: 4, proteinMinG: 35, fatMaxG: 12, maxMealVolumeMl: 300 } }];
}

beforeEach(() => {
  storage.reset();
  mockDevelopmentGate = true;
});
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("real prescription calculation, memory-only storage", () => {
  test("identical calculation and GLP-1 clamps survive suppressed materialization", async () => {
    prescriptionRows();
    storage.state.allowMaterialization = true;
    const input = { userId: "synthetic-owner", dateISO: "2026-10-19" };
    const normal = await prescription.resolveDailyNutritionPrescription(input);
    expect(storage.calls.inserts).toBe(1); // Recorded mock materialization, not a DB write.
    expect(normal).toMatchObject({
      source: "clinical", proteinTarget: 140, fatTarget: 48,
      starchMealsAllowed: 3, starchDistributionStrategy: "morning",
    });
    // Schema projections are honored rather than returning a full user row for every read.
    expect(storage.calls.selects).toContainEqual({ count: expect.anything() });
    storage.reset();
    prescriptionRows();
    const result = await verifiedNoSave(async state => {
      const calculated = await prescription.resolveDailyNutritionPrescription(input);
      expect(state.suppressedPrescriptionWrites).toBe(1);
      expect(state.blockedWriteCount).toBe(0);
      return calculated;
    });
    expect(result).toEqual(normal);
    expect(storage.calls.inserts).toBe(0);
    expect(storage.calls.executions).toBe(1);
    expect(storage.calls.direct).toEqual([]);
    expect(storage.calls.connects).toBe(1); // Synthetic client only.
    expect(storage.calls.releases).toBe(1);
    expect(storage.calls.client[0][0]).toBe("BEGIN READ ONLY");
    expect(storage.calls.client.at(-1)?.[0]).toBe("ROLLBACK");
    expect(boundary.suppressDevelopmentTestPrescriptionWrite()).toBe(false);
  });
});

describe("unexpected writes and swallowed failures", () => {
  test.each([
    "INSERT INTO synthetic_rows DEFAULT VALUES",
    "UPDATE synthetic_rows SET value=1",
    "DELETE FROM synthetic_rows",
    "WITH changed AS (DELETE FROM synthetic_rows RETURNING *) SELECT * FROM changed",
    "/* comment */ INSERT INTO synthetic_rows DEFAULT VALUES",
    "SELECT 1; COMMIT",
    "COMMIT",
    "ROLLBACK",
    "SET TRANSACTION READ WRITE",
    "COPY synthetic_rows TO STDOUT",
    "CALL synthetic_procedure()",
  ])("caught write never becomes verified success: %s", async text => {
    await expect(verifiedNoSave(async () => {
      await storage.pool.query(text).catch(() => undefined);
      return "must-not-escape";
    })).rejects.toMatchObject(blocked);
    expect(storage.calls.client.map(([query]) => query)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
    expect(storage.calls.direct).toEqual([]);
  });
  test("control: the existing helper alone does NOT assert a caught write failure", async () => {
    let observed = 0;
    const result = await boundary.withDevelopmentNoSaveDatabase(storage.pool, async state => {
      await storage.pool.query("INSERT INTO synthetic_rows DEFAULT VALUES").catch(() => undefined);
      observed = state.blockedWriteCount;
      return "unchecked";
    });
    expect(result).toBe("unchecked");
    expect(observed).toBe(1);
    // This is an existing caller obligation, not a shared-service fix or activation proof.
  });
  test("PostgreSQL-style read-only failure from a SELECT function cannot be swallowed into success", async () => {
    await expect(verifiedNoSave(async () => {
      await storage.pool.query("SELECT synthetic_write_function()").catch(() => undefined);
      return "must-not-escape";
    })).rejects.toMatchObject(blocked);
    expect(storage.calls.direct).toEqual([]);
  });
  test("callback write rejection is counted even if its caller ignores the error", async () => {
    await expect(verifiedNoSave(async () => {
      await new Promise<void>(resolve => storage.pool.query("DELETE FROM synthetic_rows", () => resolve()));
      return "must-not-escape";
    })).rejects.toMatchObject(blocked);
    expect(storage.calls.client).toHaveLength(2);
  });
  test("server-side callback read-only errors prevent verified success", async () => {
    // Unlike a syntactically blocked INSERT, a SELECT invoking a write function
    // reaches the synthetic client. The shared helper only observes promise
    // rejections, not a server error delivered through pg's callback overload.
    // The corrected boundary records the server error before invoking the caller.
    await expect(verifiedNoSave(async () => {
      await new Promise<void>(resolve => storage.pool.query("SELECT synthetic_write_function()", error => {
        expect(error).toMatchObject({ code: "25006" });
        resolve(); // Model a legacy caller that swallows the database error.
      }));
      return "must-not-escape";
    })).rejects.toMatchObject(blocked);
  });
  test.each(["text", "values", "config"])("25006 callback overload %s preserves receiver and records before callback", async form => {
    const f = storage.pool;
    await expect(verifiedNoSave(async state => {
      await new Promise<void>(resolve => {
        const callback = function(this: unknown, error: Error) {
          expect(error).toMatchObject({ code: "25006" });
          expect(state.blockedWriteCount).toBe(1);
          resolve();
        };
        if (form === "text") f.query("SELECT synthetic_write_function()", callback);
        else if (form === "values") f.query("SELECT synthetic_write_function()", [], callback);
        else f.query({ text: "SELECT synthetic_write_function()", rowMode: "array" }, callback);
      });
    })).rejects.toMatchObject(blocked);
  });
  test("distinct swallowed server errors count as separate attempts", async () => {
    await expect(verifiedNoSave(async state => {
      await storage.pool.query("SELECT synthetic_write_function()").catch(() => undefined);
      await new Promise<void>(resolve => storage.pool.query("SELECT synthetic_write_function()", () => resolve()));
      expect(state.blockedWriteCount).toBe(2);
    })).rejects.toMatchObject(blocked);
  });
  test("callback receiver, arguments, callback return, query return and scheduling are preserved", async () => {
    const receiver = {};
    const queryReturn = {};
    const result = { rows: [{ synthetic: true }] };
    const events: string[] = [];
    let callbackReturn: unknown;
    const fixturePool = {
      query: jest.fn(),
      connect: async () => ({
        query(text: string, callback?: (...args: unknown[]) => unknown) {
          if (!callback) return Promise.resolve({ rows: [] });
          queueMicrotask(() => {
            callbackReturn = callback.call(receiver, null, result);
          });
          return queryReturn;
        },
        release: jest.fn(),
      }),
    } as unknown as Pool;
    await boundary.withDevelopmentNoSaveDatabase(fixturePool, async state => {
      await new Promise<void>(resolve => {
        const returned = Reflect.apply(fixturePool.query, fixturePool, ["SELECT 1", function(this: unknown, ...args: unknown[]) {
          expect(this).toBe(receiver);
          expect(args).toEqual([null, result]);
          events.push("callback");
          resolve();
          return "original-callback-return";
        }]);
        expect(returned).toBe(queryReturn);
        events.push("query-returned");
      });
      expect(state.blockedWriteCount).toBe(0);
      boundary.assertNoDevelopmentTestWrites();
    });
    expect(callbackReturn).toBe("original-callback-return");
    expect(events).toEqual(["query-returned", "callback"]);
  });
  test("nested connections cannot escape the current read-only transaction", async () => {
    await expect(verifiedNoSave(async () => {
      await storage.pool.connect().catch(() => undefined);
    })).rejects.toMatchObject(blocked);
    expect(storage.calls.connects).toBe(1);
  });
});

describe("real audit and override functions cannot persist", () => {
  test("real deferred audit catches its own error but the completion assertion still denies success", async () => {
    const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await expect(verifiedNoSave(async () => {
        audit.logAudit({ actor: "synthetic-owner", action: "AI_PROMPT_PHI", resourceType: "synthetic_context" });
        await tick(); // Drain the real audit helper's setImmediate inside the guarded context.
        return "must-not-escape";
      })).rejects.toMatchObject(blocked);
      expect(storage.calls.inserts).toBe(1);
      expect(stderr).toHaveBeenCalled();
      expect(storage.calls.client.map(([query]) => query)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
      expect(storage.calls.direct).toEqual([]);
    } finally { stderr.mockRestore(); }
  });
  test("real override audit cannot persist, including when a caller suppresses its rejection", async () => {
    await expect(verifiedNoSave(async () => {
      await overrides.logSafetyOverride("synthetic-owner", "Synthetic request", "synthetic-allergen", "pairings_ai")
        .catch(() => undefined);
      return "must-not-escape";
    })).rejects.toMatchObject(blocked);
    expect(storage.calls.inserts).toBe(1);
    expect(storage.calls.client).toHaveLength(2);
    expect(storage.calls.direct).toEqual([]);
  });
});

describe("detached and concurrent work remains request-isolated", () => {
  test.each(["SELECT 1", "INSERT INTO synthetic_rows DEFAULT VALUES"])(
    "detached work after release cannot execute: %s", async sql => {
      let start!: () => void;
      let pending!: Promise<unknown>;
      const later = new Promise<void>(resolve => { start = resolve; });
      await verifiedNoSave(async () => {
        pending = (async () => { await later; return storage.pool.query(sql); })();
      });
      start();
      await expect(pending).rejects.toMatchObject(blocked);
      expect(storage.calls.client.map(([query]) => query)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
      expect(storage.calls.direct).toEqual([]);
    },
  );
  test("a deferred real audit after return is blocked before the released client or original pool", async () => {
    const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await verifiedNoSave(async () => {
        audit.logAudit({ actor: "synthetic-owner", action: "AI_PROMPT_PHI", resourceType: "synthetic_context" });
      });
      await tick();
      expect(storage.calls.inserts).toBe(1);
      expect(stderr).toHaveBeenCalled();
      expect(storage.calls.client.map(([query]) => query)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
      expect(storage.calls.direct).toEqual([]);
    } finally { stderr.mockRestore(); }
  });
  test("concurrent ordinary requests keep their own query route and prescription behavior", async () => {
    let finish!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    const guarded = verifiedNoSave(async () => {
      expect(boundary.suppressDevelopmentTestPrescriptionWrite()).toBe(true);
      await storage.pool.query("SELECT inside_fixture");
      started();
      await waiting;
    });
    await ready;
    expect(boundary.suppressDevelopmentTestPrescriptionWrite()).toBe(false);
    await storage.pool.query("SELECT concurrent_fixture");
    expect(storage.calls.direct.map(([query]) => query)).toEqual(["SELECT concurrent_fixture"]);
    finish();
    await guarded;
    expect(storage.calls.client.map(([query]) => query)).toEqual([
      "BEGIN READ ONLY", "SELECT inside_fixture", "ROLLBACK",
    ]);
  });
  test("two concurrent synthetic no-save requests retain separate connections", async () => {
    await Promise.all(["first", "second"].map(label => verifiedNoSave(async () => {
      await tick();
      await storage.pool.query(`SELECT '${label}'`);
    })));
    expect(storage.calls.connects).toBe(2);
    expect(storage.calls.releases).toBe(2);
    expect(storage.calls.direct).toEqual([]);
    expect(storage.calls.client.filter(([sql]) => sql === "BEGIN READ ONLY")).toHaveLength(2);
    expect(storage.calls.client.filter(([sql]) => sql === "ROLLBACK")).toHaveLength(2);
    expect(storage.calls.clients).toEqual([
      ["BEGIN READ ONLY", "SELECT 'first'", "ROLLBACK"],
      ["BEGIN READ ONLY", "SELECT 'second'", "ROLLBACK"],
    ]);
  });
  test("closed Development gate rejects before acquiring even a synthetic connection", async () => {
    mockDevelopmentGate = false;
    const operation = jest.fn();
    await expect(verifiedNoSave(operation)).rejects.toMatchObject({ status: 404 });
    expect(operation).not.toHaveBeenCalled();
    expect(storage.calls.connects).toBe(0);
  });
});

describe("no real stores, providers or network initialization", () => {
  test("the override module's housekeeping interval is virtualized, not a live handle", () => {
    expect(jest.getTimerCount()).toBe(1);
  });
  test.each([
    "pg", "postgres", "@neondatabase/serverless", "openai", "@aws-sdk/client-s3",
    "express-session", "connect-pg-simple", "memorystore", "connect-redis",
  ])("%s is denied before module initialization", name => {
    expect(() => require(name)).toThrow("PAIRING_ADVISOR_OFFLINE");
  });
  test("application db imports resolve only to the preinstalled memory fixture", () => {
    expect(require("../../db")).toBe(storage);
    expect(storage.calls.connects).toBe(0);
    expect(storage.calls.direct).toEqual([]);
  });
  test("network operations remain forbidden", () => {
    expect(() => globalThis.fetch("https://example.invalid")).toThrow("PAIRING_ADVISOR_OFFLINE");
    expect(() => require("node:net").connect(443, "example.invalid")).toThrow("PAIRING_ADVISOR_OFFLINE");
  });
});
