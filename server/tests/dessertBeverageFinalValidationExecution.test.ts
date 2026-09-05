import fs from "node:fs";
import path from "node:path";
import { enforceFinalCreatorCandidates } from "../services/humanFoodContext/enforceFinalCreatorCandidates";

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Stage 2E dessert and beverage final enforcement", () => {
  const dessert = read("server/routes/dessert-creator.ts");
  const beverage = read("server/routes/beverage-creator.ts");

  it.each([
    ["dessert", dessert],
    ["beverage", beverage],
  ])("%s resolves one request scope and uses its immutable execution state", (_name, source) => {
    expect(source.match(/createHumanFoodRequestScope\(/g)).toHaveLength(1);
    expect(source).toContain("humanFoodRequestScope.executionState");
    expect(source).toContain("executionState: humanFoodExecutionState");
  });

  it.each([
    ["dessert", dessert, "applyCreatorTransformation(meal, dessertCreatorSystem!", "enforceFinalCreatorCandidates({"],
    ["beverage", beverage, "ensureBeverageDietTitle(meal.name", "enforceFinalCreatorCandidates({"],
  ])("%s gates after final response transformations", (_name, source, transformation, gate) => {
    expect(source.indexOf(transformation)).toBeGreaterThan(-1);
    expect(source.indexOf(gate)).toBeGreaterThan(source.indexOf(transformation));
  });

  it("validates transformed beverage alternatives before returning them", () => {
    const alternativeBlock = beverage.slice(
      beverage.indexOf("async function generateValidatedAlternatives"),
      beverage.indexOf("const MAX_BEVERAGE_ATTEMPTS"),
    );
    expect(alternativeBlock).toContain(
      'validateFinalBeverageCandidate(finalAlternative).outcome !== "pass"',
    );
  });

  it("uses candidate-derived preference evidence rather than copied context values", () => {
    for (const source of [dessert, beverage]) {
      expect(source).toContain("text.includes(field.value.toLowerCase())");
      expect(source).not.toMatch(/cuisine:\s*humanFoodContext\.flavor\.cuisine\.value/);
    }
  });

  it("carries GLP-1 proof into final dessert and beverage evidence", () => {
    expect(dessert).toContain("glp1Compliant: glp1Proof");
    expect(beverage).toContain("glp1Compliant: glp1Proof");
  });

  it("does not claim dessert clinical compliance from the protocol scanner", () => {
    expect(dessert).toContain("clinicalDirectivesCompliant: undefined");
    expect(dessert).not.toMatch(
      /clinicalDirectivesCompliant:\s*[\s\S]{0,160}\?\s*protocolProof\.passed/,
    );
  });

  it("permits only one materially different repair", async () => {
    let repairCalls = 0;
    const result = await enforceFinalCreatorCandidates({
      candidates: [{ name: "Original", state: "repairable" }],
      validate: (candidate) => ({
        validatorVersion: "test",
        authoritativeContextFingerprint: "same-context",
        outcome: candidate.state === "pass" ? "pass" : "repairable",
        findings: [],
        repairInstructions: ["repair"],
        candidateSignature: candidate.name.toLowerCase(),
      }),
      repair: async () => {
        repairCalls += 1;
        return [{ name: "Repaired", state: "pass" }];
      },
    });
    expect(repairCalls).toBe(1);
    expect(result.accepted).toEqual([{ name: "Repaired", state: "pass" }]);
  });

  it("never repairs or returns blocked candidates", async () => {
    const repair = jest.fn(async () => [{ name: "Unsafe", state: "pass" }]);
    const result = await enforceFinalCreatorCandidates({
      candidates: [{ name: "Allergen", state: "blocked" }],
      validate: (candidate) => ({
        validatorVersion: "test",
        authoritativeContextFingerprint: "same-context",
        outcome: candidate.state as "blocked" | "pass",
        findings: [],
        repairInstructions: [],
        candidateSignature: candidate.name.toLowerCase(),
      }),
      repair,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(result.accepted).toEqual([]);
  });
});