import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import type {
  WorkspaceAvailability,
} from "@shared/workspaceAvailability";
import type { StudioAccessStatus } from "@shared/studioAccess";
import { db } from "../db";
import { studios } from "../db/schema/studio";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import { computeEffectiveAccess } from "./effectiveAccess";
import { resolveStudioAccessStatus } from "./studioAccessStatus";
import { isAcademyRequired } from "../middleware/requirePhase1Cert";
import { getAcademyProgression } from "./academyProgression";
import { readServiceBillingStatus } from "./serviceBillingStatus";

export function buildWorkspaceAvailability(input: {
  onboardingCompletedAt: Date | string | null;
  professionalRole: string | null;
  organizations: WorkspaceAvailability["organization"]["organizations"];
  studioEntitled: boolean;
  existingStudioStatus?: string | null;
  studioReady?: boolean;
}): WorkspaceAvailability {
  const organizationAvailable = input.organizations.length > 0;
  // Neither an old active row nor entitlement on its own opens Studio navigation.
  const studioAvailable = input.studioEntitled &&
    input.existingStudioStatus === "active" &&
    input.studioReady === true;
  let studio: WorkspaceAvailability["studio"] = {
    available: false,
    destination: null,
    readiness: null,
  };

  if (studioAvailable) {
    studio = {
      available: true,
      destination: input.professionalRole === "physician"
        ? "/pro/physician-clients"
        : "/pro/clients",
      readiness: "ready",
    };
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

async function isStudioRouteReady(user: {
  id: string;
  isAdmin: boolean | null;
  professionalRole: string | null;
  procareTrainingCompleted: boolean | null;
}): Promise<boolean> {
  // Mirror the existing Phase 1 and Phase 2 API gates, including their admin
  // and organization-waiver exceptions. The entitlement gate is checked separately.
  if (user.isAdmin || !user.professionalRole) return true;
  if (process.env.PHASE2_GATE_ENABLED === "true" && !user.procareTrainingCompleted) return false;
  if (!(await isAcademyRequired(user.id))) return true;
  return (await getAcademyProgression(user.id)).phase1.complete;
}

async function getStudioAccessSnapshot(userId: string) {
  const [user, organizations, ownedStudio] = await Promise.all([
    db
      .select({
        id: users.id,
        onboardingCompletedAt: users.onboardingCompletedAt,
        professionalRole: users.professionalRole,
        isProCare: users.isProCare,
        isAdmin: users.isAdmin,
        procareTrainingCompleted: users.procareTrainingCompleted,
        planLookupKey: users.planLookupKey,
        personalPlanLookupKey: users.personalPlanLookupKey,
        trialEndsAt: users.trialEndsAt,
        isFounder: users.isFounder,
        isSandbox: users.isSandbox,
        isTester: users.isTester,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    discoverAuthorizedWorkspaces(userId),
    db
      .select({ id: studios.id, status: studios.status })
      .from(studios)
      .where(eq(studios.ownerUserId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!user) {
    throw new Error("Authenticated user was not found.");
  }

  const effectiveAccess = await computeEffectiveAccess(user);
  const studioAccess = resolveStudioAccessStatus(
    user,
    effectiveAccess,
    ownedStudio?.status ?? null,
    organizations.some((organization) => organization.role === "owner"),
    process.env.BILLING_ENFORCED === "true",
    false,
  );
  if (studioAccess.authorized && studioAccess.studioActive && studioAccess.state !== "needs_review") {
    studioAccess.studioReady = await isStudioRouteReady(user);
  }
  return { user, organizations, ownedStudio, studioAccess };
}

export async function getStudioAccessStatus(userId: string): Promise<StudioAccessStatus> {
  const { user, ownedStudio, studioAccess } = await getStudioAccessSnapshot(userId);
  // Internal authority is not an individual paid professional subscription.
  if (studioAccess.sources.includes("personal") && !studioAccess.sources.includes("internal")) {
    studioAccess.billing = await readServiceBillingStatus({
      serviceType: "professional",
      ownerUserId: user.id,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      trustedPlanKey: user.personalPlanLookupKey ?? user.planLookupKey,
      studioId: ownedStudio?.id ?? null,
    });
  }
  return studioAccess;
}

export async function getWorkspaceAvailability(
  userId: string,
): Promise<WorkspaceAvailability> {
  const { user, organizations, studioAccess } = await getStudioAccessSnapshot(userId);
  return buildWorkspaceAvailability({
    onboardingCompletedAt: user.onboardingCompletedAt,
    professionalRole: user.professionalRole,
    organizations,
    studioEntitled: studioAccess.authorized && studioAccess.state !== "needs_review",
    existingStudioStatus: studioAccess.studioActive ? "active" : null,
    studioReady: studioAccess.studioReady,
  });
}