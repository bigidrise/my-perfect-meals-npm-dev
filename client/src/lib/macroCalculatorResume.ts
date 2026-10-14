export const MACRO_CALCULATOR_STEPS = [
  "entry", "goal", "commitmentLevel", "bodyType", "units", "sex", "age",
  "height", "weight", "waist", "activity", "syncWeight", "metabolic",
  "results", "nutritionStrategy", "starch", "clinicalContext",
  "bodyComposition", "save", "done",
] as const;
export type MacroCalculatorStep = typeof MACRO_CALCULATOR_STEPS[number];

export function macroCalculatorStorageKeys(accountId: string | null) {
  const suffix = accountId ? `::development::${encodeURIComponent(accountId)}` : "";
  return {
    settings: `macro_calculator_settings${suffix}`,
    step: `macro_guided_step${suffix}`,
  };
}

/** Legacy browser-wide progress is never proof of this account's setup. */
export function readMacroCalculatorResumeStep(
  storage: Pick<Storage, "getItem">,
  accountId: string | null,
  hasDraft: boolean,
  savedComplete: boolean | null,
): MacroCalculatorStep {
  try {
    const value = storage.getItem(macroCalculatorStorageKeys(accountId).step);
    if (!MACRO_CALCULATOR_STEPS.includes(value as MacroCalculatorStep)) return "entry";
    if (accountId && (!hasDraft || (value === "done" && savedComplete !== true))) return "entry";
    return value as MacroCalculatorStep;
  } catch { return "entry"; }
}
