import fs from "fs";
import path from "path";

describe("organization workspace login routing", () => {
  it("uses authoritative availability instead of business or Studio inference", () => {
    const auth = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Auth.tsx"),
      "utf8",
    );
    expect(auth).toContain("await fetchWorkspaceAvailability()");
    expect(auth).toContain("shouldShowWorkspaceChooser(availability)");
    expect(auth).not.toContain("hasStudioWorkspaceAccess");
    expect(auth).not.toContain("decideSignInWorkspace");
    expect(auth).not.toContain("hasOrganizationWorkspace");
  });

  it("does not allow chooser callers to force Studio visible", () => {
    const chooser = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/WorkspaceChooser.tsx"),
      "utf8",
    );
    expect(chooser).not.toContain("showStudio");
    expect(chooser).not.toContain("initialAvailability");
    expect(chooser).toContain("availability?.studio.available");
  });
});