import {
  clearOnboardingResume,
  readOnboardingResumeStep,
  writeOnboardingResumeStep,
} from "../onboardingResume";
import fs from "node:fs";
import path from "node:path";

const flow = { flowVersion: "nutrition-priorities-v1", totalSteps: 11 };

function fixtureStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn((key: string) => { values.delete(key); }),
  };
}

test("account B cannot inherit account A's step in the same browser", () => {
  const storage = fixtureStorage();
  writeOnboardingResumeStep(storage, "account-A", 8, flow);
  expect(readOnboardingResumeStep(storage, "account-B", flow)).toBe(1);
  writeOnboardingResumeStep(storage, "account-B", 2, flow);
  expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(8);
  expect(readOnboardingResumeStep(storage, "account-B", flow)).toBe(2);
});

test("returning to the same account resumes its saved position", () => {
  const storage = fixtureStorage();
  writeOnboardingResumeStep(storage, "account-A", 7, flow);
  // A new reader after reload/login still sees the same account-owned entry.
  const reloadedStorage = { getItem: (key: string) => storage.values.get(key) ?? null };
  expect(readOnboardingResumeStep({ ...storage, ...reloadedStorage }, "account-A", flow)).toBe(7);
});

test("unowned legacy positions are neither adopted nor removed", () => {
  const storage = fixtureStorage();
  storage.values.set("mpm.onboarding.resumeStep", "8");
  storage.values.set("mpm.onboarding.flowVersion", flow.flowVersion);
  expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(1);
  expect(readOnboardingResumeStep(storage, "account-B", flow)).toBe(1);
  writeOnboardingResumeStep(storage, "account-B", 3, flow);
  clearOnboardingResume(storage, "account-B");
  expect(storage.values.get("mpm.onboarding.resumeStep")).toBe("8");
  expect(storage.values.get("mpm.onboarding.flowVersion")).toBe(flow.flowVersion);
  expect(storage.getItem.mock.calls.flat()).not.toContain("mpm.onboarding.resumeStep");
});

test("completion clears only the completing account's position", () => {
  const storage = fixtureStorage();
  writeOnboardingResumeStep(storage, "account-A", 11, flow);
  writeOnboardingResumeStep(storage, "account-B", 6, flow);
  clearOnboardingResume(storage, "account-A");
  expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(1);
  expect(readOnboardingResumeStep(storage, "account-B", flow)).toBe(6);
});

test("missing account identity cannot read or save a browser-wide position", () => {
  const storage = fixtureStorage();
  expect(readOnboardingResumeStep(storage, null, flow)).toBe(1);
  expect(() => writeOnboardingResumeStep(storage, null, 8, flow)).toThrow("An account is required");
  clearOnboardingResume(storage, undefined);
  expect(storage.getItem).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});

test.each(["not-json", "null", '{"step":"8","flowVersion":"nutrition-priorities-v1"}',
  '{"step":-1,"flowVersion":"nutrition-priorities-v1"}', '{"step":12,"flowVersion":"nutrition-priorities-v1"}'])(
  "invalid saved entry %s restarts safely at Step 1", raw => {
    const storage = fixtureStorage();
    storage.values.set("mpm.onboarding.resume:account-A", raw);
    expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(1);
  },
);

test("retains the existing inserted-step migration only within an owned entry", () => {
  const storage = fixtureStorage();
  writeOnboardingResumeStep(storage, "account-A", 6, { ...flow, flowVersion: "earlier-flow" });
  expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(7);
  expect(readOnboardingResumeStep(storage, "account-B", flow)).toBe(1);
});

test("invalid positions never overwrite a valid account's saved step", () => {
  const storage = fixtureStorage();
  writeOnboardingResumeStep(storage, "account-A", 5, flow);
  for (const step of [0, 12, 2.5, NaN]) {
    expect(() => writeOnboardingResumeStep(storage, "account-A", step, flow)).toThrow("Invalid onboarding position");
  }
  expect(readOnboardingResumeStep(storage, "account-A", flow)).toBe(5);
});

test("page integration remounts account state and uses only the account-owned helper", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../pages/OnboardingV3.tsx"), "utf8");
  expect(source).toContain('<AccountOnboardingV3 key={user?.id ?? "awaiting-account"} />');
  expect(source).toContain("writeOnboardingResumeStep(localStorage, user.id, step, RESUME_FLOW)");
  expect(source).toContain("readOnboardingResumeStep(localStorage, user.id, RESUME_FLOW)");
  expect(source).toContain("clearOnboardingResume(localStorage, user?.id)");
  expect(source).not.toContain('localStorage.getItem("mpm.onboarding.resumeStep")');
  expect(source).not.toContain("RESUME_STEP_KEY");
});
