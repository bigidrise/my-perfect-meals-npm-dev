import { persistOnboardingHealthInformation } from "../onboardingHealthPersistence";

describe("onboarding health writes", () => {
  it.each([true, false])("awaits an explicit current-use answer (%s) through its separate writer", async currentGlp1Use => {
    const saveCurrentGlp1Use = jest.fn().mockResolvedValue(undefined);
    await persistOnboardingHealthInformation({
      medicalConditions: ["glp1"], specialtyConditions: [], thyroidType: null,
      currentGlp1Use, saveCurrentGlp1Use, saveMedical: async () => {},
      patch: async () => ({ ok: true }),
    });
    expect(saveCurrentGlp1Use).toHaveBeenCalledWith(currentGlp1Use);
  });
  it("does not activate from restored legacy GLP-1 conditions alone", async () => {
    const saveCurrentGlp1Use = jest.fn();
    await persistOnboardingHealthInformation({
      medicalConditions: ["glp1"], specialtyConditions: [], thyroidType: null,
      saveCurrentGlp1Use, saveMedical: async () => {}, patch: async () => ({ ok: true }),
    });
    expect(saveCurrentGlp1Use).not.toHaveBeenCalled();
  });
  it("does not report successful onboarding when the explicit medication write fails", async () => {
    await expect(persistOnboardingHealthInformation({
      medicalConditions: ["glp1"], specialtyConditions: [], thyroidType: null,
      currentGlp1Use: true, saveCurrentGlp1Use: async () => { throw new Error("save failed"); },
      saveMedical: async () => {}, patch: async () => ({ ok: true }),
    })).rejects.toThrow("save failed");
  });
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

  it("continues sending existing self-selected clinical conditions through the original specialty path", async () => {
    const conditions = [
      "cardiac", "renal", "liver-support", "liver-disease", "oncology-support",
      "thyroid-support", "hashimotos", "hypothyroid", "hyperthyroid",
      "hormone-optimization", "menopause", "perimenopause", "metabolic-recovery",
    ];
    const patch = jest.fn(async () => ({ ok: true }));
    await persistOnboardingHealthInformation({
      medicalConditions: [], specialtyConditions: conditions, thyroidType: null,
      saveMedical: async () => {}, patch,
    });
    expect(patch).toHaveBeenCalledWith("/api/user/specialty-condition", { conditions });
  });
});