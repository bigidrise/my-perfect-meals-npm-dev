import { and, eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { CANONICAL_PRACTITIONER_ROLES, isCanonicalPractitionerRole } from "@shared/professionalRoles";
import { db } from "../db";
import { studios } from "../db/schema/studio";
import { logAudit } from "../lib/auditLog";
import { checkLegalAcceptance } from "./legalCheck";
import { providerHasProCareStudioAccess } from "./procareProviderAccess";
import { ensureStudioForTrainer, type EnsuredStudio } from "./studioBridge";
import { getAcademyProgression } from "./academyProgression";
import { isClinicalPractitionerRole } from "@shared/professionalRoles";
import { identityRequiresIndependentCredentialReview } from "./professionalIdentityCredentialBoundary";

export const STUDIO_PROVIDER_ROLES = CANONICAL_PRACTITIONER_ROLES;

export function isStudioProviderRole(
  role: string | null | undefined,
): role is (typeof STUDIO_PROVIDER_ROLES)[number] {
  return isCanonicalPractitionerRole(role);
}

export type ProviderStudioReadinessCode =
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_ROLE_REQUIRED"
  | "PROCARE_ACCESS_REQUIRED"
  | "PHASE1_CERT_REQUIRED"
  | "PHASE2_TRAINING_REQUIRED"
  | "LEGAL_REACCEPT_REQUIRED"
  | "INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED";
// Credential evidence for a changed licensed identity is never inherited.

export interface ProviderStudioReadiness {
  ok: boolean;
  code?: ProviderStudioReadinessCode;
  message?: string;
  flow?: "professional" | "physician";
  missing?: string[];
}

export interface ProviderStudioProvisionResult extends ProviderStudioReadiness {
  studio?: EnsuredStudio;
}

/** Ownership is only one prerequisite; access, training and legal gates still apply. */
export async function readOwnedBusinessStudio(providerUserId: string) {
  const [studio] = await db.select().from(studios)
    .where(eq(studios.ownerUserId, providerUserId)).limit(1);
  return studio ?? null;
}

/**
 * The single eligibility rule for a professional-owned Studio. Keep this
 * separate from client acceptance: a client may redeem an existing invite,
 * but no provider-originated invite may be created until this returns ready.
 */
export async function getProviderStudioReadiness(
  providerUserId: string,
  options: { requireTraining?: boolean; requireSubscription?: boolean } = {},
): Promise<ProviderStudioReadiness> {
  const [provider] = await db
    .select({
      id: users.id,
      role: users.role,
      isProCare: users.isProCare,
      professionalRole: users.professionalRole,
      procareTrainingCompleted: users.procareTrainingCompleted,
      planLookupKey: users.planLookupKey,
      personalPlanLookupKey: users.personalPlanLookupKey,
      isFounder: users.isFounder,
      isSandbox: users.isSandbox,
      isTester: users.isTester,
      trialEndsAt: users.trialEndsAt,
    })
    .from(users)
    .where(eq(users.id, providerUserId))
    .limit(1);

  if (!provider) {
    return { ok: false, code: "PROVIDER_NOT_FOUND", message: "Provider account was not found." };
  }

  const businessStudio = provider.professionalRole === "business"
    ? await readOwnedBusinessStudio(providerUserId) : null;
  const businessOperator = provider.professionalRole === "business"
    && businessStudio?.status === "active" && businessStudio.type === "studio";
  // A business operator's independent Studio authority is not the legacy
  // managed-account flag. Actual provider access is checked separately below.
  if ((!businessOperator && !provider.isProCare && options.requireSubscription !== false) ||
      (!isStudioProviderRole(provider.professionalRole) && !businessOperator)) {
    return {
      ok: false,
      code: "PROVIDER_ROLE_REQUIRED",
      message: "Complete your professional ProCare setup before creating a Studio or inviting clients.",
    };
  }

  if (options.requireSubscription !== false && !(await providerHasProCareStudioAccess(provider))) {
    return {
      ok: false,
      code: "PROCARE_ACCESS_REQUIRED",
      message: "An active ProCare provider subscription is required before inviting clients.",
    };
  }
  if (isClinicalPractitionerRole(provider.professionalRole) && await identityRequiresIndependentCredentialReview(providerUserId)) {
    return { ok: false, code: "INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED", message: "The approved licensed identity requires independent credential verification; old Studio verification does not verify this identity." };
  }

  const progression = await getAcademyProgression(providerUserId);
  if (!progression.phase1.complete) {
    return {
      ok: false,
      code: "PHASE1_CERT_REQUIRED",
      message: "Complete Phase 1 — Platform Mastery before creating a Studio or inviting clients.",
    };
  }

  const requireTraining = options.requireTraining ?? process.env.PHASE2_GATE_ENABLED === "true";
  if (requireTraining && !progression.proCare.complete) {
    return {
      ok: false,
      code: "PHASE2_TRAINING_REQUIRED",
      message: "Complete Phase 2 ProCare Training before creating a Studio or inviting clients.",
    };
  }

  const legalFlow = provider.professionalRole === "physician" ? "physician" : "professional";
  const [attestation, legal] = await Promise.all([
    checkLegalAcceptance(providerUserId, "attestation"),
    checkLegalAcceptance(providerUserId, legalFlow),
  ]);
  const missing = [...attestation.missing, ...legal.missing];
  if (missing.length > 0) {
    return {
      ok: false,
      code: "LEGAL_REACCEPT_REQUIRED",
      message: "Accept all required professional legal documents before creating a Studio or inviting clients.",
      flow: legalFlow,
      missing,
    };
  }

  return { ok: true };
}

export async function ensureProviderStudioReady(
  providerUserId: string,
  options: { requireTraining?: boolean } = {},
): Promise<ProviderStudioProvisionResult> {
  const readiness = await getProviderStudioReadiness(providerUserId, options);
  if (!readiness.ok) return readiness;

  const [account] = await db.select({ professionalRole: users.professionalRole })
    .from(users).where(eq(users.id, providerUserId)).limit(1);
  if (account?.professionalRole === "business") {
    const existing = await readOwnedBusinessStudio(providerUserId);
    if (!existing || existing.status !== "active" || existing.type !== "studio") {
      return { ok: false, code: "PROVIDER_ROLE_REQUIRED" };
    }
    // Never provision or repair a Studio/billing record as an operator grant.
    return { ok: true, studio: { studioId: existing.id, studioName: existing.name,
      studioType: existing.type, created: false } };
  }
  const studio = await ensureStudioForTrainer(providerUserId);
  if (!studio) {
    return {
      ok: false,
      code: "PROVIDER_NOT_FOUND",
      message: "We could not prepare your Studio. Please try again.",
    };
  }

  return { ok: true, studio };
}

export interface StudioBackfillSummary {
  considered: number;
  created: number;
  alreadyPresent: number;
  skipped: number;
  unclearProviderRole: number;
}

/**
 * Safe, repeatable recovery for provider accounts created before automatic
 * Studio provisioning. Only coach-role accounts with an explicit professional
 * role are considered; client accounts and ambiguous historical records are
 * reported but never mutated.
 */
export async function backfillEligibleProviderStudios(
  source: "development_boot" | "production_boot",
): Promise<StudioBackfillSummary> {
  const providerRows = await db
    .select({ id: users.id, professionalRole: users.professionalRole })
    .from(users)
    .where(and(eq(users.isProCare, true), eq(users.role, "coach")));

  const eligibleCandidates = providerRows.filter((row) => isStudioProviderRole(row.professionalRole));
  const summary: StudioBackfillSummary = {
    considered: eligibleCandidates.length,
    created: 0,
    alreadyPresent: 0,
    skipped: 0,
    unclearProviderRole: providerRows.length - eligibleCandidates.length,
  };

  for (const provider of eligibleCandidates) {
    try {
      const result = await ensureProviderStudioReady(provider.id);
      if (!result.ok || !result.studio) {
        summary.skipped += 1;
        console.warn(`[ProCareStudioBackfill] Skipped provider ${provider.id}: ${result.code ?? "NOT_READY"}`);
        continue;
      }

      if (result.studio.created) {
        summary.created += 1;
      } else {
        summary.alreadyPresent += 1;
      }

      logAudit({
        actor: "system",
        target: provider.id,
        action: "WRITE",
        resourceType: "procare_studio_backfill",
        resourceId: result.studio.studioId,
        table: "studios",
        route: `system:${source}`,
        meta: { outcome: result.studio.created ? "created" : "already_present" },
      });
    } catch (error) {
      summary.skipped += 1;
      console.error(`[ProCareStudioBackfill] Provider ${provider.id} failed:`, error);
    }
  }

  console.log("[ProCareStudioBackfill] Completed", { source, ...summary });
  return summary;
}