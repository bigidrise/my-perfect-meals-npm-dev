import { persistOnboardingHealthInformation } from "../onboardingHealthPersistence";

describe("onboarding health writes", () => {
  const base = {
    medicalConditions: ["glp1"],
    specialtyConditions: ["thyroid-support"],
    thyroidType: "hashimotos" as const,
  };

  it("waits for both specialty and subtype writes before declaring success", async () => {
    const order: string[] = [];
    const saveMedical = jest.fn(async () => { order.push("medical"); });
    const patch = jest.fn(async (path: string) => {
      order.push(path);
      return { ok: true };
    });
    await persistOnboardingHealthInformation({ ...base, saveMedical, patch });
    expect(order).toEqual([
      "medical", "/api/user/specialty-condition", "/api/user/thyroid-type",
    ]);
    expect(patch).toHaveBeenCalledWith("/api/user/specialty-condition", { conditions: ["thyroid-support"] });
    expect(patch).toHaveBeenCalledWith("/api/user/thyroid-type", { thyroidType: "hashimotos" });
  });

  it("rejects failed specialty writes rather than advancing to the next step", async () => {
    const patch = jest.fn(async () => ({ ok: false }));
    await expect(persistOnboardingHealthInformation({
      ...base, saveMedical: async () => {}, patch,
    })).rejects.toThrow("Could not save your health information");
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("rejects failed thyroid writes and sends an empty selection when clearing specialties", async () => {
    await expect(persistOnboardingHealthInformation({
      ...base, saveMedical: async () => {},
      patch: jest.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }),
    })).rejects.toThrow("Could not save your thyroid information");

    const patch = jest.fn(async () => ({ ok: true }));
    await persistOnboardingHealthInformation({
      ...base, specialtyConditions: [], saveMedical: async () => {}, patch,
    });
    expect(patch).toHaveBeenCalledWith("/api/user/specialty-condition", { conditions: [] });
    expect(patch).toHaveBeenCalledTimes(1);
  });
});