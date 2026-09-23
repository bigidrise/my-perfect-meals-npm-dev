import { runOneTouchMigration } from "../db/migrations/runOneTouchMigration";
import fs from "node:fs";
import path from "node:path";

describe("One-Touch history migration", () => {
  it("adds only the authenticated-user history column with bounded migration settings", async () => {
    const statements: string[] = [];
    const database = {
      transaction: async (callback: (transaction: any) => Promise<unknown>) =>
        callback({
          execute: async (query: { queryChunks?: unknown[] }) => {
            statements.push(String(query));
          },
        }),
    };
    await runOneTouchMigration(database as any);
    expect(statements).toHaveLength(3);
    const source = fs.readFileSync(
      path.join(process.cwd(), "server/db/migrations/runOneTouchMigration.ts"),
      "utf8",
    );
    expect(source).toContain("one_touch_history");
    expect(source).not.toContain("household_profiles");
  });
});