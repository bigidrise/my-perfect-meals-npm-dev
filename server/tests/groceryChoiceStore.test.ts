import { spawnSync } from "node:child_process";

test("real isolated SQL preserves preferences, account isolation, transactions and account erasure", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "server/tests/fixtures/groceryChoiceStore.isolated.mjs"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 30000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).not.toMatch(/DATABASE_URL|OPENAI_API_KEY/);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("ISOLATED_GROCERY_MEMORY_PASSED");
}, 35000);
