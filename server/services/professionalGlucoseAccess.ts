import { and, eq, gte, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { getCurrentVersion } from "@shared/legalDocuments";
import { MPM_PUBLIC_ORG_ID } from "@shared/constants";
import type {
  ProfessionalGlucoseClientSummariesResponse,
  ProfessionalGlucoseContext,
} from "@shared/professionalGlucose";
import { db } from "../db";
import { clientLinks } from "../db/schema/procare";
import { studioMemberships, studios } from "../db/schema/studio";
import { userDocumentAcceptance } from "../db/schema/legal";
import { getUserOrgId } from "../lib/orgIsolation";
import { getProviderStudioReadiness } from "./procareStudioReadiness";
import {
  evaluateProfessionalGlucoseAccess,
  type ProfessionalGlucoseAccessDecision,
  type ProfessionalGlucoseAccessReason,
} from "./professionalGlucosePolicy";
import {
  buildProfessionalGlucoseTargetRanges,
  classifyProfessionalGlucoseReading,
} from "./professionalGlucoseHistory";
import type { Guardrails } from "@shared/diabetes-schema";

interface ProviderEligibility {
  allowed: boolean;
  reason: ProfessionalGlucoseAccessReason;
  professionalRole: string | null;
  studioId: string | null;
  organizationId: string | null;
}

function hasVerifiedCredential(provider: {
  professionalRole: string | null;
  professionalCategory: string | null;
  credentialBody: string | null;
  credentialNumber: string | null;
  verificationStatus: string | null;
}): boolean {
  if (provider.verificationStatus !== "verified") return false;
  if (provider.professionalRole === "physician") return true;
  if (provider.professionalRole !== "dietitian") return false;
  return (
    provider.professionalCategory === "certified" &&
    !!provider.credentialBody?.trim() &&
    !!provider.credentialNumber?.trim()
  );
}

async function resolveProviderEligibility(
  professionalId: string,
): Promise<ProviderEligibility> {
  try {
    const [provider] = await db
      .select({
        systemRole: users.role,
        professionalRole: users.professionalRole,
        professionalCategory: users.professionalCategory,
        credentialBody: users.credentialBody,
        credentialNumber: users.credentialNumber,
        organizationId: users.organizationId,
        isProCare: users.isProCare,
        studioId: studios.id,
        studioStatus: studios.status,
        verificationStatus: studios.verificationStatus,
      })
      .from(users)
      .leftJoin(studios, eq(studios.ownerUserId, users.id))
      .where(eq(users.id, professionalId))
      .limit(1);

    if (!provider) {
      return {
        allowed: false,
        reason: "professional_account_inactive",
        professionalRole: null,
        studioId: null,
        organizationId: null,
      };
    }

    const readiness = await getProviderStudioReadiness(professionalId);
    const professionalRole =
      provider.systemRole === "admin" ? null : provider.professionalRole;
    const professionalAccountActive =
      provider.isProCare === true &&
      provider.studioStatus === "active" &&
      readiness.ok;
    const credentialVerified = hasVerifiedCredential(provider);
    const decision = evaluateProfessionalGlucoseAccess({
      authenticated: true,
      professionalAccountActive,
      professionalRole,
      credentialVerified,
      sameOrganization: true,
      activeExactRelationship: true,
      patientMatchesRelationship: true,
      clinicalConsentActive: true,
    });

    return {
      allowed: decision.allowed,
      reason: decision.reason,
      professionalRole,
      studioId: provider.studioId ?? null,
      organizationId: provider.organizationId ?? null,
    };
  } catch {
    return {
      allowed: false,
      reason: "authorization_check_failed",
      professionalRole: null,
      studioId: null,
      organizationId: null,
    };
  }
}

async function hasCurrentClinicalConsent(clientId: string): Promise<boolean> {
  const currentVersion = getCurrentVersion("patient_clinical_data_consent");
  if (currentVersion === null) return false;
  const [acceptance] = await db
    .select({ id: userDocumentAcceptance.id })
    .from(userDocumentAcceptance)
    .where(
      and(
        eq(userDocumentAcceptance.userId, clientId),
        eq(
          userDocumentAcceptance.documentType,
          "patient_clinical_data_consent",
        ),
        gte(userDocumentAcceptance.version, currentVersion),
      ),
    )
    .limit(1);
  return !!acceptance;
}

export interface ResolvedProfessionalGlucoseAccess
  extends ProfessionalGlucoseAccessDecision {
  studioId: string | null;
  organizationId: string | null;
}

export async function resolveProfessionalGlucoseAccess(
  professionalId: string,
  clientId: string,
): Promise<ResolvedProfessionalGlucoseAccess> {
  const provider = await resolveProviderEligibility(professionalId);
  if (!provider.allowed || !provider.studioId) {
    return {
      allowed: false,
      reason: provider.reason,
      professionalRole: provider.professionalRole,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
    };
  }

  try {
    const [clientIdentity, relationship, clinicalConsentActive] =
      await Promise.all([
        db
          .select({ organizationId: users.organizationId })
          .from(users)
          .where(eq(users.id, clientId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            clientUserId: clientLinks.clientUserId,
          })
          .from(clientLinks)
          .innerJoin(
            studioMemberships,
            and(
              eq(studioMemberships.studioId, provider.studioId),
              eq(studioMemberships.clientUserId, clientLinks.clientUserId),
            ),
          )
          .where(
            and(
              eq(clientLinks.proUserId, professionalId),
              eq(clientLinks.clientUserId, clientId),
              eq(clientLinks.active, true),
              eq(studioMemberships.status, "active"),
              eq(studioMemberships.isArchived, false),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        hasCurrentClinicalConsent(clientId),
      ]);
    const sameOrganization =
      !!clientIdentity &&
      (provider.organizationId ?? MPM_PUBLIC_ORG_ID) ===
        (clientIdentity.organizationId ?? MPM_PUBLIC_ORG_ID);

    const decision = evaluateProfessionalGlucoseAccess({
      authenticated: true,
      professionalAccountActive: true,
      professionalRole: provider.professionalRole,
      credentialVerified: true,
      sameOrganization,
      activeExactRelationship: !!relationship,
      patientMatchesRelationship: relationship?.clientUserId === clientId,
      clinicalConsentActive,
    });

    return {
      ...decision,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
    };
  } catch {
    return {
      allowed: false,
      reason: "authorization_check_failed",
      professionalRole: provider.professionalRole,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
    };
  }
}

interface LatestGlucoseSummaryRow {
  clientUserId: string;
  valueMgdl: number;
  context: ProfessionalGlucoseContext;
  recordedAt: Date | string;
  timeZone: string | null;
  guardrails: Guardrails | null;
}

function localTimestamp(recordedAt: Date, timeZone: string): {
  patientLocalDate: string;
  patientLocalTime: string;
} {
  const patientLocalDate = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(recordedAt);
  const patientLocalTime = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(recordedAt);
  return { patientLocalDate, patientLocalTime };
}

export async function queryProfessionalGlucoseClientSummaries(
  professionalId: string,
): Promise<
  | {
      allowed: true;
      professionalRole: string;
      studioId: string;
      organizationId: string | null;
      data: ProfessionalGlucoseClientSummariesResponse;
    }
  | {
      allowed: false;
      professionalRole: string | null;
      studioId: string | null;
      organizationId: string | null;
      reason: ProfessionalGlucoseAccessReason;
    }
> {
  const provider = await resolveProviderEligibility(professionalId);
  if (
    !provider.allowed ||
    !provider.studioId ||
    !provider.professionalRole
  ) {
    return {
      allowed: false,
      professionalRole: provider.professionalRole,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
      reason: provider.reason,
    };
  }
  if (provider.professionalRole !== "physician") {
    return {
      allowed: false,
      professionalRole: provider.professionalRole,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
      reason: "clinical_role_not_approved",
    };
  }

  const currentConsentVersion = getCurrentVersion(
    "patient_clinical_data_consent",
  );
  if (currentConsentVersion === null) {
    return {
      allowed: false,
      professionalRole: provider.professionalRole,
      studioId: provider.studioId,
      organizationId: provider.organizationId,
      reason: "clinical_consent_missing",
    };
  }

  const effectiveOrganizationId = await getUserOrgId(professionalId);
  const result = await db.execute(sql`
    SELECT DISTINCT ON (gl.user_id)
      gl.user_id AS "clientUserId",
      gl.value_mgdl AS "valueMgdl",
      gl.context AS "context",
      gl.recorded_at AS "recordedAt",
      client.timezone AS "timeZone",
      dp.guardrails AS "guardrails"
    FROM glucose_logs gl
    INNER JOIN studio_memberships sm
      ON sm.client_user_id = gl.user_id
      AND sm.studio_id = ${provider.studioId}
      AND sm.status = 'active'
      AND sm.is_archived = false
    INNER JOIN client_links cl
      ON cl.client_user_id = gl.user_id
      AND cl.pro_user_id = ${professionalId}
      AND cl.active = true
    INNER JOIN users client
      ON client.id = gl.user_id
    INNER JOIN user_document_acceptance consent
      ON consent.user_id = gl.user_id
      AND consent.document_type = 'patient_clinical_data_consent'
      AND consent.version >= ${currentConsentVersion}
    LEFT JOIN diabetes_profile dp
      ON dp.user_id::text = gl.user_id
    WHERE COALESCE(client.organization_id::text, ${MPM_PUBLIC_ORG_ID})
      = ${effectiveOrganizationId}
    ORDER BY gl.user_id, gl.recorded_at DESC
  `);

  const rows = (result.rows ?? []) as unknown as LatestGlucoseSummaryRow[];
  const summaries = rows.map((row) => {
    const recordedAt = new Date(row.recordedAt);
    let timeZone = row.timeZone || "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(recordedAt);
    } catch {
      timeZone = "UTC";
    }
    const local = localTimestamp(recordedAt, timeZone);
    const target =
      buildProfessionalGlucoseTargetRanges(row.guardrails)[row.context] ?? null;
    return {
      clientUserId: row.clientUserId,
      latestReading: {
        value: Number(row.valueMgdl),
        unit: "mg/dL" as const,
        recordedAt: recordedAt.toISOString(),
        context: row.context,
        patientLocalDate: local.patientLocalDate,
        patientLocalTime: local.patientLocalTime,
        patientTimeZone: timeZone,
        targetRange: target,
        rangeStatus: classifyProfessionalGlucoseReading(
          Number(row.valueMgdl),
          target,
        ),
      },
    };
  });

  return {
    allowed: true,
    professionalRole: provider.professionalRole,
    studioId: provider.studioId,
    organizationId: provider.organizationId,
    data: { summaries },
  };
}