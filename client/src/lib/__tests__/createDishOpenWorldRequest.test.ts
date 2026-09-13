import fs from "node:fs";
import path from "node:path";

describe("Create a Dish open-world classification request", () => {
  test("does not disable semantic resolution for catalog misses", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/lifestyle/CreateDishPage.tsx"),
      "utf8",
    );
    const requestStart = source.indexOf('apiUrl("/api/create-a-dish/expand-ingredient")');
    const requestEnd = source.indexOf("});", requestStart);
    const requestSource = source.slice(requestStart, requestEnd);

    expect(requestStart).toBeGreaterThan(-1);
    expect(requestSource).toContain("useAiForGaps: true");
    expect(requestSource).not.toContain("useAiForGaps: false");
  });
});