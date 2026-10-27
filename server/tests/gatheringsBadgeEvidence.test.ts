import {
  buildGatheringsValidationEvidence, gatheringsProtocolScanInput,
} from "../services/gatheringsValidationEvidence";
import { gatheringsRecipeIdentity, readGatheringsValidationEvidence } from "../../shared/gatheringsValidationEvidence";
import { buildGuestEnvelope, deriveProcedureRules } from "../services/protocolEnvelope";
import { scanGatheringsCourse } from "../services/gatheringsProtocolScan";
jest.mock("../db", () => ({
  db: { select: jest.fn() }, pool: { query: jest.fn(), on: jest.fn() },
}));
const good = {
  name: "Baked Apples", description: "Warm baked apples.", ingredients: [{ name: "apples", amount: 300, unit: "g" }],
  instructions: ["Bake apples until tender."], servings: 6, outcome: "success",
  medicalBadges: ["kosher"],
};
const passed = { passed: true, violations: [], instructionViolations: [], message: "passed" };
it.each(["kosher", "halal", "vegan", "vegetarian"])("attests explicitly supplied %s only after a completed scan", diet => {
  const course = { ...good, medicalBadges: [diet] };
  const evidence = buildGatheringsValidationEvidence(course, passed, [diet]);
  expect(evidence).toMatchObject({
    dietaryBadges: [diet], medicalSuitability: "not_established",
    scope: "ingredient_and_instruction_protocol_scan",
  });
  expect(readGatheringsValidationEvidence({ ...course, validationEvidence: evidence })).toEqual(evidence);
});
it.each([[], undefined, ["cardiac"], [{ condition: "renal", compatible: true }]].map(medicalBadges => ({ medicalBadges })))(
  "never manufactures positive dietary or clinical badges from %j", ({ medicalBadges }) => {
    const evidence = buildGatheringsValidationEvidence({ ...good, medicalBadges }, passed, ["kosher", "halal"]);
    expect(evidence?.dietaryBadges).toEqual([]);
    expect(evidence?.medicalSuitability).toBe("not_established");
  },
);
it.each([
  { passed: false, violations: [], instructionViolations: [] },
  { passed: true },
  { ...passed, instructionViolations: ["unsafe preparation"] },
  { ...passed, violations: [{ term: "pork" }] },
])("does not attest incomplete or failed scan results: %j", scan => {
  expect(buildGatheringsValidationEvidence(good, scan as any, ["kosher"])).toBeNull();
});
it("does not attest inactive dietary identities", () => {
  expect(buildGatheringsValidationEvidence(good, passed, ["vegan"])?.dietaryBadges).toEqual([]);
});
it("invalidates cached evidence when recipe, instructions or nutrition evidence changes", () => {
  const original = { ...good, validationEvidence: buildGatheringsValidationEvidence(good, passed, ["kosher"]) };
  expect(readGatheringsValidationEvidence(original)).not.toBeNull();
  for (const update of [
    { instructions: ["Add pork."] }, { ingredients: [{ name: "pork" }] },
    { nutritionResult: { status: "needs_review" } }, { medicalBadges: [] },
    { medicalBadges: undefined }, { _fallback: true }, { outcome: "clinical_withheld" },
    { validationEvidence: { ...original.validationEvidence, version: "old" } },
  ]) expect(readGatheringsValidationEvidence({ ...original, ...update })).toBeNull();
});
it("identity excludes protocol/profile data and diagnostics", () => {
  const base = gatheringsRecipeIdentity(good);
  expect(gatheringsRecipeIdentity({ ...good, profile: "PRIVATE_PROFILE_SENTINEL", _debug: "INTERNAL_PROMPT_SENTINEL" } as any)).toBe(base);
});
it.each([
  ["kosher", "pork"], ["halal", "pork"], ["vegan", "chicken"], ["vegetarian", "chicken"],
])("keeps existing %s rules active for ingredients AND instruction-only %s", (diet, prohibited) => {
  const envelope = { ...buildGuestEnvelope(), dietaryIdentity: [diet], procedural: deriveProcedureRules([diet]) };
  for (const recipe of [
    { ...good, ingredients: [{ name: prohibited }] },
    { ...good, instructions: [`Add ${prohibited} and bake.`] },
  ]) {
    const scan = scanGatheringsCourse(recipe, envelope, { generatorName: "gatherings_badge_test" });
    expect(scan.passed).toBe(false);
    expect(buildGatheringsValidationEvidence(recipe, scan, [diet])).toBeNull();
  }
});
it("keeps existing allergy protection active for ingredients introduced only in cooking instructions", () => {
  const envelope = { ...buildGuestEnvelope(), allergies: ["peanut"] };
  const scan = scanGatheringsCourse({ ...good, instructions: ["Mix in peanut butter."] }, envelope);
  expect(scan.passed).toBe(false);
});
it("does not change the real recipe ingredient list while scanning cooking steps", () => {
  const original = JSON.stringify(good.ingredients);
  expect(gatheringsProtocolScanInput(good).ingredients).toHaveLength(2);
  expect(JSON.stringify(good.ingredients)).toBe(original);
});
