import { buildUniversalConditionGuidance } from "../services/universalMedicalGuidance";

describe("universal liver condition guidance", () => {
  const buildFor = (healthConditions: string[]) =>
    buildUniversalConditionGuidance({ userId: "test-user", healthConditions });

  it("maps the saved liver-disease specialty key to strict hepatic guidance", async () => {
    const blocks = await buildFor(["liver-disease"]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("LIVER DISEASE DIETARY PROTOCOL");
    expect(blocks[0]).toContain("NO RAW SHELLFISH");
    expect(blocks[0]).toContain("under 2,000mg sodium per meal");
    expect(blocks[0]).not.toContain("LIVER SUPPORT PROTOCOL — MANDATORY:");
  });

  it("maps the saved liver-support specialty key to existing support guidance", async () => {
    const blocks = await buildFor(["liver-support"]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("LIVER SUPPORT PROTOCOL — MANDATORY:");
    expect(blocks[0]).not.toContain("LIVER DISEASE DIETARY PROTOCOL");
  });

  it("uses the stricter disease block without duplicating guidance when both are saved", async () => {
    const blocks = await buildFor(["liver-support", "liver-disease"]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("LIVER DISEASE DIETARY PROTOCOL");
    expect(blocks[0]).not.toContain("LIVER SUPPORT PROTOCOL — MANDATORY:");
  });
});