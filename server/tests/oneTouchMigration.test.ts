import { runOneTouchMigration } from "../db/migrations/runOneTouchMigration";
import { assertColumnsExist, CRITICAL_COLUMNS } from "../bootstrap/assertColumnsExist";
import { PgDialect } from "drizzle-orm/pg-core";
import fs from "node:fs";
import path from "node:path";

describe("One-Touch history migration", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

  it("adds only the authenticated-user history column with bounded, idempotent DDL", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const database = {
      transaction: async (callback: (transaction: any) => Promise<unknown>) =>
        callback({
          execute: async (query: any) => {
            statements.push(dialect.sqlToQuery(query).sql);
          },
        }),
    };
    await runOneTouchMigration(database as any);
    await runOneTouchMigration(database as any);
    expect(statements).toHaveLength(6);
    for (const batch of [statements.slice(0, 3), statements.slice(3)]) {
      expect(batch[0]).toContain("SET LOCAL lock_timeout");
      expect(batch[1]).toContain("SET LOCAL statement_timeout");
      expect(batch[2]).toMatch(/ALTER TABLE users ADD COLUMN IF NOT EXISTS one_touch_history jsonb/i);
    }
    expect(statements.join("\n")).not.toMatch(/household_profiles|DROP COLUMN|UPDATE\s+users/i);
  });

  it("runs only in the opt-in Production release sequence, independently of the Menu flags", () => {
    const production = read("server/prod.ts");
    const releaseStart = production.indexOf('process.env.RUN_PRODUCTION_RELEASE_MIGRATIONS === "true"');
    const ordinaryStart = production.indexOf("Ordinary startup: recurring release migrations skipped");
    const releaseSequence = production.slice(releaseStart, ordinaryStart);
    expect(releaseStart).toBeGreaterThan(-1);
    expect(ordinaryStart).toBeGreaterThan(releaseStart);
    expect(releaseSequence).toMatch(
      /if \(runReleaseMigrations\) \{[\s\S]*?runBoundedStartupMigration\(\{[\s\S]*?await runNutritionPrioritiesMigration\(database as any\);[\s\S]*?await runOneTouchMigration\(database as any\)/,
    );
    expect(production.match(/await runOneTouchMigration\(/g)).toHaveLength(1);
    expect(releaseSequence).not.toContain("CREATOR_MENU_ENABLED");
    expect(production.slice(ordinaryStart)).not.toContain("await runOneTouchMigration(");
    const development = read("server/index.ts");
    expect(development.match(/await runOneTouchMigration\(/g)).toHaveLength(1);
    expect(development.indexOf("await runOneTouchMigration(dbPre)")).toBeLessThan(
      development.indexOf("await assertColumnsExist(dbColGuard, CRITICAL_COLUMNS)"),
    );
  });

  it("fails readiness if the release-managed column is absent without running DDL on ordinary startup", async () => {
    const production = read("server/prod.ts");
    const historyColumn = CRITICAL_COLUMNS.find(
      (item) => item.table === "users" && item.column === "one_touch_history",
    );
    expect(historyColumn?.migrationMode).toBe("production_release");
    expect(production).toContain("await assertColumnsExist(dbColGuardEarly, CRITICAL_COLUMNS)");
    expect(production).toContain("process.exit(1)");
    await expect(assertColumnsExist(
      { execute: async () => ({ rows: [] }) } as any,
      [historyColumn!],
    )).rejects.toThrow("users.one_touch_history");
    await expect(runOneTouchMigration({
      transaction: async (callback: any) => callback({
        execute: async () => { throw new Error("DDL rejected"); },
      }),
    } as any)).rejects.toThrow("DDL rejected");
  });

  it("keeps direct Menu-history reads and writes out of manual Creators and My Perfect Menu", () => {
    const routes = read("server/routes.ts");
    const manualHandler = routes.slice(
      routes.indexOf("const cravingCreatorHandler ="),
      routes.indexOf('app.use("/api/one-touch-create", oneTouchCreateRouter())'),
    );
    expect(manualHandler).toContain('app.post("/api/meals/craving-creator"');
    expect(manualHandler).not.toMatch(/oneTouchHistory|readOneTouchHistory|appendOneTouchHistory/);
    expect(routes).toContain('app.use("/api/create-a-dish", createDishExpansionRouter)');
    expect(read("server/routes/myPerfectMenu.ts")).not.toMatch(
      /one_touch_history|oneTouchHistory|readOneTouchHistory|appendOneTouchHistory/,
    );
  });
});