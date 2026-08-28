import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  hydrationClinicianDirectives,
  hydrationPolicyVersions,
} from "../../db/schema/hydration";
import {
  HYDRATION_NUMERIC_POLICY_VERSION,
  type HydrationDirectiveTargetKind,
  type HydrationNumericDirective,
} from "@shared/hydration/numericPolicy";

const POLICY_KEY = "MPM-HYDRATION-NUMERIC-POLICY";
const POLICY_VERSION = "v0.1";

export type CreateHydrationClinicianDirectiveInput = Readonly<{
  subjectUserId: string;
  organizationId: string;
  authorityUserId: string;
  targetKind: HydrationDirectiveTargetKind;
  targetMl: number | null;
  minimumMl: number | null;
  maximumMl: number | null;
  effectiveAt: Date;
  reviewAt: Date;
  expiresAt: Date;
  reasonCode: string;
  rationaleCode: string;
  sourceReference: string;
  consentReference: string;
}>;

type DirectiveRow = typeof hydrationClinicianDirectives.$inferSelect;

function mapDirective(row: DirectiveRow): HydrationNumericDirective {
  return {
    id: row.id,
    subjectUserId: row.subjectUserId,
    organizationId: row.organizationId ?? "",
    authorityUserId: row.authorUserId ?? row.createdByUserId ?? "",
    targetKind: row.targetKind as HydrationDirectiveTargetKind,
    targetMl: row.targetMl,
    minimumMl: row.minimumMl,
    maximumMl: row.maximumMl,
    status:
      row.status === "active"
        ? "active"
        : row.status === "superseded"
          ? "superseded"
          : "revoked",
    effectiveAt: row.effectiveAt.toISOString(),
    reviewAt: row.reviewAt?.toISOString() ?? "",
    expiresAt: row.expiresAt?.toISOString() ?? "",
    reasonCode: row.reasonCode,
    rationaleCode: row.rationaleCode,
    sourceReference: row.sourceReference ?? "",
    consentReference: row.consentReference ?? "",
    policyVersion: HYDRATION_NUMERIC_POLICY_VERSION,
  };
}

async function getPolicyVersionId(
  executor: Pick<typeof db, "select"> = db,
): Promise<string> {
  const [policy] = await executor
    .select({ id: hydrationPolicyVersions.id })
    .from(hydrationPolicyVersions)
    .where(
      and(
        eq(hydrationPolicyVersions.policyKey, POLICY_KEY),
        eq(hydrationPolicyVersions.version, POLICY_VERSION),
        eq(hydrationPolicyVersions.status, "approved_inactive"),
      ),
    )
    .limit(1);
  if (!policy) throw new Error("HYDRATION_NUMERIC_POLICY_NOT_REGISTERED");
  return policy.id;
}

export type HydrationClinicianDirectiveResolution = Readonly<{
  directive: HydrationNumericDirective | null;
  conflict: boolean;
}>;

export async function getHydrationClinicianDirectiveResolution(
  subjectUserId: string,
  now = new Date(),
): Promise<HydrationClinicianDirectiveResolution> {
  const rows = await db
    .select({ directive: hydrationClinicianDirectives })
    .from(hydrationClinicianDirectives)
    .innerJoin(
      hydrationPolicyVersions,
      eq(
        hydrationClinicianDirectives.policyVersionId,
        hydrationPolicyVersions.id,
      ),
    )
    .where(
      and(
        eq(hydrationClinicianDirectives.subjectUserId, subjectUserId),
        eq(hydrationClinicianDirectives.status, "active"),
        lte(hydrationClinicianDirectives.effectiveAt, now),
        eq(hydrationPolicyVersions.policyKey, POLICY_KEY),
        eq(hydrationPolicyVersions.version, POLICY_VERSION),
      ),
    )
    .orderBy(desc(hydrationClinicianDirectives.effectiveAt))
    .limit(2);

  if (rows.length > 1) return { directive: null, conflict: true };
  return {
    directive: rows[0] ? mapDirective(rows[0].directive) : null,
    conflict: false,
  };
}

export async function createHydrationClinicianDirective(
  input: CreateHydrationClinicianDirectiveInput,
): Promise<HydrationNumericDirective> {
  const policyVersionId = await getPolicyVersionId();
  return db.transaction(async (tx) => {
    await tx
      .update(hydrationClinicianDirectives)
      .set({ status: "superseded" })
      .where(
        and(
          eq(
            hydrationClinicianDirectives.subjectUserId,
            input.subjectUserId,
          ),
          eq(hydrationClinicianDirectives.status, "active"),
        ),
      );

    const [created] = await tx
      .insert(hydrationClinicianDirectives)
      .values({
        subjectUserId: input.subjectUserId,
        organizationId: input.organizationId,
        authorUserId: input.authorityUserId,
        directiveKind: "daily_total",
        targetKind: input.targetKind,
        targetMl: input.targetMl,
        minimumMl: input.minimumMl,
        maximumMl: input.maximumMl,
        reviewAt: input.reviewAt,
        reasonCode: input.reasonCode,
        consentReference: input.consentReference,
        policyVersionId,
        status: "active",
        effectiveAt: input.effectiveAt,
        expiresAt: input.expiresAt,
        rationaleCode: input.rationaleCode,
        sourceReference: input.sourceReference,
        createdByUserId: input.authorityUserId,
      })
      .returning();
    if (!created) throw new Error("HYDRATION_DIRECTIVE_CREATE_FAILED");
    return mapDirective(created);
  });
}

export async function revokeHydrationClinicianDirective(
  subjectUserId: string,
  directiveId: string,
  authorityUserId: string,
): Promise<boolean> {
  const rows = await db
    .update(hydrationClinicianDirectives)
    .set({
      status: "revoked",
      rationaleCode: "REVOKED_BY_AUTHORIZED_CLINICIAN",
      sourceReference: `revoked-by:${authorityUserId}`,
    })
    .where(
      and(
        eq(hydrationClinicianDirectives.id, directiveId),
        eq(hydrationClinicianDirectives.subjectUserId, subjectUserId),
        eq(hydrationClinicianDirectives.status, "active"),
      ),
    )
    .returning({ id: hydrationClinicianDirectives.id });
  return rows.length === 1;
}