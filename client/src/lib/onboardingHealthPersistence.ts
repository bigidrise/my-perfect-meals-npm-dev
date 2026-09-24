/** Keep the current-meals health fields reliable while support preferences
 * are saved independently through the source-backed controls. */
export async function persistOnboardingHealthInformation(input: {
  medicalConditions: string[];
  specialtyConditions: string[];
  thyroidType: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;
  saveMedical: (conditions: string[]) => Promise<void>;
  patch: (path: string, body: object) => Promise<{ ok: boolean }>;
}): Promise<void> {
  await input.saveMedical(input.medicalConditions);
  const specialty = await input.patch("/api/user/specialty-condition", {
    conditions: input.specialtyConditions,
  });
  if (!specialty.ok) throw new Error("Could not save your health information. Please try again.");

  if (input.specialtyConditions.includes("thyroid-support")) {
    const thyroid = await input.patch("/api/user/thyroid-type", { thyroidType: input.thyroidType });
    if (!thyroid.ok) throw new Error("Could not save your thyroid information. Please try again.");
  }
}