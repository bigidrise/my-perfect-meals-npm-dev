import { onboardingWelcomeEligible } from "../onboardingWelcomeEligibility";

const account = { id: "unfinished-account", onboardingCompletedAt: null };

test("unfinished real-account onboarding is eligible, regardless of unrelated account/workspace flags", () => {
  for (const extra of [
    { role: "client" }, { role: "admin" }, { professionalRole: "physician" },
    { studioMembership: { id: "studio" }, hasStudioMembership: true },
    { activeHouseholdProfileId: "different-household-profile" },
  ]) {
    expect(onboardingWelcomeEligible(true, false, { ...account, ...extra })).toBe(true);
  }
});

test("only saved completion ends the eligible account's introduction", () => {
  expect(onboardingWelcomeEligible(true, false, account)).toBe(true);
  expect(onboardingWelcomeEligible(true, false, {
    ...account, onboardingCompletedAt: "2026-10-13T00:00:00Z",
  })).toBe(false);
});

test("does not expand to Production, signed-out/loading sessions, guests or sandbox accounts", () => {
  expect(onboardingWelcomeEligible(false, false, account)).toBe(false);
  expect(onboardingWelcomeEligible(true, true, account)).toBe(false);
  expect(onboardingWelcomeEligible(true, false, null)).toBe(false);
  expect(onboardingWelcomeEligible(true, false, { ...account, id: "guest-synthetic" })).toBe(false);
  expect(onboardingWelcomeEligible(true, false, { ...account, isSandbox: true })).toBe(false);
});
