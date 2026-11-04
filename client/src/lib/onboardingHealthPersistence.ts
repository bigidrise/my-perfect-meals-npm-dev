/** Keep the current-meals health fields reliable while support preferences
 * are saved independently through the source-backed controls. */
export async function persistOnboardingHealthInformation(input: {
  medicalConditions: string[];
  specialtyConditions: string[];
  thyroidType: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;
  oncologySupport?: { symptoms: string[] };
  refreshUser?: () => Promise<unknown>;
  skipUnchangedOwnedSpecialty?: boolean;
  saveMedical: (conditions: string[]) => Promise<void>;
  currentGlp1Use?: boolean;
  saveCurrentGlp1Use?: (currentUse: boolean) => Promise<void>;
  patch: (path: string, body: object) => Promise<{ ok: boolean }>;
}): Promise<void> {
  await input.saveMedical(input.medicalConditions);
  // Only an explicit current-use answer may create medication authority.
  // Restored legacy conditions alone never populate this argument.
  if (input.currentGlp1Use !== undefined) {
    if (!input.saveCurrentGlp1Use) throw new Error("Current medication use could not be saved.");
    await input.saveCurrentGlp1Use(input.currentGlp1Use);
  }
  if (input.skipUnchangedOwnedSpecialty) return;
  const specialty = await input.patch("/api/user/specialty-condition", {
    conditions: input.specialtyConditions,
    ...(input.oncologySupport !== undefined ? { oncologySupport: input.oncologySupport } : {}),
  });
  if (!specialty.ok) throw new Error("Could not save your health information. Please try again.");
  if (input.oncologySupport !== undefined) await input.refreshUser?.();

  if (input.specialtyConditions.includes("thyroid-support")) {
    const thyroid = await input.patch("/api/user/thyroid-type", { thyroidType: input.thyroidType });
    if (!thyroid.ok) throw new Error("Could not save your thyroid information. Please try again.");
  }
}