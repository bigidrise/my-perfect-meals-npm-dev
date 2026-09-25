import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");

function routeBlock(routePath: string): string {
  const start = source.indexOf(`app.post("${routePath}"`);
  if (start < 0) throw new Error(`Route not found: ${routePath}`);
  const nextRoute = source.indexOf("\n  app.", start + 1);
  return source.slice(start, nextRoute < 0 ? source.length : nextRoute);
}

describe("alcohol recommendation route protocol contracts", () => {
  it("resolves protocol identity from authenticated request context, not request body", () => {
    const resolverStart = source.indexOf("async function resolveRecommendationProtocolContext");
    const resolverEnd = source.indexOf("\nfunction recommendationText", resolverStart);
    const resolver = source.slice(resolverStart, resolverEnd);

    expect(resolver).toContain("req.authUser?.id");
    expect(resolver).toContain("loadUserProtocolEnvelope(userId)");
    expect(resolver).toContain("buildGuestEnvelope()");
    expect(resolver).not.toContain("req.body");
  });

  it.each([
    ["/api/recommendations/alcohol", "alcohol_recommendations"],
    ["/api/ai/wine-pairing", "wine_pairing"],
    ["/api/ai/bourbon-spirits-pairing", "bourbon_spirits_pairing"],
  ])("%s puts the resolved protocol in context and scans output before success", (pathName, generator) => {
    const block = routeBlock(pathName);
    expect(block).toContain("resolveRecommendationProtocolContext(req)");
    expect(block).toContain("enforceBeforeGenerate");
    expect(block).toContain(generator);
    expect(block).toContain("scanRecommendationOutput");
    expect(block).toContain('error: "PROTOCOL_VIOLATION"');
    expect(block).toContain("return res.status(400)");
    expect(block.indexOf("scanRecommendationOutput")).toBeLessThan(block.indexOf("res.json("));
  });

  it("scans every returned wine, beer, and spirits recommendation", () => {
    for (const pathName of [
      "/api/recommendations/alcohol",
      "/api/ai/wine-pairing",
    ]) {
      const block = routeBlock(pathName);
      expect(block).toMatch(/for\s*\(const recommendation of Array\.isArray\(result\.recommendations\)/);
      expect(block).toContain("scanRecommendationOutput(recommendation");
    }

    const bourbon = routeBlock("/api/ai/bourbon-spirits-pairing");
    expect(bourbon).toContain("scanRecommendationOutput(result");
  });

  it("uses resolved context for reverse pairing and rejects a recipe conflict", () => {
    const block = routeBlock("/api/ai/meal-pairing");
    expect(block).toContain("resolveRecommendationProtocolContext(req)");
    expect(block).toContain("scanGeneratedOutput(");
    expect(block).toContain("mealPairingEnvelope");
    expect(block).toContain('error: "PROTOCOL_VIOLATION"');
    expect(block.indexOf("scanGeneratedOutput(")).toBeLessThan(block.indexOf("res.json("));
  });
});