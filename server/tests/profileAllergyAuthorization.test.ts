import { isOnboardingAllergyBootstrapAuthorized } from "../services/profileAuthorization";

describe("profile allergy onboarding authorization", () => {
  it("allows the declared onboarding path only while onboarding is incomplete", () => {
    expect(isOnboardingAllergyBootstrapAuthorized(true, null)).toBe(true);
    expect(isOnboardingAllergyBootstrapAuthorized(true, undefined)).toBe(true);
  });

  it("rejects a forged onboarding flag after authoritative completion", () => {
    expect(
      isOnboardingAllergyBootstrapAuthorized(
        true,
        new Date("2026-09-18T12:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("does not bypass PIN authorization without the explicit onboarding signal", () => {
    expect(isOnboardingAllergyBootstrapAuthorized(false, null)).toBe(false);
    expect(isOnboardingAllergyBootstrapAuthorized("true", null)).toBe(false);
  });
});