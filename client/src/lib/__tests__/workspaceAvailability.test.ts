import type { WorkspaceAvailability } from "@shared/workspaceAvailability";
import { shouldShowWorkspaceChooser } from "@/lib/workspaceAvailability";

function availability(
  organization: boolean,
  studio: boolean,
): WorkspaceAvailability {
  return {
    personal: { available: true, destination: "/dashboard" },
    organization: {
      available: organization,
      destination: organization ? "/business-dashboard" : null,
      organizations: organization
        ? [{
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
          }]
        : [],
    },
    studio: {
      available: studio,
      destination: studio ? "/care-team/trainer" : null,
      readiness: studio ? "ready" : null,
    },
  };
}

describe("server-derived workspace availability", () => {
  it("routes Personal-only accounts without a chooser", () => {
    expect(shouldShowWorkspaceChooser(availability(false, false))).toBe(false);
  });

  it.each([
    ["Personal + Organization", true, false],
    ["Personal + Studio", false, true],
    ["Personal + Organization + Studio", true, true],
  ])("shows the chooser for %s", (_label, organization, studio) => {
    expect(shouldShowWorkspaceChooser(availability(organization, studio))).toBe(true);
  });
});