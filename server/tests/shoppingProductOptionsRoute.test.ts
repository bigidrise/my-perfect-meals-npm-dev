/** @jest-environment node */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { canonicalShoppingIngredient } from "../../shared/shoppingProductSelection";

// Exercise the real route registration/handler with synthetic dependencies only.
function productionRoute() {
  const handlers = new Map<string, Function>();
  const shopping = jest.fn().mockResolvedValue({ catalogMatches: [], searched: 0 });
  const generic = jest.fn().mockResolvedValue({ catalogMatches: [] });
  const legacy = jest.fn().mockResolvedValue({ advice: [] });
  const router = { post: (path: string, handler: Function) => handlers.set(path, handler) };
  const source = readFileSync("server/routes/groceryCoach.ts", "utf8");
  const { code } = transformSync(source, {
    loader: "ts", format: "cjs", supported: { "dynamic-import": false },
  });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    process: { env: { NODE_ENV: "production" } },
    require: (name: string) => {
      if (name === "express") return { Router: () => router };
      if (name.endsWith("/shoppingProductSelection")) return { canonicalShoppingIngredient };
      if (name.endsWith("/findShoppingProductRecommendationsDevelopment")) {
        return { findShoppingProductRecommendationsDevelopment: shopping };
      }
      if (name.endsWith("/findProductDevelopment")) return {
        findProductDevelopment: generic,
        ProductSubjectContextUnavailableError: class extends Error {},
      };
      if (name.endsWith("/productAdvisor")) return {
        getProductAdvisorEngine: () => ({ buildCartRecommendations: legacy }),
      };
      return {};
    },
  });
  async function request(body: Record<string, unknown>, authenticated = true) {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    await handlers.get("/product-advisor")!({
      body, authUser: authenticated ? { id: "synthetic-owner" } : undefined,
    }, res);
    return res;
  }
  return { request, shopping, generic, legacy };
}

const input = {
  mode: "find_product", ingredients: ["olive oil"],
  shoppingIngredient: { originalName: "olive oil", requirements: [] },
};

test("Production Product Options dispatches the governed lookup without release flags", async () => {
  const f = productionRoute();
  const res = await f.request(input);
  expect(f.shopping).toHaveBeenCalledWith("synthetic-owner", input.shoppingIngredient);
  expect(f.generic).not.toHaveBeenCalled();
  expect(f.legacy).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ catalogMatches: [] }));
});

test("Production Product Options still requires authentication", async () => {
  const f = productionRoute();
  const res = await f.request(input, false);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(f.shopping).not.toHaveBeenCalled();
});

test.each([
  { ...input, shoppingIngredient: null },
  { ...input, shoppingIngredient: { originalName: "milk", requirements: [] } },
  { ...input, ingredients: ["olive oil", "milk"] },
])("Production rejects invalid or substituted original ingredients", async body => {
  const f = productionRoute();
  const res = await f.request(body);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(f.shopping).not.toHaveBeenCalled();
  expect(f.legacy).not.toHaveBeenCalled();
});

test("unrelated generic Production advisor keeps its existing engine", async () => {
  const f = productionRoute();
  await f.request({ mode: "find_product", ingredients: ["olive oil"] });
  expect(f.shopping).not.toHaveBeenCalled();
  expect(f.generic).not.toHaveBeenCalled();
  expect(f.legacy).toHaveBeenCalledWith("synthetic-owner", ["olive oil"], undefined);
});
