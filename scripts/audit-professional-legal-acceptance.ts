import { Client } from "pg";
import { LEGAL_DOCUMENTS } from "../shared/legalDocuments";

type AcceptanceRow = {
  user_id: string;
  document_type: string | null;
  version: number | null;
};

type ProfessionalRow = {
  id: string;
  email: string;
  professional_role: "trainer" | "physician" | "dietitian" | "nurse_practitioner";
};

function requestedEmail(): string | null {
  const arg = process.argv.find((value) => value.startsWith("--email="));
  return arg ? arg.slice("--email=".length).trim().toLowerCase() : null;
}

function summaryOnly(): boolean {
  return process.argv.includes("--summary-only");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const email = requestedEmail();
  const values: string[] = [];
  const emailClause = email ? "AND lower(u.email) = $1" : "";
  if (email) values.push(email);

  const professionals = await client.query<ProfessionalRow>(
    `SELECT u.id, u.email, u.professional_role
       FROM users u
      WHERE u.is_pro_care = true
        AND u.professional_role IN ('trainer', 'physician', 'dietitian', 'nurse_practitioner')
        ${emailClause}
      ORDER BY lower(u.email)`,
    values,
  );

  const userIds = professionals.rows.map((row) => row.id);
  const acceptances = userIds.length === 0
    ? { rows: [] as AcceptanceRow[] }
    : await client.query<AcceptanceRow>(
        `SELECT user_id, document_type, version
           FROM user_document_acceptance
          WHERE user_id = ANY($1::text[])`,
        [userIds],
      );

  const versionsByUser = new Map<string, Map<string, number>>();
  for (const acceptance of acceptances.rows) {
    if (!acceptance.document_type || acceptance.version == null) continue;
    const byDocument = versionsByUser.get(acceptance.user_id) || new Map<string, number>();
    byDocument.set(
      acceptance.document_type,
      Math.max(byDocument.get(acceptance.document_type) || 0, acceptance.version),
    );
    versionsByUser.set(acceptance.user_id, byDocument);
  }

  const findings = professionals.rows.map((professional) => {
    const versions = versionsByUser.get(professional.id) || new Map<string, number>();
    const attestation = LEGAL_DOCUMENTS.attestation[0];
    const acceptedAttestationVersion = versions.get(attestation.type) || 0;
    const requiredProfessionalDocs = professional.professional_role === "physician"
      ? LEGAL_DOCUMENTS.physician
      : LEGAL_DOCUMENTS.professional;

    const missingLegalDocumentVersions = requiredProfessionalDocs
      .filter((document) => (versions.get(document.type) || 0) < document.version)
      .map((document) => ({
        documentType: document.type,
        requiredVersion: document.version,
        acceptedVersion: versions.get(document.type) || 0,
      }));

    return {
      userId: professional.id,
      email: professional.email,
      professionalRole: professional.professional_role,
      missingAttestation: acceptedAttestationVersion < attestation.version,
      attestationRequiredVersion: attestation.version,
      attestationAcceptedVersion: acceptedAttestationVersion,
      missingLegalDocumentVersions,
    };
  });

  const affected = findings.filter(
    (finding) => finding.missingAttestation || finding.missingLegalDocumentVersions.length > 0,
  );

  console.log(JSON.stringify({
    readOnly: true,
    filter: email ? { email } : null,
    summary: {
      activeProfessionalsChecked: findings.length,
      missingAttestation: findings.filter((finding) => finding.missingAttestation).length,
      missingLegalDocumentVersions: findings.filter(
        (finding) => finding.missingLegalDocumentVersions.length > 0,
      ).length,
      fullyCurrent: findings.length - affected.length,
    },
    ...(!summaryOnly() && { affected }),
  }, null, 2));
  await client.end();
}

main()
  .catch((error) => {
    console.error("Professional legal acceptance audit failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });