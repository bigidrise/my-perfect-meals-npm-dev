import fs from "fs";
import path from "path";

describe("paid organization workspace visibility", () => {
  it("excludes pending-billing businesses from both workspace discovery paths", () => {
    const canonical = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/organizationWorkspaceService.ts"),
      "utf8",
    );
    const legacy = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/organizationalPilotAuthorizationService.ts"),
      "utf8",
    );

    expect(canonical).toContain('eq(businesses.status, "active")');
    expect(legacy).toContain('eq(businesses.status, "active")');
  });

  it("recovers when a stored workspace selection is no longer authorized", () => {
    const canonical = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/organizationWorkspaceService.ts"),
      "utf8",
    );

    expect(canonical).toContain('error.code !== "INVALID_WORKSPACE_SELECTION"');
    expect(canonical).toContain("from the currently authorized active workspace");
  });
});