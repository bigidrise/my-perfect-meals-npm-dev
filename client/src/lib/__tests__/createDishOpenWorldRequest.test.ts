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

  test("rejects incomplete authoritative selection metadata before constructing intent", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/lifestyle/CreateDishPage.tsx"),
      "utf8",
    );
    const guard = source.indexOf(
      "if (!formSelectionSource || !resolvedTextureSource || !flavorSelectionSource)",
    );
    const intent = source.indexOf('creator: "create_a_dish"', guard);

    expect(guard).toBeGreaterThan(-1);
    expect(intent).toBeGreaterThan(guard);
    expect(source.slice(guard, intent)).toContain(
      'throw new Error("CREATE_DISH_CHOICES_INVALID")',
    );
  });
});