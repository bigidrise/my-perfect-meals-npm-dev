import fs from "fs";
import path from "path";

describe("workspace availability cache policy", () => {
  test("account-specific availability is never served from browser or HTTP cache", () => {
    const route = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/organizationWorkspaceRoutes.ts"),
      "utf8",
    );
    const client = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/lib/workspaceAvailability.ts"),
      "utf8",
    );

    expect(route).toContain(
      'res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate")',
    );
    expect(client).toContain('cache: "no-store"');
  });
});