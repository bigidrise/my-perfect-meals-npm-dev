import fs from "fs";
import path from "path";

const sushiSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/SushiCreator.tsx"),
  "utf8",
);
const safetyHookSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/hooks/useSafetyGuardPrecheck.ts"),
  "utf8",
);

describe("Sushi Creator one-action food-governance handoff", () => {
  it("requests an exact sushi_creator acknowledgement for Continue Anyway", () => {
    expect(sushiSource).toContain('`dietary_identity:${dietAlert.diet}`');
    expect(sushiSource).toContain('acknowledgeAdvisory(actionRequest, "sushi_creator", reasonCode)');
    expect(safetyHookSource).toContain('apiUrl("/api/food-governance/acknowledge")');
    expect(safetyHookSource).toContain("body: JSON.stringify({ input, builderId, reasonCode })");
  });

  it("passes the issued token to one generation request and clears client state at handoff", () => {
    expect(sushiSource).toContain("const actionGovernanceToken = governanceOverrideToken;");
    expect(sushiSource).toContain("clearGovernanceOverrideToken();");
    expect(sushiSource).toContain("governanceOverrideToken: actionGovernanceToken");
    expect(sushiSource).not.toContain("userDietOverride,");
    expect(sushiSource).not.toContain("continueAnywayRef");
  });

  it("keeps the adaptation path on the saved dietary identity", () => {
    expect(sushiSource).toContain('decision === "let_chef_adapt"');
    expect(sushiSource).toContain("handleGenerateMeal(true, true)");
  });
});