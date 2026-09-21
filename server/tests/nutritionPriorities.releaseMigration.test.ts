import fs from "fs";
import path from "path";
import { CRITICAL_COLUMNS } from "../bootstrap/assertColumnsExist";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Nutrition Priorities Production release migration contract", () => {
  const expected = [
    "users.food_inclusion_priorities",
    "household_profiles.food_inclusion_priorities",
    "child_profiles.food_inclusion_priorities",
  ];

  it("marks all three guarded columns as explicit Production release migrations", () => {
    const releaseManaged = CRITICAL_COLUMNS
      .filter((item) => item.migrationMode === "production_release")
      .map((item) => `${item.table}.${item.column}`);
    expect(releaseManaged).toEqual(expected);
  });

  it("uses only nullable idempotent JSONB additions with no backfill or destructive alter", () => {
    const migration = read("server/db/migrations/runNutritionPrioritiesMigration.ts");
    for (const [table, column] of expected.map((value) => value.split("."))) {
      expect(migration).toContain(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} jsonb`,
      );
    }
    expect(migration).not.toMatch(/NOT NULL|DROP COLUMN|UPDATE\s+/i);
  });

  it("keeps Production DDL behind the explicit release flag while ordinary startup still guards readiness", () => {
    const production = read("server/prod.ts");
    expect(production).toContain('process.env.RUN_PRODUCTION_RELEASE_MIGRATIONS === "true"');
    expect(production).toContain("runNutritionPrioritiesMigration(database as any)");
    expect(production).toMatch(/assertColumnsExist\s*\(\s*\w+\s*,\s*CRITICAL_COLUMNS\s*\)/);
  });
});