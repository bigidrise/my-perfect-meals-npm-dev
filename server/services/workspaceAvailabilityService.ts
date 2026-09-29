import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import type {
  WorkspaceAvailability,
} from "@shared/workspaceAvailability";
import { isIndependentStudioRenewalEligible, type StudioAccessStatus } from "@shared/studioAccess";
import { db } from "../db";
import { studios } from "../db/schema/studio";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import { computeEffectiveAccess } from "./effectiveAccess";
import { resolveStudioAccessStatus } from "./studioAccessStatus";
import { isAcademyRequired } from "../middleware/requirePhase1Cert";
import { isStudioProviderRole } from "./procareStudioReadiness";
import { getAcademyProgression } from "./academyProgression";
import { readHistoricalProfessionalBillingStatus } from "./serviceBillingStatus";
import { readIndependentStudioAccess } from "./independentStudioAccess";

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
  const [user, organizations, ownedStudio, independentStudio] = await Promise.all([
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
    readIndependentStudioAccess(userId),
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
  studioAccess.studioId = independentStudio.studioId;
  if (!independentStudio.legacyEligible && !independentStudio.hasSubscription &&
      studioAccess.sources.includes("personal")) {
    studioAccess.sources = studioAccess.sources.filter(source => source !== "personal");
    if (studioAccess.sources.length === 0) {
      studioAccess.authorized = false;
      studioAccess.state = "inactive";
      studioAccess.studioReady = false;
    }
  }
  if (independentStudio.hasSubscription) {
    studioAccess.billing = independentStudio.billing;
    if (independentStudio.billing?.state === "active" ||
        independentStudio.billing?.state === "ending") {
      studioAccess.sources.push("studio");
      studioAccess.authorized = true;
      if (studioAccess.studioActive && studioAccess.state !== "managed_access") {
        studioAccess.state = "active";
      }
    } else if (!studioAccess.sources.length || studioAccess.sources.every(source => source === "personal")) {
      // A historical Personal professional plan is not a second Studio payment.
      studioAccess.state = independentStudio.billing?.state === "expired" ? "inactive" : "needs_review";
      studioAccess.authorized = false;
      studioAccess.studioReady = false;
    }
  }
  if (studioAccess.authorized && studioAccess.studioActive && studioAccess.state !== "needs_review") {
    studioAccess.studioReady = await isStudioRouteReady(user);
  }
  return { user, organizations, ownedStudio, independentStudio, studioAccess };
}

export async function getStudioAccessStatus(userId: string): Promise<StudioAccessStatus> {
  const { user, ownedStudio, independentStudio, studioAccess } = await getStudioAccessSnapshot(userId);
  // Internal authority is not an individual paid professional subscription.
  if (!independentStudio.hasSubscription && !independentStudio.studioDisconnected &&
      !studioAccess.sources.includes("internal") && ownedStudio?.id) {
    studioAccess.billing = await readHistoricalProfessionalBillingStatus(user.id, ownedStudio.id);
  }
  if (independentStudio.studioDisconnected) {
    studioAccess.state = "inactive";
    studioAccess.authorized = false;
    studioAccess.studioReady = false;
  }
  if (studioAccess.billing?.state === "expired" &&
      studioAccess.sources.every((source) => source === "personal" || source === "studio")) {
    studioAccess.state = "inactive";
    studioAccess.authorized = false;
    studioAccess.studioReady = false;
  }
  studioAccess.canManageRenewal = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED === "true" &&
    isIndependentStudioRenewalEligible(studioAccess);
  studioAccess.canReconnect = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED === "true" &&
    studioAccess.studioActive &&
    studioAccess.billing?.state === "expired" &&
    independentStudio.hasSubscription &&
    !studioAccess.sources.includes("internal") &&
    !studioAccess.sources.includes("sponsored") &&
    !studioAccess.sources.includes("pilot");
  studioAccess.canStartStudioCheckout = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED === "true" &&
    !independentStudio.studioDisconnected &&
    !independentStudio.hasSubscription &&
    !studioAccess.billing &&
    isStudioProviderRole(user.professionalRole) &&
    !user.isFounder && !user.isSandbox && !user.isTester &&
    !studioAccess.sources.includes("sponsored") &&
    !studioAccess.sources.includes("pilot");
  studioAccess.canDisconnectAddon = independentStudio.legacyToggleEligible &&
    independentStudio.studioActive;
  studioAccess.canReconnectAddon = independentStudio.legacyToggleEligible &&
    independentStudio.studioDisconnected;
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