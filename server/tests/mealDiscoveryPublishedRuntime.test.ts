import fs from "node:fs";
import { transformSync } from "esbuild";

const read = (path: string) => fs.readFileSync(path, "utf8");
const compile = (path: string, development: boolean) => transformSync(read(path), {
  loader: "tsx", format: "esm", minifySyntax: true,
  define: { "import.meta.env.DEV": String(development) },
}).code;

describe.each([true, false])("meal discovery UI with Development=%s", (development) => {
  test("the compiled Find Meals page keeps the account-scoped image optimization", () => {
    expect(compile("client/src/pages/SocialFindMeals.tsx", development))
      .toMatch(/restaurantImageOptimization:\s*(?:true|!0),\s*ownerId:/);
  });

  test("the compiled Fridge page keeps the accessible partial-results explanation and saved notice", () => {
    const output = compile("client/src/pages/fridge-rescue.tsx", development);
    expect(output).toContain('"fridge-partial-results"');
    expect(output).toContain("restoredFridgeRescueNotice(cached.resultNotice,");
    expect(output).toMatch(/generatedAtISO:[\s\S]*?resultNotice\s*[,}]/);
    expect(output).toContain("setResultNotice(fridgeRescueResultNotice(");
  });
});

test("published Fridge generation retains missing-count and accepted-recipe exclusion instructions", () => {
  // Execute only the actual, pure prompt-setup fragment, never the generator or
  // its provider/database dependencies. The production guard used to drop both.
  const source = read("server/services/fridgeRescueGenerator.ts");
  const start = source.indexOf("  const requestedCount =");
  const end = source.indexOf("  const userConditions =", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const setup = new Function("request", "process",
    source.slice(start, end) + "\nreturn { requestedCount, excludedMealBlock };");
  const result = setup({ count: 1, excludedMeals: ["Verified soup"] }, { env: { NODE_ENV: "production" } });
  expect(result.requestedCount).toBe(1);
  expect(result.excludedMealBlock).toContain("Verified soup");
  expect(setup({ count: 99 }, { env: { NODE_ENV: "production" } }).requestedCount).toBe(3);
});
