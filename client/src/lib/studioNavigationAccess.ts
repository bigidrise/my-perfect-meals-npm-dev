import type { WorkspaceAvailability } from "@shared/workspaceAvailability";

export interface StudioNavigationAccess {
  studioVisible: boolean;
  studioDestination: string | null;
  proPortalVisible: boolean;
  proPortalDestination: string | null;
  careTeamVisible: boolean;
  careTeamDestination: string | null;
}

export function deriveStudioNavigationAccess(
  availability: WorkspaceAvailability | null,
  professionalRole: string | null | undefined,
): StudioNavigationAccess {
  const studioVisible =
    availability?.studio.available === true &&
    typeof availability.studio.destination === "string";
  const studioDestination = studioVisible
    ? availability.studio.destination
    : null;
  const proPortalVisible =
    studioVisible &&
    availability?.studio.readiness === "ready" &&
    studioDestination?.startsWith("/pro/") === true;
  const careTeamVisible =
    proPortalVisible &&
    (professionalRole === "physician" || professionalRole === "trainer");

  return {
    studioVisible,
    studioDestination,
    proPortalVisible,
    proPortalDestination: proPortalVisible ? studioDestination : null,
    careTeamVisible,
    careTeamDestination: careTeamVisible
      ? professionalRole === "physician"
        ? "/care-team/physician"
        : "/care-team/trainer"
      : null,
  };
}