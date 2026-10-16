import type { DemoGrant } from "@shared/demoProfessional";
import { isDemoGrantCurrent } from "@shared/demoProfessional";
import type { WorkspaceAvailability } from "@shared/workspaceAvailability";
import type { StudioAccessStatus } from "@shared/studioAccess";
import {
  DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority,
  isDevelopmentFounderDemoAccount,
} from "../config/developmentFounderPhysicianDemo";

export function canDiscoverDevelopmentWorkspaces(userId: string, grant: DemoGrant): boolean {
  return isDevelopmentFounderDemoAccount(userId) &&
    grant.userId === userId && grant.id === authority.grantId &&
    grant.workspaceId === authority.workspaceId &&
    // The established local grant predates the optional clinicId claim.
    // Runtime discovery still verifies the exact configured Clinic and owner in SQL.
    (grant.clinicId == null || grant.clinicId === authority.clinicId) &&
    grant.authority === "development_founder" && isDemoGrantCurrent(grant);
}

export interface DevelopmentWorkspaceSnapshot {
  userId: string;
  onboardingCompletedAt: Date | string | null;
  professionalRole: string | null;
  studio: { id: string; ownerUserId: string; name: string; type: string; status: string };
  organizations: WorkspaceAvailability["organization"]["organizations"];
}

/** Own metadata only. This does not confer clinical, billing, or tenant-data authority. */
export function buildDevelopmentWorkspaceMetadata(snapshot: DevelopmentWorkspaceSnapshot): {
  availability: WorkspaceAvailability;
  studioAccess: StudioAccessStatus;
} {
  if (snapshot.userId !== authority.userId ||
      snapshot.studio.id !== authority.clinicId ||
      snapshot.studio.ownerUserId !== snapshot.userId ||
      snapshot.studio.type !== "clinic" || snapshot.studio.status !== "active") {
    throw new Error("The existing authorized Clinic could not be verified.");
  }
  const restriction = snapshot.professionalRole !== "physician"
    ? {
      code: "PHYSICIAN_AUTHORITY_UNVERIFIED",
      message: "Your existing Clinic is recognized. The account's stored professional identity is not Physician. A separately approved practitioner identity and applicable credential review are required before clinical access can be established. No role or patient permissions have been changed.",
    }
    : {
      code: "DEVELOPMENT_DEMO_RESTRICTED",
      message: "Your existing Clinic is recognized. This account remains restricted to Development test use; workspace discovery does not authorize access to live patient records.",
    };
  const organizations = snapshot.organizations;
  return {
    availability: {
      personal: { available: true, destination: snapshot.onboardingCompletedAt ? "/dashboard" : "/consumer-welcome" },
      organization: {
        available: organizations.length > 0,
        destination: organizations.length > 0 ? "/business-organizations" : null,
        organizations,
      },
      studio: {
        available: true, destination: "/pro-portal",
        readiness: "professional_setup_required",
        name: snapshot.studio.name, kind: "clinic",
        // Demo persona and ownership are NOT a verified practitioner identity.
        operatingContext: null, restriction,
      },
      restriction: {
        code: "DEVELOPMENT_METADATA_ONLY",
        message: "Existing workspaces are recognized. Workspace data and patient records remain restricted in this Development session.",
      },
    },
    studioAccess: {
      state: "needs_review", studioId: snapshot.studio.id,
      sources: [], studioActive: true, studioReady: false, authorized: false,
      ownsOrganization: organizations.some(org => org.role === "owner"),
      setupDestination: null, billing: null, restriction,
    },
  };
}
