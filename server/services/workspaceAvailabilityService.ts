import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import type {
  WorkspaceAvailability,
  WorkspaceReadinessStatus,
} from "@shared/workspaceAvailability";
import { db } from "../db";
import { studios } from "../db/schema/studio";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import type { ProviderStudioReadinessCode } from "./procareStudioReadiness";

function mapStudioReadiness(
  code: ProviderStudioReadinessCode | undefined,
): {
  readiness: WorkspaceReadinessStatus;
  destination: string;
} {
  switch (code) {
    case "PHASE1_CERT_REQUIRED":
      return { readiness: "phase1_required", destination: "/pro-launchpad" };
    case "PHASE2_TRAINING_REQUIRED":
      return {
        readiness: "phase2_required",
        destination: "/certifications/procare_certification",
      };
    case "LEGAL_REACCEPT_REQUIRED":
      return {
        readiness: "legal_acceptance_required",
        destination: "/professional-dashboard",
      };
    default:
      return {
        readiness: "professional_setup_required",
        destination: "/professional-dashboard",
      };
  }
}

export function buildWorkspaceAvailability(input: {
  onboardingCompletedAt: Date | string | null;
  professionalRole: string | null;
  organizations: WorkspaceAvailability["organization"]["organizations"];
  studioEntitled: boolean;
  existingStudioStatus?: string | null;
  readinessCode?: ProviderStudioReadinessCode;
  studioReady?: boolean;
}): WorkspaceAvailability {
  const organizationAvailable = input.organizations.length > 0;
  // If an existing Studio row is present, its lifecycle status is
  // authoritative. This prevents a suspended/deactivated Studio from being
  // resurfaced by provider eligibility.
  const studioEntitled =
    input.existingStudioStatus !== null &&
    input.existingStudioStatus !== undefined
      ? input.existingStudioStatus === "active"
      : input.studioEntitled;
  let studio: WorkspaceAvailability["studio"] = {
    available: false,
    destination: null,
    readiness: null,
  };

  if (studioEntitled) {
    if (input.studioReady) {
      studio = {
        available: true,
        destination:
          input.professionalRole === "physician"
            ? "/pro/physician-clients"
            : "/pro/clients",
        readiness: "ready",
      };
    } else {
      const mapped = mapStudioReadiness(input.readinessCode);
      studio = {
        available: true,
        destination: mapped.destination,
        readiness: mapped.readiness,
      };
    }
  }

  return {
    personal: {
      available: true,
      destination: input.onboardingCompletedAt ? "/dashboard" : "/consumer-welcome",
    },
    organization: {
      available: organizationAvailable,
      destination: organizationAvailable
        ? input.organizations.length > 1 ||
          input.organizations.some((organization) => organization.locations.length > 1)
          ? "/business-organizations"
          : "/business-dashboard"
        : null,
      organizations: input.organizations,
    },
    studio,
  };
}

export async function getWorkspaceAvailability(
  userId: string,
): Promise<WorkspaceAvailability> {
  const [user, organizations, ownedStudio] = await Promise.all([
    db
      .select({
        id: users.id,
        onboardingCompletedAt: users.onboardingCompletedAt,
        professionalRole: users.professionalRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    discoverAuthorizedWorkspaces(userId),
    db
      .select({ status: studios.status })
      .from(studios)
      .where(eq(studios.ownerUserId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!user) {
    throw new Error("Authenticated user was not found.");
  }

  // An existing active Studio is the authority for its owner's workspace.
  // New-Studio provider eligibility is intentionally not a visibility
  // predicate; it is enforced only by the creation/provisioning flow.
  const hasActiveOwnedStudio = ownedStudio?.status === "active";
  let studioEntitled = hasActiveOwnedStudio;
  let studioReady = hasActiveOwnedStudio;

  return buildWorkspaceAvailability({
    onboardingCompletedAt: user.onboardingCompletedAt,
    professionalRole: user.professionalRole,
    organizations,
    studioEntitled,
    existingStudioStatus: ownedStudio?.status ?? null,
    studioReady,
  });
}