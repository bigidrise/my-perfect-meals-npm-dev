export type WorkspaceReadinessStatus =
  | "ready"
  | "professional_setup_required"
  | "phase1_required"
  | "phase2_required"
  | "legal_acceptance_required";

export interface WorkspaceLocationAvailability {
  id: string;
  name: string;
  role: string;
  isDefault: boolean;
}

export interface WorkspaceOrganizationAvailability {
  id: string;
  name: string;
  role: string;
  relationshipType: string;
  locations: WorkspaceLocationAvailability[];
}

export interface WorkspaceAvailability {
  personal: {
    available: true;
    destination: string;
  };
  organization: {
    available: boolean;
    destination: string | null;
    organizations: WorkspaceOrganizationAvailability[];
  };
  studio: {
    available: boolean;
    destination: string | null;
    readiness: WorkspaceReadinessStatus | null;
  };
}

export function countAvailableWorkspaceTypes(
  availability: WorkspaceAvailability,
): number {
  return [
    availability.personal.available,
    availability.organization.available,
    availability.studio.available,
  ].filter(Boolean).length;
}