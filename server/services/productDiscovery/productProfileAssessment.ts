import { createHash } from "node:crypto";
import type { ProductSubjectSnapshot } from "./subjectAuthority";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "./ruleEvidenceRegistry";

/** Same-day, safety-relevant authority; never compare per-request HFC IDs. */
export function productProfileReference(subject: ProductSubjectSnapshot): string {
  const { fingerprint: _requestFingerprint, issues: _issues, ...stable } = subject;
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function projectCurrentShoppingAssessments<T extends { ingredientMetadata?: any }>(
  rows: T[], subject: ProductSubjectSnapshot | null,
): T[] {
  return rows.map(row => {
    const product = row.ingredientMetadata?.selectedProduct;
    const assessment = product?.assessment;
    if (!assessment || !["eligible_at_evaluation", "profile_matched"].includes(assessment.status)) return row;
    if (assessment.status === "eligible_at_evaluation" && subject?.status === "resolved" &&
        subject.protocolStateReference &&
        assessment.subjectReference === subject.subjectId &&
        assessment.policyVersion === DEVELOPMENT_CATALOG_IDENTITY_POLICY.version &&
        assessment.profileContextReference === productProfileReference(subject)) return row;
    // Response projection only: retain the stored identity, facts, original
    // source payload and historical timestamps. Never backfill or grant access.
    return { ...row, ingredientMetadata: { ...row.ingredientMetadata, selectedProduct: {
      ...product, assessment: { ...assessment, status: "review_required",
        unresolvedRequirements: [...new Set([...assessment.unresolvedRequirements,
          subject?.status === "resolved" ? "current_profile_reassessment_required" : "customer_profile_unavailable"])],
        reasons: [...assessment.reasons, subject?.status === "resolved"
          ? "This earlier assessment does not establish compatibility with your current profile."
          : "Your current profile could not be confirmed; compatibility is unknown."],
      },
    } } };
  });
}

export async function currentShoppingAssessments<T extends { ingredientMetadata?: any }>(
  userId: string, rows: T[],
): Promise<T[]> {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT ||
      !rows.some(row => ["eligible_at_evaluation", "profile_matched"].includes(
        row.ingredientMetadata?.selectedProduct?.assessment?.status))) return rows;
  let subject: ProductSubjectSnapshot | null = null;
  try {
    const { db } = await import("../../db");
    const { users } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select({ timezone: users.timezone }).from(users)
      .where(eq(users.id, userId)).limit(1);
    if (user) {
      const dateISO = new Intl.DateTimeFormat("en-CA", {
        timeZone: user.timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const { resolveProductSubjectAuthority } = await import("./subjectAuthority");
      subject = await resolveProductSubjectAuthority({
        actorUserId: userId, subjectUserId: userId, subjectKind: "account", dateISO,
        includeShoppingGuidance: true,
      });
    }
  } catch {
    // Failure is represented as unknown on each affected assessment, never as
    // an unrestricted profile or a failed shopping-list load.
    subject = null;
  }
  return projectCurrentShoppingAssessments(rows, subject);
}
