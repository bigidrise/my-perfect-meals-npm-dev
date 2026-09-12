import {
  countAvailableWorkspaceTypes,
  type WorkspaceAvailability,
} from "@shared/workspaceAvailability";
import { getAuthHeaders } from "@/lib/auth";

export const PERSONAL_ONLY_FALLBACK: WorkspaceAvailability = {
  personal: { available: true, destination: "/dashboard" },
  organization: {
    available: false,
    destination: null,
    organizations: [],
  },
  studio: {
    available: false,
    destination: null,
    readiness: null,
  },
};

export async function fetchWorkspaceAvailability(): Promise<WorkspaceAvailability> {
  const response = await fetch("/api/business/workspace/availability", {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Could not load workspace availability.");
  }
  const body = await response.json();
  if (!body?.availability?.personal?.available) {
    throw new Error("Invalid workspace availability response.");
  }
  return body.availability as WorkspaceAvailability;
}

export function shouldShowWorkspaceChooser(
  availability: WorkspaceAvailability,
): boolean {
  return countAvailableWorkspaceTypes(availability) > 1;
}