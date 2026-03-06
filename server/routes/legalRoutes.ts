import { Router } from "express";
import { db } from "../db";
import { userDocumentAcceptance } from "../db/schema/legal";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getRequiredDocuments, getCurrentVersion, type LegalFlow } from "../../shared/legalDocuments";

const router = Router();

router.post("/accept", requireAuth, async (req: any, res) => {
  try {
    const userId = req.authUser.id;
    const { documentType, version } = req.body;

    if (!documentType || !version) {
      return res.status(400).json({ error: "documentType and version are required" });
    }

    const currentVersion = getCurrentVersion(documentType);
    if (currentVersion === null) {
      return res.status(400).json({ error: "Unknown document type" });
    }

    if (version !== currentVersion) {
      return res.status(400).json({ error: "Version mismatch. Please accept the current version." });
    }

    const existing = await db
      .select()
      .from(userDocumentAcceptance)
      .where(
        and(
          eq(userDocumentAcceptance.userId, userId),
          eq(userDocumentAcceptance.documentType, documentType),
          eq(userDocumentAcceptance.version, version)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ accepted: true, alreadyAccepted: true });
    }

    const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    await db.insert(userDocumentAcceptance).values({
      userId,
      documentType,
      version,
      ipAddress,
      userAgent,
    });

    res.json({ accepted: true });
  } catch (error) {
    console.error("Error accepting document:", error);
    res.status(500).json({ error: "Failed to record acceptance" });
  }
});

router.get("/status", requireAuth, async (req: any, res) => {
  try {
    const userId = req.authUser.id;
    const flow = req.query.flow as LegalFlow | undefined;

    if (!flow || !["client", "professional", "attestation"].includes(flow)) {
      return res.status(400).json({ error: "flow query parameter required (client, professional, or attestation)" });
    }

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

    const documents = requiredDocs.map((doc) => {
      const acceptedVersion = acceptanceMap.get(doc.type) || 0;
      return {
        type: doc.type,
        requiredVersion: doc.version,
        acceptedVersion,
        isCurrent: acceptedVersion >= doc.version,
      };
    });

    const missing = documents.filter((d) => !d.isCurrent).map((d) => d.type);

    res.json({ documents, missing, allAccepted: missing.length === 0 });
  } catch (error) {
    console.error("Error checking legal status:", error);
    res.status(500).json({ error: "Failed to check legal status" });
  }
});

export default router;
