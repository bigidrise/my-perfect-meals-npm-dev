jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
import { db } from "../db";
import { PgDialect } from "drizzle-orm/pg-core";
import { recordNavigationPerformed } from "../services/coaching/navigationReceipt";
import { navigationContinuityInstructions } from "../services/coaching/conciergeNavigationContinuity";
import { Worker } from "node:worker_threads";
import { join } from "node:path";

test("receipt SQL binds owner, conversation, exact action and original offer across preserved copies", async () => {
  (db.execute as jest.Mock).mockResolvedValue({ rows: [{ id: "synthetic-message" }] });
  expect(await recordNavigationPerformed("synthetic-owner", "synthetic-message", "beverage_creator")).toBe(true);
  const query = new PgDialect().sqlToQuery((db.execute as jest.Mock).mock.calls[0][0]);
  expect(query.sql).toContain("c.owner_id =");
  expect(query.sql).toContain("c.status = 'open'");
  expect(query.sql).toContain("c.specialization = 'corner'");
  expect(query.sql).toContain("m.role = 'assistant'");
  expect(query.sql).toContain("m.created_at >");
  expect(query.sql).toContain("IN ('navigation_confirmed', 'direct_navigation')");
  expect(query.sql).toContain("m.conversation_id = source.conversation_id");
  expect(query.sql).toContain("= source.offered_at");
  expect(query.sql).toContain("'{presentation,navigation,performedAt}'");
  expect(query.params).toContain("synthetic-owner");
  expect(query.params).toContain("synthetic-message");
  expect(query.params).toContain("beverage_creator");
  (db.execute as jest.Mock).mockResolvedValue({ rows: [] });
  expect(await recordNavigationPerformed("other-owner", "synthetic-message", "beverage_creator")).toBe(false);
});

test("real in-memory PostgreSQL preserves owner and offer isolation, including informational copies", async () => {
  (db.execute as jest.Mock).mockClear().mockResolvedValue({ rows: [] });
  await recordNavigationPerformed("synthetic-owner", "synthetic-message", "beverage_creator");
  const query = new PgDialect().sqlToQuery((db.execute as jest.Mock).mock.calls[0][0]);
  const worker = new Worker(join(__dirname, "fixtures/chefNavigationReceipt.worker.cjs"), {
    workerData: { sql: query.sql, params: query.params },
  });
  try {
    const result: any = await new Promise((resolve, reject) => {
      worker.once("message", resolve); worker.once("error", reject);
      worker.once("exit", code => { if (code !== 0) reject(new Error(`SQL worker exited ${code}`)); });
    });
    expect(result.error).toBeUndefined();
    expect(result.rejected).toBe(0);
    expect(result.updated).toEqual(["preserved", "synthetic-message"]);
    expect(result.state.filter((row: any) => row.performed).map((row: any) => row.id))
      .toEqual(["preserved", "synthetic-message"]);
  } finally { await worker.terminate(); }
}, 30000);

test("Production and Development use the same approved continuity instructions", () => {
  expect(navigationContinuityInstructions("production")).toBe(navigationContinuityInstructions("development"));
  expect(navigationContinuityInstructions("development")).toContain("Only performedAt is client-observed route evidence");
});
