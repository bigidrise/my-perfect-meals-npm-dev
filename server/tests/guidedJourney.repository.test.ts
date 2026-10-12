jest.mock("../db", () => ({ db: { select: jest.fn() } }));
import { db } from "../db";
import { PgDialect } from "drizzle-orm/pg-core";
import { guidedJourneyRepository, GUIDED_JOURNEY_BOARD_READ_LIMIT } from "../services/guidedJourney/repository";

function fixture(records: unknown[]) {
  const chain = {
    from: jest.fn(), where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(async () => records),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  (db.select as jest.Mock).mockReturnValue(chain);
  return chain;
}
test("account adapter selects raw target presence for exactly the actor", async () => {
  const record = { dailyCarbsTarget: null };
  const f = fixture([record]);
  expect(await guidedJourneyRepository.readAccount("actor-one")).toBe(record);
  const query = new PgDialect().sqlToQuery(f.where.mock.calls[0][0]);
  expect(query.params).toEqual(["actor-one"]);
  expect(query.sql).toContain('"users"."id"');
  expect(f.limit).toHaveBeenCalledWith(1);
  expect(f.orderBy).not.toHaveBeenCalled();
});
test("no account row remains null, not a manufactured default", async () => {
  fixture([]);
  expect(await guidedJourneyRepository.readAccount("missing")).toBeNull();
});
test("board adapter is actor-and-namespace isolated with a bounded overflow sentinel", async () => {
  const f = fixture(Array.from({ length: GUIDED_JOURNEY_BOARD_READ_LIMIT + 1 },
    () => ({ weekStartISO: "2026-10-12", boardJSON: {} })));
  const result = await guidedJourneyRepository.readSavedBoards("actor-one", "generalNutrition");
  const query = new PgDialect().sqlToQuery(f.where.mock.calls[0][0]);
  expect(query.params).toEqual(["actor-one", "generalNutrition"]);
  expect(query.sql).toContain('"week_boards"."user_id"');
  expect(query.sql).toContain('"week_boards"."builder_type"');
  expect(f.limit).toHaveBeenCalledWith(101);
  expect(result.records).toHaveLength(100);
  expect(result.hasMore).toBe(true);
});
test("read errors propagate rather than becoming empty or complete evidence", async () => {
  const f = fixture([]);
  f.limit.mockRejectedValue(new Error("database unavailable"));
  await expect(guidedJourneyRepository.readAccount("actor-one")).rejects.toThrow("database unavailable");
  await expect(guidedJourneyRepository.readSavedBoards("actor-one", "generalNutrition"))
    .rejects.toThrow("database unavailable");
});
