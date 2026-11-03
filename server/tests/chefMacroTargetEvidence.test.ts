// Pure projections only; constructing an application DB/provider would be a regression.
jest.mock("../db", () => ({ db: {}, pool: {} }));
import { buildMemberEvidence } from "../services/coaching/memberContextEvidence";
import { storedMacroNumber, type StoredMacroPrescription } from "../services/coaching/macroTargetEvidence";

const now = new Date("2026-11-03T02:30:00Z");
const day = { localDate: "2026-11-02", timezone: "America/Chicago",
  start: new Date("2026-11-02T06:00:00Z"), end: new Date("2026-11-03T05:59:59.999Z") };
function project(prescription: StoredMacroPrescription | null, protein: number | null = 120) {
  return buildMemberEvidence({
    profile: { daily_protein_target: protein, daily_calorie_target: 1800,
      daily_carbs_target: 180, daily_fat_target: 60, daily_starchy_carbs_target: 90, daily_fibrous_carbs_target: 90 },
    now, day, recordedTimezone: day.timezone, prescription,
  });
}
const current: StoredMacroPrescription = {
  date: day.localDate, target_protein: "125", target_calories: "1700",
  target_total_carbs: "170", target_fat: "60", target_starchy_carbs: "85", target_fibrous_carbs: "85",
  source: "procare", source_version: "synthetic-rationale", updated_at: "2026-11-02T17:00:00Z",
};
test("saved and dated targets are compared, not resolved, with ownership and override uncertainty", () => {
  const evidence = project(current);
  expect(evidence.macroTargets).toMatchObject({
    verifiedCurrentEffective: false, savedBaseOwnership: "unverified",
    professionalOverrideStatus: "unverified", storedPrescriptionCoverage: "complete",
    fields: { protein: { savedBase: 120, storedForDate: 125, relationship: "different" } },
  });
  expect(evidence.prescription).toMatchObject({
    date: day.localDate, source: "procare", sourceVersion: "synthetic-rationale",
    recordedAt: "2026-11-02T17:00:00.000Z", freshness: "not_revalidated",
  });
});
test("matching values do not establish freshness or professional clearance", () => {
  expect(project(current, 125).macroTargets).toMatchObject({
    verifiedCurrentEffective: false, professionalOverrideStatus: "unverified",
    fields: { protein: { relationship: "same" } },
  });
});
test("missing daily evidence retains the saved goal only as a qualified base", () => {
  expect(project(null).macroTargets).toMatchObject({
    storedPrescriptionCoverage: "missing",
    fields: { protein: { savedBase: 120, storedForDate: null, relationship: "saved_base_only" } },
  });
});
test.each([null, "", "bad", "125 grams", "-1", "NaN"])("incomplete/invalid protein never borrows a target: %j", value => {
  const result = project({ ...current, target_protein: value });
  expect(result.macroTargets).toMatchObject({
    storedPrescriptionCoverage: "incomplete",
    fields: { protein: { storedForDate: null, relationship: "saved_base_only" },
      calories: { storedForDate: 1700 } },
  });
});
test("a source-only prescription row is incomplete, not numeric evidence", () => {
  const result = project({ date: day.localDate, source: "macro_calculator" });
  expect(result.macroTargets?.storedPrescriptionCoverage).toBe("incomplete");
  expect(Object.values(result.macroTargets!.fields).every(field => field.storedForDate === null)).toBe(true);
});
test("historical protein is not projected into any current target field", () => {
  const result = project({ ...current, date: "2026-10-01", target_protein: "999" });
  expect(result.macroTargets).toMatchObject({
    storedPrescriptionCoverage: "historical_only",
    fields: { protein: { storedForDate: null, relationship: "saved_base_only" } },
  });
  expect(JSON.stringify(result.macroTargets)).not.toContain("999");
});
test("unknown base and known stored protein remain separately qualified", () => {
  expect(project(current, null).macroTargets?.fields.protein).toEqual({
    savedBase: null, storedForDate: 125, relationship: "stored_only",
  });
  expect(project(null, null).macroTargets?.fields.protein.relationship).toBe("unknown");
});
test("recorded zero and decimal targets retain their actual stored values", () => {
  expect(project({ ...current, target_protein: "0" }, 0).macroTargets?.fields.protein)
    .toEqual({ savedBase: 0, storedForDate: 0, relationship: "same" });
  expect(project({ ...current, target_protein: "120.25" }).macroTargets?.fields.protein.storedForDate).toBe(120.25);
});
test.each([undefined, null, true, {}, [], "", " ", "120g", "Infinity", Number.NaN, -1])(
  "malformed data is unknown rather than a parsed prefix or invented number: %j", value => {
    expect(storedMacroNumber(value)).toBeNull();
  },
);
