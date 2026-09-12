import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import type {
  WorkspaceAvailability,
  WorkspaceReadinessStatus,
} from "@shared/workspaceAvailability";
import { db } from "../db";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import { providerHasProCareStudioAccess } from "./procareProviderAccess";
import {
  getProviderStudioReadiness,
  isStudioProviderRole,
  type ProviderStudioReadinessCode,
} from "./procareStudioReadiness";

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
  readinessCode?: ProviderStudioReadinessCode;
  studioReady?: boolean;
}): WorkspaceAvailability {
  const organizationAvailable = input.organizations.length > 0;
  let studio: WorkspaceAvailability["studio"] = {
    available: false,
    destination: null,
    readiness: null,
  };

  if (input.studioEntitled) {
    if (input.studioReady) {
      studio = {
        available: true,
        destination:
          input.professionalRole === "physician"
            ? "/care-team/physician"
            : "/care-team/trainer",
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
  const [user, organizations] = await Promise.all([
    db
      .select({
        id: users.id,
        onboardingCompletedAt: users.onboardingCompletedAt,
        professionalRole: users.professionalRole,
        planLookupKey: users.planLookupKey,
        personalPlanLookupKey: users.personalPlanLookupKey,
        isFounder: users.isFounder,
        isSandbox: users.isSandbox,
        isTester: users.isTester,
        trialEndsAt: users.trialEndsAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    discoverAuthorizedWorkspaces(userId),
  ]);

  if (!user) {
    throw new Error("Authenticated user was not found.");
  }

  let studioEntitled = false;
  let studioReady = false;
  let readinessCode: ProviderStudioReadinessCode | undefined;

  if (isStudioProviderRole(user.professionalRole)) {
    studioEntitled = await providerHasProCareStudioAccess(user);
    if (studioEntitled) {
      const readiness = await getProviderStudioReadiness(userId);
      studioReady = readiness.ok;
      readinessCode = readiness.code;
    }
  }

  return buildWorkspaceAvailability({
    onboardingCompletedAt: user.onboardingCompletedAt,
    professionalRole: user.professionalRole,
    organizations,
    studioEntitled,
    studioReady,
    readinessCode,
  });
}