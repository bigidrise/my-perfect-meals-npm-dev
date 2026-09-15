import type { WorkspaceAvailability } from "@shared/workspaceAvailability";
import { deriveStudioNavigationAccess } from "../studioNavigationAccess";

function availability(
  studio: Partial<WorkspaceAvailability["studio"]> = {},
): WorkspaceAvailability {
  return {
    personal: { available: true, destination: "/dashboard" },
    organization: {
      available: false,
      destination: null,
      organizations: [],
    },
    studio: {
      available: true,
      destination: "/pro/clients",
      readiness: "ready",
      ...studio,
    },
  };
}

describe("Studio navigation access", () => {
  it.each(["general_nutrition", "legacy_provider", null])(
    "keeps an active owned Studio visible for atypical role %p",
    (role) => {
      const access = deriveStudioNavigationAccess(availability(), role);

      expect(access.studioVisible).toBe(true);
      expect(access.studioDestination).toBe("/pro/clients");
      expect(access.proPortalVisible).toBe(true);
      expect(access.careTeamVisible).toBe(true);
      expect(access.careTeamDestination).toBe("/care-team/trainer");
    },
  );

  it("does not grant Studio navigation without authoritative availability", () => {
    const access = deriveStudioNavigationAccess(
      availability({ available: false, destination: null, readiness: null }),
      "trainer",
    );

    expect(access.studioVisible).toBe(false);
    expect(access.proPortalVisible).toBe(false);
    expect(access.careTeamVisible).toBe(false);
  });

  it("does not infer access while availability is unresolved", () => {
    expect(deriveStudioNavigationAccess(null, "physician")).toEqual({
      studioVisible: false,
      studioDestination: null,
      proPortalVisible: false,
      proPortalDestination: null,
      careTeamVisible: false,
      careTeamDestination: null,
    });
  });

  it.each([
    ["trainer", "/care-team/trainer", "/pro/clients"],
    ["physician", "/care-team/physician", "/pro/physician-clients"],
  ])(
    "selects the correct Care Team surface for %s",
    (role, careTeamDestination, portalDestination) => {
      const access = deriveStudioNavigationAccess(
        availability({ destination: portalDestination }),
        role,
      );

      expect(access.studioVisible).toBe(true);
      expect(access.proPortalVisible).toBe(true);
      expect(access.proPortalDestination).toBe(portalDestination);
      expect(access.careTeamVisible).toBe(true);
      expect(access.careTeamDestination).toBe(careTeamDestination);
    },
  );

  it("shows setup navigation without exposing Studio tools before readiness", () => {
    const access = deriveStudioNavigationAccess(
      availability({
        destination: "/professional-dashboard",
        readiness: "professional_setup_required",
      }),
      "trainer",
    );

    expect(access.studioVisible).toBe(true);
    expect(access.studioDestination).toBe("/professional-dashboard");
    expect(access.proPortalVisible).toBe(false);
    expect(access.careTeamVisible).toBe(false);
  });
});