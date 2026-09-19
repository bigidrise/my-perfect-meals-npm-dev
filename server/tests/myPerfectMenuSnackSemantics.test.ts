import fs from "fs";
import path from "path";

describe("My Perfect Menu snack semantics", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "server/routes/myPerfectMenu.ts"),
    "utf8",
  );

  it("treats dessert as one valid family without forcing a quota", () => {
    expect(route).toContain("snack is an eating occasion, not a narrow food category");
    expect(route).toContain("Dessert is a normal possible snack family");
    expect(route).toContain("Do not force a dessert or any sweet/savory quota");
  });

  it("uses optional food identity for personalization rather than safety", () => {
    expect(route).toContain("include foodIdentity");
    expect(route).toContain("Use it for personalization and diversity only, never as a safety or nutrition rule");
    expect(route).not.toContain("healthy snack alternatives");
  });

  it("does not impose universal snack macros or tiny portions", () => {
    expect(route).toContain("Do not define appropriateness by a universal calorie range");
    expect(route).toContain("artificially tiny portion");
  });
});