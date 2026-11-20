import { auditProfessionalLegalAcceptance, assessProfessionalLegalAcceptances } from "../services/professionalLegalAudit";
import { getRequiredDocuments } from "../../shared/legalDocuments";

const accepted = (id: string, flow: "professional" | "physician") =>
  [...getRequiredDocuments("attestation"), ...getRequiredDocuments(flow)]
    .map(doc => ({ user_id: id, document_type: doc.type, version: doc.version }));

test("trainer and physician audit classifications use their distinct current documents", () => {
  expect(assessProfessionalLegalAcceptances("trainer", accepted("a", "professional")).missing).toEqual([]);
  expect(assessProfessionalLegalAcceptances("physician", accepted("a", "physician")).missing).toEqual([]);
  expect(assessProfessionalLegalAcceptances("physician", accepted("a", "professional")).missing).toHaveLength(3);
  expect(assessProfessionalLegalAcceptances("trainer", []).missing).toHaveLength(4);
  expect(assessProfessionalLegalAcceptances("business", []).roleReviewRequired).toBe(true);
});

test("audit is database-enforced read-only, rolls back, and emits no account identifiers", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("current_setting")) return { rows: [{ read_only: "on" }] };
    if (sql.includes("FROM users") && sql.includes("WHERE is_pro_care")) return { rows: [
      { id: "synthetic-trainer", professional_role: "trainer", is_pro_care: true },
      { id: "synthetic-physician", professional_role: "physician", is_pro_care: true },
    ] };
    if (sql.includes("FROM users u")) return { rows: [{ id: "synthetic-trainer", professional_role: "trainer", is_pro_care: true, studio_name_match: true }] };
    if (sql.includes("FROM user_document_acceptance")) return { rows: accepted("synthetic-physician", "physician") };
    return { rows: [] };
  });
  const result = await auditProfessionalLegalAcceptance({ query } as any, { accountName: "Synthetic", studioName: "Fixture Studio" });
  expect(result.summary).toEqual({ activeProfessionalsChecked: 2, missingAttestation: 1, missingProfessionalDocuments: 1, roleReviewRequired: 0, fullyCurrent: 1 });
  expect(result.requestedAccountMatch?.studioOwnerMatches).toBe(1);
  expect(result.missingByDocument.professional_attestation.accountsMissing).toBe(1);
  expect(query.mock.calls[0][0]).toContain("READ ONLY");
  expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  expect(query.mock.calls.every(([sql]) => !/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|TRUNCATE)\b/i.test(sql))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/synthetic-trainer|synthetic-physician|Fixture Studio|Synthetic/);
});

test("failure to establish read-only mode aborts and still rolls back", async () => {
  const query = jest.fn(async (sql: string) => ({ rows: sql.includes("current_setting") ? [{ read_only: "off" }] : [] }));
  await expect(auditProfessionalLegalAcceptance({ query } as any)).rejects.toThrow("Read-only transaction");
  expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  expect(query).toHaveBeenCalledTimes(3);
});
