import { Router } from "express";
import { USE_FACEBOOK, FB_GROUP_ID, FB_TOKEN } from "../config";
import { db } from "../db";
import { userTestimonials } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/facebook/share
 * Body: { testimonialId: string }
 * Behavior:
 *  1) fetch testimonial
 *  2) post to FB group as admin (Graph API)
 *  3) update status -> "posted" | "failed"
 */
router.post("/share", async (req, res) => {
  if (!USE_FACEBOOK) return res.status(503).json({ success: false, error: "Facebook disabled" });
  if (!FB_GROUP_ID || !FB_TOKEN) return res.status(500).json({ success: false, error: "Missing FB env" });

  const { testimonialId } = req.body ?? {};
  if (!testimonialId) return res.status(400).json({ success: false, error: "Missing testimonialId" });

  // 1) read testimonial
  const rows = await db.select().from(userTestimonials).where(eq(userTestimonials.id, testimonialId)).limit(1);
  const t = rows[0];
  if (!t) return res.status(404).json({ success: false, error: "Testimonial not found" });

  try {
    // 2) Graph API: https://graph.facebook.com/{group-id}/feed  (message + access_token)
    const resp = await fetch(`https://graph.facebook.com/${FB_GROUP_ID}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: t.content,
        access_token: FB_TOKEN,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      // mark failed
      await db.update(userTestimonials).set({ status: "failed" }).where(eq(userTestimonials.id, testimonialId));
      return res.status(resp.status).json({ success: false, error: json?.error?.message || "Facebook post failed" });
    }

    // 3) mark posted
    await db.update(userTestimonials).set({ status: "posted" }).where(eq(userTestimonials.id, testimonialId));
    return res.json({ success: true, facebook: json });
  } catch (e: any) {
    await db.update(userTestimonials).set({ status: "failed" }).where(eq(userTestimonials.id, testimonialId));
    return res.status(502).json({ success: false, error: e?.message || "Network error" });
  }
});

export { router as facebookRouter };