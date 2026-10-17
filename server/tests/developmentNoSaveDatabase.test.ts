import type { Pool } from "pg";
import {
  assertNoDevelopmentTestWrites, createDevelopmentDessertTestClaim,
  createDevelopmentDessertTestDiagnostics, suppressDevelopmentTestPrescriptionWrite,
  withDevelopmentNoSaveDatabase,
} from "../services/myPerfectMenu/developmentNoSave";

function fixture() {
  const clientQuery = jest.fn(async (..._args: any[]) => ({ rows: [{ answer: 1 }] }));
  const release = jest.fn();
  const directQuery = jest.fn(async (..._args: any[]) => ({ rows: [] }));
  const connect = jest.fn(async () => ({ query: clientQuery, release }));
  const pool = { query: directQuery, connect } as unknown as Pool;
  return { pool, clientQuery, directQuery, connect, release };
}

describe("Development no-save database boundary", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
  });
  afterEach(() => {
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it("routes existing pool reads through READ ONLY and always rolls back", async () => {
    const f = fixture();
    await withDevelopmentNoSaveDatabase(f.pool, async state => {
      await f.pool.query("SELECT $1::int AS answer", [1]);
      expect(state.blockedWriteCount).toBe(0);
    });
    expect(f.directQuery).not.toHaveBeenCalled();
    expect(f.clientQuery.mock.calls.map(([text]) => text)).toEqual([
      "BEGIN READ ONLY", "SELECT $1::int AS answer", "ROLLBACK",
    ]);
    expect(f.release).toHaveBeenCalledTimes(1);
    await f.pool.query("SELECT 2");
    expect(f.directQuery).toHaveBeenCalledTimes(1);
    expect(f.directQuery.mock.contexts[0]).toBe(f.pool);
    expect(f.connect.mock.contexts[0]).toBe(f.pool);
  });

  it("preserves query config objects including array-row mode inside the boundary", async () => {
    const f = fixture();
    const config = { text: "SELECT $1::int", values: [1], rowMode: "array" as const };
    await withDevelopmentNoSaveDatabase(f.pool, async () => {
      await f.pool.query(config);
    });
    expect(f.clientQuery.mock.calls[1][0]).toBe(config);
  });

  it("delivers blocked writes and nested connections through callback overloads", async () => {
    const f = fixture();
    await withDevelopmentNoSaveDatabase(f.pool, async state => {
      const queryError = await new Promise<Error>(resolve => {
        f.pool.query("DELETE FROM saved_meals", error => resolve(error));
      });
      expect(queryError).toMatchObject({ code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED" });
      const connectionError = await new Promise<Error | undefined>(resolve => {
        f.pool.connect(error => resolve(error));
      });
      expect(connectionError).toMatchObject({ code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED" });
      expect(state.blockedWriteCount).toBe(2);
    });
    expect(f.directQuery).not.toHaveBeenCalled();
    expect(f.connect).toHaveBeenCalledTimes(1);
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it("records PostgreSQL read-only rejections and still rolls back", async () => {
    const f = fixture();
    await withDevelopmentNoSaveDatabase(f.pool, async state => {
      f.clientQuery.mockRejectedValueOnce(Object.assign(new Error("Read-only fixture"), { code: "25006" }));
      await expect(f.pool.query("SELECT write_function()")).rejects.toMatchObject({ code: "25006" });
      expect(state.blockedWriteCount).toBe(1);
      expect(assertNoDevelopmentTestWrites).toThrow();
    });
    expect(f.clientQuery.mock.calls[f.clientQuery.mock.calls.length - 1][0]).toBe("ROLLBACK");
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and releases on operation failure", async () => {
    const f = fixture();
    await expect(withDevelopmentNoSaveDatabase(f.pool, async () => {
      throw new Error("Synthetic operation failure");
    })).rejects.toThrow("Synthetic operation failure");
    expect(f.clientQuery.mock.calls.map(([text]) => text)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    "UPDATE users SET my_perfect_menu_preferences = '{}'",
    "INSERT INTO meal_board_items DEFAULT VALUES",
    "DELETE FROM saved_meals",
    "WITH changed AS (DELETE FROM users RETURNING *) SELECT * FROM changed",
    "COMMIT", "ROLLBACK", "SET TRANSACTION READ WRITE", "SELECT 1; COMMIT",
    "/* hidden */ UPDATE users SET first_name = 'changed'",
    "SELECT 1; COMMIT; UPDATE users SET first_name = 'changed'",
  ])("blocks persistent or transaction-escaping SQL before execution: %s", async text => {
    const f = fixture();
    await withDevelopmentNoSaveDatabase(f.pool, async state => {
      await expect(f.pool.query(text)).rejects.toMatchObject({
        code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED",
      });
      expect(() => assertNoDevelopmentTestWrites()).toThrow();
      expect(state.blockedWriteCount).toBe(1);
    });
    expect(f.clientQuery.mock.calls.map(([query]) => query)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
  });

  it("cannot acquire a second connection to bypass the read-only transaction", async () => {
    const f = fixture();
    await withDevelopmentNoSaveDatabase(f.pool, async () => {
      await expect(f.pool.connect()).rejects.toMatchObject({
        code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED",
      });
    });
    expect(f.connect).toHaveBeenCalledTimes(1);
  });

  it("does not affect concurrent ordinary requests or later detached work", async () => {
    const f = fixture();
    let resume!: () => void;
    let startDetached!: () => void;
    let detached!: Promise<unknown>;
    const later = new Promise<void>(resolve => { startDetached = resolve; });
    const waiting = new Promise<void>(resolve => { resume = resolve; });
    const readOnly = withDevelopmentNoSaveDatabase(f.pool, async () => {
      detached = (async () => {
        await later;
        return f.pool.query("SELECT 1");
      })();
      await waiting;
    });
    await new Promise(setImmediate);
    expect(suppressDevelopmentTestPrescriptionWrite()).toBe(false);
    await f.pool.query("SELECT 2");
    expect(f.directQuery).toHaveBeenCalledTimes(1);
    resume();
    await readOnly;
    startDetached();
    await expect(detached).rejects.toMatchObject({ code: "DEVELOPMENT_DESSERT_TEST_WRITE_BLOCKED" });
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(f.clientQuery.mock.calls.map(([text]) => text)).toEqual(["BEGIN READ ONLY", "ROLLBACK"]);
  });

  it("suppresses only prescription persistence in the diagnostic context", async () => {
    const f = fixture();
    expect(suppressDevelopmentTestPrescriptionWrite()).toBe(false);
    await withDevelopmentNoSaveDatabase(f.pool, async state => {
      expect(suppressDevelopmentTestPrescriptionWrite()).toBe(true);
      expect(state.suppressedPrescriptionWrites).toBe(1);
      assertNoDevelopmentTestWrites();
    });
    expect(suppressDevelopmentTestPrescriptionWrite()).toBe(false);
  });

  it.each([["production", undefined], ["development", "1"], ["test", undefined]])(
    "cannot activate outside unpublished Development: %s %s", async (mode, deployment) => {
      process.env.NODE_ENV = mode;
      if (deployment) process.env.REPLIT_DEPLOYMENT = deployment;
      const f = fixture(), operation = jest.fn();
      await expect(withDevelopmentNoSaveDatabase(f.pool, operation)).rejects.toMatchObject({ status: 404 });
      expect(f.connect).not.toHaveBeenCalled();
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it("permits only one generation claim even when requests arrive together", () => {
    const claim = createDevelopmentDessertTestClaim();
    claim();
    expect(claim).toThrow(expect.objectContaining({ status: 429 }));
  });

  it("reports only aggregate counts, never generated food text or subject identity", () => {
    const d = createDevelopmentDessertTestDiagnostics();
    d.capture({ stage: "schema", attempt: 1, displayDescriptionRecovered: true });
    d.capture({ stage: "schema", attempt: 1, issues: [{ path: "cuisine", rule: "too_small", phase: "after" }] });
    d.capture({ stage: "completion", attempt: 2, acceptedCount: 3, candidateCount: 4,
      rejectedCount: 1, rejectionCounts: { schema_metadata_failure: 1 } });
    expect(d.summary()).toMatchObject({
      saved: false, acceptedCount: 3, generationRounds: 2,
      displayDescriptionRecoveryCount: 1, schemaIssues: { "cuisine:too_small": 1 },
    });
    expect(Object.keys(d.summary())).not.toEqual(expect.arrayContaining(["concepts", "subject", "userContext"]));
  });
});
