import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendWhiteLabelAdminNotification, sendWhiteLabelApplicantConfirmation } from "../services/emailService";

const router = Router();

router.post("/inquiry", async (req, res) => {
  try {
    const { name, email, businessName, audienceSize, useCase, checkboxesAcknowledged, stagesAcknowledged } = req.body;

    if (!name || !email || !businessName || !useCase) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!Array.isArray(checkboxesAcknowledged) || !checkboxesAcknowledged.every(Boolean)) {
      return res.status(400).json({ error: "All acknowledgment checkboxes must be confirmed" });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null;
    const userAgent = req.headers["user-agent"] || null;

    const result = await db.execute(sql`
      INSERT INTO white_label_inquiries
        (name, email, business_name, audience_size, use_case, checkboxes_acknowledged, stages_acknowledged, ip_address, user_agent)
      VALUES
        (${name}, ${email}, ${businessName}, ${audienceSize || null}, ${useCase},
         ${JSON.stringify(checkboxesAcknowledged)}::jsonb,
         ${JSON.stringify(stagesAcknowledged)}::jsonb,
         ${ipAddress}, ${userAgent})
      RETURNING id, submitted_at
    `);

    const inquiry = (result.rows as any[])[0];

    await Promise.allSettled([
      sendWhiteLabelAdminNotification({ name, email, businessName, audienceSize, useCase }),
      sendWhiteLabelApplicantConfirmation({ name, email }),
    ]);

    return res.json({ success: true, id: inquiry?.id });
  } catch (err: any) {
    console.error("[white-label] inquiry submit error:", err.message);
    return res.status(500).json({ error: "Failed to submit application" });
  }
});

export default router;
