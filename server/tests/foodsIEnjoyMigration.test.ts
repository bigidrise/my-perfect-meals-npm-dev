import { runFoodsIEnjoyMigration } from "../db/migrations/runFoodsIEnjoyMigration";

describe("Foods I Enjoy boot migration", () => {
  it("runs both column additions in one bounded transaction", async () => {
    const statements: string[] = [];
    const database = {
      transaction: async (callback: (transaction: any) => Promise<void>) => callback({
        execute: async (query: any) => {
          statements.push(String(query.queryChunks?.map((chunk: any) => chunk.value ?? "").join("") ?? query));
        },
      }),
      execute: async () => undefined,
    };

    await runFoodsIEnjoyMigration(database as any);
    expect(statements[0]).toContain("SET LOCAL lock_timeout");
    expect(statements[1]).toContain("SET LOCAL statement_timeout");
    expect(statements.some((statement) => statement.includes("ALTER TABLE users"))).toBe(true);
    expect(statements.some((statement) => statement.includes("ALTER TABLE household_profiles"))).toBe(true);
  });
});