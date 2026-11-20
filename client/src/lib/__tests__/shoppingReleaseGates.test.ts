/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "esbuild";

function loadGate(file: string, env: Record<string, string | boolean>, dependencies = {}) {
  const source = readFileSync(path.resolve(file), "utf8");
  const define = Object.fromEntries(Object.entries(env)
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]));
  const { code } = transformSync(source, { loader: "ts", format: "cjs", define });
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name: string) => {
      if (name !== "@/lib/groceryCoachCatalogGate") throw new Error(`Unexpected dependency: ${name}`);
      return dependencies;
    },
  });
  return module.exports;
}

for (const development of [false, true]) {
  for (const product of [false, true]) {
    for (const catalog of [false, true]) {
      for (const metadata of [false, true]) {
        test(`Product Options configuration: DEV=${development}, product=${product}, catalog=${catalog}, metadata=${metadata}`, () => {
          const env = {
            DEV: development,
            VITE_SHOPPING_PRODUCT_OPTIONS_ENABLED: String(product),
            VITE_GROCERY_CATALOG_PRODUCTION_ENABLED: String(catalog),
            VITE_SHOPPING_METADATA_PRODUCTION_ENABLED: String(metadata),
          };
          const catalogGate = loadGate("client/src/lib/groceryCoachCatalogGate.ts", env);
          const productGate = loadGate("client/src/lib/shoppingProductOptionsGate.ts", env, catalogGate);
          const metadataGate = loadGate("client/src/lib/shoppingMetadataGate.ts", env);
          expect(productGate.shoppingProductOptionsEnabled).toBe(development || (product && catalog));
          expect(metadataGate.shoppingMetadataEnabled).toBe(development || metadata);
        });
      }
    }
  }
}

test.each([
  ["production", undefined, false],
  ["production", "false", false],
  ["production", "true", true],
  ["development", undefined, true],
])("server gate in %s with flag %s returns %s", (mode, flag, enabled) => {
  const source = readFileSync("server/services/shopping-list/productOptionsGate.ts", "utf8");
  const { code } = transformSync(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} as Record<string, any> };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    process: { env: { NODE_ENV: mode, SHOPPING_PRODUCT_OPTIONS_ENABLED: flag } },
  });
  expect(module.exports.shoppingProductOptionsServerEnabled()).toBe(enabled);
});
