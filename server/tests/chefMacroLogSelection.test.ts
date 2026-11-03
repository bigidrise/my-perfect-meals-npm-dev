// Execute the actual generated SELECTs against an in-memory PostgreSQL engine.
// Never import an application database connection or contact a paid provider.
jest.mock("../db", () => ({
  db: { execute: jest.fn() },
  pool: { query: jest.fn(() => { throw new Error("Unexpected application pool"); }) },
}));
jest.mock("../services/glp1/currentMealAuthority", () => ({
  currentGLP1AuthorityEnabled: () => false,
  resolveCurrentGLP1MealAuthority: jest.fn(() => { throw new Error("Unexpected clinical lookup"); }),
}));
jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(() => { throw new Error("Unexpected prescription resolution"); }),
}));
jest.mock("../services/humanFoodContext/resolveHumanFoodContext", () => ({
  resolveHumanFoodContext: jest.fn(() => { throw new Error("Unexpected food resolver"); }),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(() => { throw new Error("Unexpected clinical envelope"); }),
}));
import { Worker } from "node:worker_threads";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { buildCoachingContext } from "../services/coaching/coachingContext";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";
import { resolveCurrentGLP1MealAuthority } from "../services/glp1/currentMealAuthority";
import { resolveHumanFoodContext } from "../services/humanFoodContext/resolveHumanFoodContext";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";

jest.setTimeout(30000);
const originalEnvironment = process.env.NODE_ENV;
const now = new Date("2026-11-03T02:30:00Z");
const owner = "synthetic-macro-owner";
let worker: Worker;
let sequence = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
function memoryQuery(statement: string, params: unknown[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, statement, params });
  });
}
beforeAll(async () => {
  // Node worker avoids Jest's dynamic-import VM limitation. PGlite is already
  // installed; no data directory, application DB, new package or migration.
  worker = new Worker(`
    const { parentPort } = require("node:worker_threads");
    const { PGlite } = require("@electric-sql/pglite");
    const memory = new PGlite();
    parentPort.on("message", async ({ id, statement, params }) => {
      try { parentPort.postMessage({ id, result: await memory.query(statement, params) }); }
      catch (error) { parentPort.postMessage({ id, error: error.message }); }
    });
  `, { eval: true });
  worker.on("message", ({ id, result, error }) => {
    const job = pending.get(id);
    pending.delete(id);
    if (job) error ? job.reject(new Error(error)) : job.resolve(result);
  });
  worker.on("error", error => {
    for (const job of pending.values()) job.reject(error);
    pending.clear();
  });
  await memoryQuery(`CREATE TABLE macro_logs (
    user_id text, at timestamptz, kcal numeric, protein numeric, carbs numeric,
    fat numeric, fiber numeric, source text
  )`);
});
beforeEach(async () => {
  process.env.NODE_ENV = "development";
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  await memoryQuery("TRUNCATE macro_logs");
  (db.execute as jest.Mock).mockImplementation(async query => {
    const { sql, params } = new PgDialect().sqlToQuery(query);
    if (!/^\s*SELECT\b/i.test(sql) || /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|CALL)\b/i.test(sql)) {
      throw new Error("Application queries must be SELECT-only");
    }
    if (sql.includes("FROM users")) {
      expect(params).toContain(owner);
      return { rows: [{ timezone: "America/Chicago", goal_type: "maintain" }] };
    }
    if (sql.includes("FROM macro_logs")) return memoryQuery(sql, params);
    if (/FROM (daily_nutrition_prescriptions|water_logs|ace_daily_checkins)\b/.test(sql)) {
      expect(params).toContain(owner);
      return { rows: [] };
    }
    throw new Error("Unexpected query surface");
  });
});
afterEach(() => {
  expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
  expect(resolveCurrentGLP1MealAuthority).not.toHaveBeenCalled();
  expect(resolveHumanFoodContext).not.toHaveBeenCalled();
  expect(loadUserProtocolEnvelope).not.toHaveBeenCalled();
  jest.useRealTimers();
});
afterAll(async () => {
  process.env.NODE_ENV = originalEnvironment;
  if (worker) await worker.terminate();
});
async function log(protein: number, source = "manual", at = now.toISOString(), userId = owner) {
  await memoryQuery("INSERT INTO macro_logs VALUES ($1,$2,0,$3,0,0,0,$4)", [userId, at, protein, source]);
}
const build = () => buildCoachingContext({ userId: owner, specialization: "corner" });

test("no logs is missing intake, not zero, with unknown completeness", async () => {
  const snapshot = await build();
  expect(snapshot.today.macros.protein).toMatchObject({ value: null, status: "missing" });
  expect(snapshot.today.meals.completeness).toBe("unknown");
});
test("a selected zero-protein log is recorded zero, not missing or full-day consumption", async () => {
  await log(0);
  const snapshot = await build();
  expect(snapshot.today.macros.protein).toMatchObject({ value: 0, status: "zero" });
  expect(snapshot.today.meals.count.value).toBe(1);
  expect(snapshot.today.meals.completeness).toBe("unknown");
});
test("ordinary logs sum when no owner-local locked-day snapshot exists", async () => {
  await log(20); await log(35, "builder");
  expect((await build()).today.macros.protein.value).toBe(55);
});
test("locked-day rows replace ordinary logs rather than being double-counted", async () => {
  await log(20); await log(100, "locked-day"); await log(5, "locked-day");
  const snapshot = await build();
  expect(snapshot.today.macros.protein.value).toBe(105);
  expect(snapshot.today.meals.count.value).toBe(2);
});
test("another account's locked snapshot cannot suppress or contribute to the owner's logs", async () => {
  await log(20); await log(999, "locked-day", now.toISOString(), "synthetic-other");
  expect((await build()).today.macros.protein.value).toBe(20);
});
test("Chicago day boundaries exclude adjacent snapshots and include the current local day", async () => {
  await log(999, "locked-day", "2026-11-02T05:59:59.999Z");
  await log(10, "manual", "2026-11-02T06:00:00Z");
  await log(20, "manual", "2026-11-03T05:59:59.999Z");
  await log(999, "locked-day", "2026-11-03T06:00:00Z");
  const snapshot = await build();
  expect(snapshot.today.macros.protein.value).toBe(30);
  expect(snapshot.memberEvidence?.day.date).toBe("2026-11-02");
});
test.each([[1, "partial"], [2, "complete"]] as const)(
  "logging completeness remains an estimate: %s logs => %s", async (count, completeness) => {
    await log(20, "manual", "2026-11-01T18:00:00Z");
    await log(20, "manual", "2026-11-01T20:00:00Z");
    for (let i = 0; i < count; i++) await log(20);
    const snapshot = await build();
    expect(snapshot.today.meals.completeness).toBe(completeness);
    expect(snapshot.today.macros.protein.value).toBe(count * 20);
  },
);
