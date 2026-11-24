import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const target = pathToFileURL(resolve("server/services/productDiscovery/findShoppingProductRecommendationsDevelopment.ts")).href;
const provider = new URL("./offline-product-options-provider.mjs", import.meta.url).href;

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (url.split("?")[0] !== target) return result;
  const source = typeof result.source === "string" ? result.source : new TextDecoder().decode(result.source);
  const marker = /\bconst ingredient\s*=\s*canonicalShoppingIngredient\(input\);/g;
  if ([...source.matchAll(marker)].length !== 1) throw new Error("Offline provider injection source contract changed; refusing startup.");
  return { ...result, source: source.replace(marker, statement =>
    `options = { ...options, ...await (await import(${JSON.stringify(provider)})).offlineProductOptions(userId, input) };\n  ${statement}`) };
}
