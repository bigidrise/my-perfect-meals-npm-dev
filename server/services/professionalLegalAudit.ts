import type { Client } from "pg";
import { getRequiredDocuments } from "../../shared/legalDocuments";
import { isCanonicalPractitionerRole } from "../../shared/professionalRoles";

type Professional = { id: string; professional_role: string | null; is_pro_care: boolean; account_name_match?: boolean; account_brand_match?: boolean; studio_name_match?: boolean };
type Acceptance = { user_id: string; document_type: string; version: number };

export function assessProfessionalLegalAcceptances(role: string | null, acceptances: Acceptance[]) {
  if (!isCanonicalPractitionerRole(role)) return { roleReviewRequired: true, missing: [] };
  const required = [...getRequiredDocuments("attestation"), ...getRequiredDocuments(role === "physician" ? "physician" : "professional")];
  const versions = new Map<string, number>();
  for (const row of acceptances) versions.set(row.document_type, Math.max(versions.get(row.document_type) ?? 0, row.version));
  return {
    roleReviewRequired: false,
    missing: required.filter(doc => (versions.get(doc.type) ?? 0) < doc.version).map(doc => ({
      documentType: doc.type, requiredVersion: doc.version, acceptedVersion: versions.get(doc.type) ?? 0,
    })),
  };
}

/** A single repeatable-read, database-enforced read-only snapshot; never writes consent. */
export async function auditProfessionalLegalAcceptance(
  client: Pick<Client, "query">,
  options: { email?: string | null; accountName?: string | null; studioName?: string | null } = {},
) {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const { rows: [mode] } = await client.query<{ read_only: string }>("SELECT current_setting('transaction_read_only') AS read_only");
    if (mode?.read_only !== "on") throw new Error("Read-only transaction was not established.");
    const professionals = await client.query<Professional>(
      `SELECT id, professional_role, is_pro_care FROM users
       WHERE is_pro_care = true AND professional_role IS NOT NULL AND professional_role <> 'business'
       AND ($1::text IS NULL OR lower(email) = $1) ORDER BY id`, [options.email || null],
    );
    const name = options.accountName?.trim();
    const studio = options.studioName?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const targets = name || studio ? await client.query<Professional>(
      `SELECT u.id, u.professional_role, u.is_pro_care,
          ($1 <> '' AND (u.username ILIKE $1 OR u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)) AS account_name_match,
          ($2 <> '' AND (lower(regexp_replace(u.email, '[^a-zA-Z0-9]', '', 'g')) LIKE $2
            OR lower(regexp_replace(u.username, '[^a-zA-Z0-9]', '', 'g')) LIKE $2)) AS account_brand_match,
          EXISTS (SELECT 1 FROM studios s WHERE s.owner_user_id = u.id AND $2 <> ''
            AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) LIKE $2) AS studio_name_match
       FROM users u WHERE ($1 <> '' AND (u.username ILIKE $1 OR u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1))
          OR ($2 <> '' AND (lower(regexp_replace(u.email, '[^a-zA-Z0-9]', '', 'g')) LIKE $2
            OR lower(regexp_replace(u.username, '[^a-zA-Z0-9]', '', 'g')) LIKE $2))
          OR EXISTS (SELECT 1 FROM studios s WHERE s.owner_user_id = u.id AND $2 <> ''
            AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) LIKE $2)
       ORDER BY u.id LIMIT 101`,
      [name ? `%${name.replace(/[\\%_]/g, "\\$&")}%` : "", studio ? `%${studio}%` : ""],
    ) : { rows: [] as Professional[] };
    const ids = [...new Set([...professionals.rows, ...targets.rows].map(row => row.id))];
    const acceptances = ids.length ? await client.query<Acceptance>(
      "SELECT user_id, document_type, version FROM user_document_acceptance WHERE user_id = ANY($1::text[])", [ids],
    ) : { rows: [] as Acceptance[] };
    const assess = (row: Professional) => assessProfessionalLegalAcceptances(
      row.professional_role, acceptances.rows.filter(acceptance => acceptance.user_id === row.id),
    );
    const findings = professionals.rows.map(assess);
    const missingByDocument: Record<string, { requiredVersion: number; accountsMissing: number; missingRecord: number; outdatedVersion: number }> = {};
    for (const finding of findings) for (const doc of finding.missing) {
      const category = missingByDocument[doc.documentType] ??= { requiredVersion: doc.requiredVersion, accountsMissing: 0, missingRecord: 0, outdatedVersion: 0 };
      category.accountsMissing++;
      if (doc.acceptedVersion === 0) category.missingRecord++; else category.outdatedVersion++;
    }
    return {
      connectionAuthority: "application DATABASE_URL",
      readOnly: true, isolation: "repeatable read", completion: "rollback",
      summary: {
        activeProfessionalsChecked: findings.length,
        roleReviewRequired: findings.filter(row => row.roleReviewRequired).length,
        missingAttestation: findings.filter(row => row.missing.some(doc => doc.documentType === "professional_attestation")).length,
        missingProfessionalDocuments: findings.filter(row => row.missing.some(doc => doc.documentType !== "professional_attestation")).length,
        fullyCurrent: findings.filter(row => !row.roleReviewRequired && row.missing.length === 0).length,
      },
      missingByDocument,
      ...(name || studio ? { requestedAccountMatch: {
        candidateCount: targets.rows.length, truncated: targets.rows.length === 101,
        studioOwnerMatches: targets.rows.filter(row => row.studio_name_match).length,
        // No email, name, account ID, IP address or user agent is emitted.
        candidates: targets.rows.map(row => ({
          activeProfessional: row.is_pro_care, professionalRole: row.professional_role,
          accountNameMatch: row.account_name_match === true, studioNameMatch: row.studio_name_match === true,
          accountBrandMatch: row.account_brand_match === true,
          ...assess(row),
        })),
      } } : {}),
    };
  } finally {
    await client.query("ROLLBACK");
  }
}
