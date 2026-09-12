import fs from "fs";
import path from "path";

describe("organization workspace login routing", () => {
  it("shows the chooser instead of auto-routing a business user", () => {
    const auth = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Auth.tsx"),
      "utf8",
    );
    const workspaceBranch = auth.indexOf('if (mode === "login" && workspaceDecision === "chooser")');
    const workspaceBranchEnd = auth.indexOf(
      '} else if (isBusinessUser && mode === "signup")',
      workspaceBranch,
    );

    expect(workspaceBranch).toBeGreaterThan(-1);
    expect(workspaceBranchEnd).toBeGreaterThan(workspaceBranch);
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).toContain(
      "setShowWorkspaceChooser(true)",
    );
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).not.toContain(
      'setLocation("/business-dashboard")',
    );
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).not.toContain(
      'setLocation("/business/setup")',
    );
  });
});