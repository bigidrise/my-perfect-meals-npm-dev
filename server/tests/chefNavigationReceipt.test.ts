jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
import { db } from "../db";
import { PgDialect } from "drizzle-orm/pg-core";
import { recordNavigationPerformed } from "../services/coaching/navigationReceipt";
import { Worker } from "node:worker_threads";
import { join } from "node:path";

test("receipt SQL binds owner, open conversation, exact offered action and original offer expiry", async () => {
  (db.execute as jest.Mock).mockClear().mockResolvedValue({ rows: [{ id: "synthetic-message" }] });
  expect(await recordNavigationPerformed("synthetic-owner", "synthetic-message", "beverage_creator")).toBe(true);
  const query = new PgDialect().sqlToQuery((db.execute as jest.Mock).mock.calls[0][0]);
  for (const fragment of ["c.owner_id =", "c.status = 'open'", "c.specialization = 'corner'",
    "m.role = 'assistant'", "m.created_at >", "IN ('navigation_confirmed', 'direct_navigation')",
    "m.conversation_id = source.conversation_id", "= source.offered_at", "'{presentation,navigation,performedAt}'"]) {
    expect(query.sql).toContain(fragment);
  }
  expect(query.params).toEqual(expect.arrayContaining(["synthetic-owner", "synthetic-message", "beverage_creator"]));
  (db.execute as jest.Mock).mockResolvedValue({ rows: [] });
  expect(await recordNavigationPerformed("other-owner", "synthetic-message", "beverage_creator")).toBe(false);
});

test("real in-memory PostgreSQL rejects foreign owners, wrong destinations, expired offers and pending-only messages", async () => {
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
    expect(result.rejected).toEqual([0, 0, 0, 0]);
    expect(result.updated).toEqual(["preserved", "synthetic-message"]);
    expect(result.state.filter((row: any) => row.performed).map((row: any) => row.id))
      .toEqual(["preserved", "synthetic-message"]);
  } finally { await worker.terminate(); }
}, 30000);
