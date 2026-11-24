/** Active steps are the sole authority for progress and navigation in all runtimes. */
export const PROFILE_WIZARD_STEPS = [
  { id: 1, title: "Personal Information" },
  { id: 2, title: "Goals & Activity" },
  { id: 3, title: "Preferences & Restrictions" },
  { id: 4, title: "Review & Save" },
] as const;

export type ProfileStepId = (typeof PROFILE_WIZARD_STEPS)[number]["id"];

export function nextProfileStep(current: ProfileStepId): ProfileStepId {
  const index = PROFILE_WIZARD_STEPS.findIndex(step => step.id === current);
  return PROFILE_WIZARD_STEPS[Math.min(index + 1, PROFILE_WIZARD_STEPS.length - 1)].id;
}

export function previousProfileStep(current: ProfileStepId): ProfileStepId {
  const index = PROFILE_WIZARD_STEPS.findIndex(step => step.id === current);
  return PROFILE_WIZARD_STEPS[Math.max(0, index - 1)].id;
}
