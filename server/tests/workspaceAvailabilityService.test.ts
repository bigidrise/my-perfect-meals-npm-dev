import { buildWorkspaceAvailability } from "../services/workspaceAvailabilityService";

const organization = {
  id: "org-1",
  name: "Organization",
  role: "member",
  relationshipType: "staff",
  locations: [{
    id: "location-1",
    name: "Main",
    role: "member",
    isDefault: true,
  }],
};

describe("workspace availability authority", () => {
  it("does not create Studio without canonical entitlement", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: "trainer",
      organizations: [organization],
      studioEntitled: false,
    });

    expect(result.personal.available).toBe(true);
    expect(result.organization.available).toBe(true);
    expect(result.studio).toEqual({
      available: false,
      destination: null,
      readiness: null,
    });
  });

  it("keeps entitlement separate from readiness", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: "trainer",
      organizations: [],
      studioEntitled: true,
      studioReady: false,
      readinessCode: "PHASE1_CERT_REQUIRED",
    });

    expect(result.studio).toEqual({
      available: true,
      destination: "/pro-launchpad",
      readiness: "phase1_required",
    });
  });

  it("shows an existing active Studio owner regardless of new-provider eligibility", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      // Legacy internal owner account: neither field is a new-Studio
      // eligibility requirement when an active owned Studio already exists.
      professionalRole: "general_nutrition",
      organizations: [],
      studioEntitled: false,
      existingStudioStatus: "active",
      studioReady: true,
    });

    expect(result.studio).toEqual({
      available: true,
      destination: "/pro/clients",
      readiness: "ready",
    });
  });

  it("does not resurface a suspended or deactivated owned Studio", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: "general_nutrition",
      organizations: [],
      // Even a stale eligibility value cannot override the Studio lifecycle.
      studioEntitled: true,
      existingStudioStatus: "suspended",
      studioReady: true,
    });

    expect(result.studio).toEqual({
      available: false,
      destination: null,
      readiness: null,
    });
  });

  it("routes ready physicians to their Studio", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: "physician",
      organizations: [organization],
      studioEntitled: true,
      studioReady: true,
    });

    expect(result.studio).toEqual({
      available: true,
      destination: "/pro/physician-clients",
      readiness: "ready",
    });
  });

  it("uses one Organization entry point for multiple options", () => {
    const result = buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: null,
      organizations: [
        organization,
        { ...organization, id: "org-2", name: "Second Organization" },
      ],
      studioEntitled: false,
    });

    expect(result.organization.available).toBe(true);
    expect(result.organization.destination).toBe("/business-organizations");
    expect(result.organization.organizations).toHaveLength(2);
  });
});