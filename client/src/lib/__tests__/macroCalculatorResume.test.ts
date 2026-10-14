import { macroCalculatorStorageKeys, readMacroCalculatorResumeStep } from "../macroCalculatorResume";

function store(values: Record<string, string>) {
  return { getItem: (key: string) => values[key] ?? null };
}

test("fresh account ignores browser-wide late steps and settings", () => {
  const storage = store({ macro_guided_step: "starch", macro_calculator_settings: '{"age":30}' });
  expect(readMacroCalculatorResumeStep(storage, "new-account", false, false)).toBe("entry");
  expect(macroCalculatorStorageKeys("new-account").settings).not.toBe("macro_calculator_settings");
});

test("accounts cannot restore each other's draft or step", () => {
  const a = macroCalculatorStorageKeys("account-a");
  const b = macroCalculatorStorageKeys("account-b");
  expect(a.settings).not.toBe(b.settings);
  expect(a.step).not.toBe(b.step);
  const storage = store({ [a.step]: "clinicalContext" });
  expect(readMacroCalculatorResumeStep(storage, "account-b", false, false)).toBe("entry");
  expect(readMacroCalculatorResumeStep(storage, "account-a", true, false)).toBe("clinicalContext");
});

test("a late resume requires this account's draft, and done requires server-confirmed targets", () => {
  const key = macroCalculatorStorageKeys("account").step;
  expect(readMacroCalculatorResumeStep(store({ [key]: "starch" }), "account", false, false)).toBe("entry");
  expect(readMacroCalculatorResumeStep(store({ [key]: "starch" }), "account", true, false)).toBe("starch");
  for (const complete of [false, null]) {
    expect(readMacroCalculatorResumeStep(store({ [key]: "done" }), "account", true, complete)).toBe("entry");
  }
  expect(readMacroCalculatorResumeStep(store({ [key]: "done" }), "account", true, true)).toBe("done");
});

test("invalid values and unavailable storage start safely; legacy mode is unchanged", () => {
  expect(readMacroCalculatorResumeStep(store({ macro_guided_step: "starch" }), null, false, null)).toBe("starch");
  expect(readMacroCalculatorResumeStep(store({ macro_guided_step: "bad-step" }), null, false, null)).toBe("entry");
  expect(readMacroCalculatorResumeStep({ getItem: () => { throw new Error("unavailable"); } }, "account", true, false)).toBe("entry");
});
