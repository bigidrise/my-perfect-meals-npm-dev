import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("authenticated startup gating", () => {
  it("does not use an arbitrary app-ready timer", () => {
    const source = read("client/src/App.tsx");
    expect(source).not.toContain("setIsAppReady");
    expect(source).not.toContain("isAppReady");
  });

  it("gates protected routes while auth is unresolved", () => {
    const source = read("client/src/components/AppRouter.tsx");
    expect(source).toContain("if (loading && !isPublicRoute)");
    expect(source).toContain('data-testid="authenticated-startup-loading"');
  });

  it("keeps public routes outside the authenticated startup gate", () => {
    const source = read("client/src/components/AppRouter.tsx");
    expect(source).toContain("isPublicAppRoute");
    expect(source).toContain('"/welcome"');
    expect(source).toContain('"/auth"');
  });
});