import fs from "fs";
import path from "path";

describe("organization workspace login routing", () => {
  it("honors an existing canonical workspace before the legacy business setup check", () => {
    const auth = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/Auth.tsx"),
      "utf8",
    );
    const workspaceBranch = auth.indexOf('if (mode === "login" && organizationWorkspaceAvailable)');
    const workspaceBranchEnd = auth.indexOf(
      '} else if (isBusinessUser && mode === "signup")',
      workspaceBranch,
    );
    const legacyBusinessBranch = auth.indexOf('else if (isBusinessUser && mode === "login")');

    expect(workspaceBranch).toBeGreaterThan(-1);
    expect(workspaceBranchEnd).toBeGreaterThan(workspaceBranch);
    expect(legacyBusinessBranch).toBeGreaterThan(workspaceBranch);
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).toContain(
      "setShowWorkspaceChooser(true)",
    );
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).toContain(
      'setLocation("/business-dashboard")',
    );
    expect(auth.slice(workspaceBranch, workspaceBranchEnd)).not.toContain(
      'setLocation("/business/setup")',
    );
  });
});