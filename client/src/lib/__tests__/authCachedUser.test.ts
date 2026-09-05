import { toCachedUser, type User } from "../auth";

describe("cached user sanitizer", () => {
  it("retains only fields needed for auth, access, and onboarding routing", () => {
    const fullUser = {
      id: "user-1",
      email: "member@example.com",
      name: "Member",
      role: "physician",
      isProCare: true,
      entitlements: ["pro"],
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
      studioMembership: {
        membershipId: "membership-1",
        studioId: "studio-1",
        studioName: "Private Studio",
      },
      specialtyConditions: ["renal"],
      medicalConditions: ["diabetes-type2"],
      allergies: ["Peanuts"],
      dietaryRestrictions: ["Low-Sodium"],
      medications: ["Example medication"],
      pregnancySupportContext: { stage: "second" },
      performanceProtocolConfig: { trainingDays: ["monday"] },
      performanceContext: { trainingLoad: "high" },
      oncologySupportContext: { assignedBy: "physician-1" },
      pregnancyStage: "second",
      credentialNumber: "credential-123",
      activeClientAccess: {
        programName: "Care plan",
        businessName: "Practice",
        inviterName: "Provider",
        trialDays: 14,
        acceptedAt: "2026-01-01T00:00:00.000Z",
      },
      height: 70,
      weight: 180,
    } as unknown as User;
    const cached = toCachedUser(fullUser);

    expect(cached).toMatchObject({
      id: "user-1",
      email: "member@example.com",
      role: "physician",
      isProCare: true,
      entitlements: ["pro"],
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
      hasStudioMembership: true,
    });
    expect(Object.keys(cached)).not.toEqual(expect.arrayContaining([
      "specialtyConditions", "medicalConditions", "allergies",
      "dietaryRestrictions", "medications", "pregnancySupportContext",
      "pregnancyStage", "performanceProtocolConfig", "performanceContext",
      "oncologySupportContext", "credentialNumber", "activeClientAccess",
       "height", "weight", "name", "studioMembership",
    ]));
  });
});