import fs from "node:fs";
import path from "node:path";

const routesSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes.ts"),
  "utf8",
);
const adminSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/admin.ts"),
  "utf8",
);
const zipServiceSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/zipToCoordsService.ts"),
  "utf8",
);

function sourceLine(source: string, marker: string) {
  const line = source.split("\n").find((candidate) => candidate.includes(marker));
  expect(line).toBeDefined();
  return line!;
}

describe("privacy logging remediation source contracts", () => {
  it("keeps blocked-request logs aggregate and correlated without user or food content", () => {
    const line = sourceLine(routesSource, "[SAFETY] Blocked request;");

    expect(line).toContain("result=${safetyCheck.result}");
    expect(line).toContain("blockedTermCount=${safetyCheck.blockedTerms.length}");
    expect(line).toContain("correlationId=${(req as any).id}");
    expect(line).not.toContain("${userId}");
    expect(line).not.toContain("blockedTerms.join");
  });

  it("does not log the overridden allergen or persistent user ID", () => {
    const line = sourceLine(routesSource, "[AllergyOverride] Request-scoped override active;");

    expect(line).toContain("correlationId=${safetyCheck.correlationId}");
    expect(line).not.toContain("overriddenAllergen");
    expect(line).not.toContain("${userId}");
  });

  it("does not log a user ID when allergen adaptation skips its pre-check", () => {
    const line = sourceLine(routesSource, "[AllergenAdapt] Allergen pre-check skipped");

    expect(line).toContain("correlationId=${(req as any).id}");
    expect(line).not.toContain("${userId}");
  });

  it("logs only non-sensitive craving request metadata", () => {
    const line = sourceLine(routesSource, "🎯 Craving creator request:");

    expect(line).toContain("targetMealType");
    expect(line).toContain("servings: validatedServings");
    expect(line).toContain("correlationId: (req as any).id");
    expect(line).not.toContain("cravingInput");
    expect(line).not.toContain("userId");
  });

  it("does not interpolate email or persistent identifiers into administrative logs", () => {
    const line = sourceLine(adminSource, "[admin] grant-founder completed");

    expect(line).not.toContain("userId");
    expect(line).not.toContain("actor.email");
    expect(adminSource).not.toContain("send-password-reset: sent to ${user.email}");
  });

  it("does not interpolate ZIP codes or coordinates into geocoding logs", () => {
    expect(zipServiceSource).not.toContain("ZIP ${zipCode}");
    expect(zipServiceSource).not.toContain("(${coords.lat}, ${coords.lng})");
    expect(zipServiceSource).toContain('console.log("✅ Geocoding completed")');
  });
});