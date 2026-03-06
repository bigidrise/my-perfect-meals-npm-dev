import { db } from "../db";
import { userDocumentAcceptance } from "../db/schema/legal";
import { eq } from "drizzle-orm";
import { getRequiredDocuments, type LegalFlow } from "../../shared/legalDocuments";

export async function checkLegalAcceptance(userId: string, flow: LegalFlow): Promise<{ allAccepted: boolean; missing: string[] }> {
  const requiredDocs = getRequiredDocuments(flow);

  const userAcceptances = await db
    .select()
    .from(userDocumentAcceptance)
    .where(eq(userDocumentAcceptance.userId, userId));

  const acceptanceMap = new Map<string, number>();
  for (const a of userAcceptances) {
    const existing = acceptanceMap.get(a.documentType) || 0;
    if (a.version > existing) {
      acceptanceMap.set(a.documentType, a.version);
    }
  }

  const missing = requiredDocs
    .filter((doc) => {
      const acceptedVersion = acceptanceMap.get(doc.type) || 0;
      return acceptedVersion < doc.version;
    })
    .map((doc) => doc.type);

  return { allAccepted: missing.length === 0, missing };
}
