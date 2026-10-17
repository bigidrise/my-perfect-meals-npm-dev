import { parseGeneratedMenuCandidates } from "../services/myPerfectMenu/generationContract";
import type { DessertDiagnostic } from "../services/myPerfectMenu/dessertDiagnostics";

const concept = {
  title: "Berry Cheesecake", description: "A set berry cheesecake.",
  primaryIngredients: ["berries", "plain Greek yogurt", "almonds"],
  primaryProtein: "Greek yogurt", produceItems: ["berries"], cuisine: "American",
  dietaryEvidence: [], preparationMethod: "chilled", signature: "berry cheesecake chilled",
  culinaryIdentity: {
    dishForm: "cheesecake", preparationStyle: "chilled", texture: "creamy",
    temperature: "chilled", primaryProteinBase: "Greek yogurt", majorStarchBase: null,
    flavorFamily: "berry", cuisineEvidence: "American", definingComponents: ["berries"],
  },
  foodIdentity: { foodRole: "dessert", polarity: "sweet", formatFamily: "cheesecake" },
};

describe("isolated Development dessert metadata repair", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
  });
  afterEach(() => {
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });
  const parse = (value: unknown, onDiagnostic?: (event: DessertDiagnostic) => void) =>
    parseGeneratedMenuCandidates({ concepts: [value] }, "snack", {
      developmentDessertRepair: true, attempt: 1, onDiagnostic,
    });

  it.each([5, 80, 81, 180])("preserves an already valid %i-character signature", length => {
    const signature = "s".repeat(length);
    const result = parse({ ...concept, signature });
    expect(result.candidates[0].signature).toBe(signature);
    expect(result.metadataRepairCount).toBe(0);
  });
  it.each(["", "abcd", "s".repeat(181), null, undefined])(
    "repairs an invalid signature from existing metadata: %s", signature => {
      const result = parse({ ...concept, signature });
      expect(result.candidates[0].signature).toBe("Berry Cheesecake|Greek yogurt|chilled");
      expect(result.metadataRepairCount).toBe(1);
    },
  );
  it.each(["", "   ", undefined])("normalizes empty protein without inventing protein: %s", primaryProtein => {
    const result = parse({ ...concept, primaryProtein, culinaryIdentity: undefined });
    expect(result.candidates[0].primaryProtein).toBeNull();
    expect(result.candidates[0].culinaryIdentity.primaryProteinBase).toBeNull();
    expect(result.candidates[0].primaryIngredients).toEqual(concept.primaryIngredients);
  });
  it("retains valid claims while discarding malformed advisory evidence", () => {
    const result = parse({ ...concept, dietaryEvidence: ["existing claim", null, { claim: "untrusted" }, "", "x".repeat(101)] });
    expect(result.candidates[0].dietaryEvidence).toEqual(["existing claim"]);
    expect(result.candidates[0].cuisine).toBe(concept.cuisine);
    expect(result.candidates[0].primaryIngredients).toEqual(concept.primaryIngredients);
  });
  it("preserves a valid explicit null protein base when repairing another culinary field", () => {
    const result = parse({
      ...concept, culinaryIdentity: {
        ...concept.culinaryIdentity, primaryProteinBase: null, flavorFamily: undefined,
      },
    });
    expect(result.candidates[0].culinaryIdentity.primaryProteinBase).toBeNull();
    expect(result.candidates[0].primaryProtein).toBe("Greek yogurt");
  });
  it.each([null, {}, "not evidence"])("does not certify malformed evidence: %s", dietaryEvidence => {
    expect(parse({ ...concept, dietaryEvidence }).candidates[0].dietaryEvidence).toEqual([]);
  });
  it.each([undefined, [], ["berries"]])("never invents missing ingredient evidence: %s", primaryIngredients => {
    const result = parse({ ...concept, primaryIngredients });
    expect(result.candidates).toEqual([]);
    expect(result.rejectionCodes.some(code => code.includes("primaryIngredients"))).toBe(true);
  });
  it("does not fabricate cuisine or truncate potentially meaningful descriptions", () => {
    const result = parse({ ...concept, cuisine: "", description: "x".repeat(181) });
    expect(result.candidates).toEqual([]);
    expect(result.rejectionCodes).toEqual(expect.arrayContaining([
      "schema_metadata_failure:concept_0:cuisine",
      "schema_metadata_failure:concept_0:description",
    ]));
  });
  it("reports exact issue paths and repair outcome, never generated content", () => {
    const events: DessertDiagnostic[] = [];
    parse({ ...concept, title: "PRIVATE-CONTENT-CANARY", primaryProtein: "", description: "z".repeat(181) },
      event => events.push(event));
    expect(events[0]).toMatchObject({
      attempt: 1, candidateId: "a1:c1", repairAttempted: true,
      repairSucceeded: false, outcome: "invalid",
    });
    expect(events[0].issues).toEqual(expect.arrayContaining([
      { path: "description", rule: "too_big", phase: "after" },
    ]));
    expect(JSON.stringify(events)).not.toContain("PRIVATE-CONTENT-CANARY");
    expect(JSON.stringify(events)).not.toContain("Greek yogurt");
  });
  it("reports a successful repair separately from final acceptance", () => {
    const events: DessertDiagnostic[] = [];
    parse({ ...concept, signature: "bad" }, event => events.push(event));
    expect(events[0]).toMatchObject({ repairAttempted: true, repairSucceeded: true, outcome: "valid" });
  });
  it("includes food-identity normalization in before/after repair diagnostics", () => {
    const events: DessertDiagnostic[] = [];
    const result = parse({ ...concept, foodIdentity: { foodRole: "incorrect" } }, event => events.push(event));
    expect(result.candidates).toHaveLength(1);
    expect(events[0]).toMatchObject({ repairAttempted: true, repairSucceeded: true });
    expect(events[0].issues?.some(issue => issue.phase === "before" && issue.path === "foodIdentity.foodRole")).toBe(true);
    expect(events[0].issues?.some(issue => issue.phase === "after")).toBe(false);
  });
  it("does not erase valid dessert identity because an optional texture is invalid", () => {
    const result = parse({
      ...concept, title: "Chocolate Delight Cups", description: "A chilled chocolate dessert.",
      foodIdentity: {
        foodRole: "dessert", polarity: "sweet", formatFamily: "pudding_custard",
        preparationStyle: "chilled", texture: "silky",
      },
      culinaryIdentity: { ...concept.culinaryIdentity, dishForm: "pudding cups" },
    });
    expect(result.candidates[0].foodIdentity).toMatchObject({
      foodRole: "dessert", polarity: "sweet", formatFamily: "pudding_custard", preparationStyle: "chilled",
    });
    expect(result.candidates[0].foodIdentity?.texture).toBeUndefined();
    expect(result.metadataRepairCount).toBe(1);
  });
  it.each([["production", undefined], ["development", "1"]])(
    "preserves legacy parsing and emits no diagnostics outside scope: %s %s", (mode, deployed) => {
      process.env.NODE_ENV = mode as string;
      if (deployed === undefined) delete process.env.REPLIT_DEPLOYMENT;
      else process.env.REPLIT_DEPLOYMENT = deployed;
      const spy = jest.fn();
      expect(parse({ ...concept, signature: "bad" }, spy).candidates).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    },
  );
  it("does not opt another shared caller into the repair", () => {
    expect(parseGeneratedMenuCandidates({ concepts: [{ ...concept, signature: "bad" }] }, "snack").candidates).toEqual([]);
  });
});
