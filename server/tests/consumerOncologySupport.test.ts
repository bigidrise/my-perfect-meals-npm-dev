jest.mock("../db", () => ({ db: { transaction: jest.fn() } }));
import { db } from "../db";
import { consumerOncologyUpdate, parseConsumerOncologyInput, saveConsumerSpecialtySupport } from "../services/consumerOncologySupport";
import { persistOnboardingHealthInformation } from "../../client/src/lib/onboardingHealthPersistence";

const userId = "test-subject";
const self = {
  enabled: true, symptoms: ["mouth_sensitivity", "nausea"] as any[],
  emphasis: { highProteinNutrientDensity: false },
  source: "self" as const, locked: false, ownerName: null, updatedBy: userId, updatedAt: null,
};

describe("consumer authoritative oncology save", () => {
  test("ON and multiple symptoms create a self-owned canonical context", () => {
    const value = consumerOncologyUpdate(null, ["oncology-support"], { symptoms: ["low_appetite", "nausea", "low_appetite"] }, userId);
    expect(value).toMatchObject({ enabled: true, source: "self", locked: false, symptoms: ["low_appetite", "nausea"] });
  });
  test("None currently is [], not a stored sixth symptom", () => {
    expect(consumerOncologyUpdate(self, ["oncology-support"], { symptoms: [] }, userId)?.symptoms).toEqual([]);
    expect(() => parseConsumerOncologyInput({ symptoms: ["none"] })).toThrow();
  });
  test("OFF retains answers and re-enabling restores them", () => {
    const off = consumerOncologyUpdate(self, [], undefined, userId)!;
    expect(off.enabled).toBe(false);
    expect(off.symptoms).toEqual(self.symptoms);
    const on = consumerOncologyUpdate(off, ["oncology-support"], undefined, userId)!;
    expect(on).toMatchObject({ enabled: true, symptoms: self.symptoms, emphasis: self.emphasis });
  });
  test("cannot submit ownership, emphasis, locked flags, or unknown symptoms", () => {
    for (const input of [{ symptoms: ["headache"] }, { symptoms: [], source: "self" }, { symptoms: [], locked: false }, { symptoms: [], emphasis: {} }]) {
      expect(() => parseConsumerOncologyInput(input)).toThrow();
    }
  });
  test.each([true, false])("physician source is protected even when locked=%s", locked => {
    const physician = { ...self, source: "physician" as const, locked };
    expect(() => consumerOncologyUpdate(physician, ["oncology-support"], { symptoms: [] }, userId)).toThrow("care team");
    expect(() => consumerOncologyUpdate(physician, [], undefined, userId)).toThrow("care team");
    expect(consumerOncologyUpdate(physician, ["oncology-support", "renal"], undefined, userId)).toBe(physician);
  });
  test("locked or unverified ownership never becomes self-owned", () => {
    expect(() => consumerOncologyUpdate({ ...self, locked: true }, [], undefined, userId)).toThrow();
    expect(() => consumerOncologyUpdate({ ...self, source: undefined } as any, ["oncology-support"], { symptoms: [] }, userId)).toThrow();
  });
  test("real frontend save contract → transactional writer → reload → central refresh", async () => {
    let record: any = null;
    const writes: any[] = [];
    const lockedRead = jest.fn(async () => [{ context: record }]);
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: lockedRead }) }) }) }),
      update: () => ({ set: (value: any) => ({ where: async () => { writes.push(value); record = value.oncologySupportContext; } }) }),
    };
    (db.transaction as jest.Mock).mockImplementation(async fn => fn(tx));
    const refreshUser = jest.fn(async () => ({ oncologySupportContext: record }));
    const patch = jest.fn(async (_path: string, body: any) => {
      await saveConsumerSpecialtySupport(userId, body.conditions, body.oncologySupport);
      return { ok: true };
    });
    await persistOnboardingHealthInformation({
      medicalConditions: ["None"], specialtyConditions: ["oncology-support"], thyroidType: null,
      oncologySupport: { symptoms: ["gi_sensitivity", "fatigue_low_prep"] },
      saveMedical: async () => {}, patch, refreshUser,
    });
    expect(lockedRead).toHaveBeenCalledWith("update");
    expect(writes[0]).toMatchObject({ specialtyCondition: "oncology-support", specialtyConditions: ["oncology-support"] });
    expect(record.symptoms).toEqual(["gi_sensitivity", "fatigue_low_prep"]);
    expect(refreshUser).toHaveBeenCalledTimes(1);
    await saveConsumerSpecialtySupport(userId, [], undefined);
    expect(record.enabled).toBe(false);
    await saveConsumerSpecialtySupport(userId, ["oncology-support"], undefined);
    expect(record).toMatchObject({ enabled: true, symptoms: ["gi_sensitivity", "fatigue_low_prep"] });
  });
  test("owned unchanged onboarding does not submit a prohibited specialty write", async () => {
    const patch = jest.fn();
    await persistOnboardingHealthInformation({
      medicalConditions: ["None"], specialtyConditions: ["oncology-support"], thyroidType: null,
      saveMedical: async () => {}, patch, skipUnchangedOwnedSpecialty: true,
    });
    expect(patch).not.toHaveBeenCalled();
  });
});
