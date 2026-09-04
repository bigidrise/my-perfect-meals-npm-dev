import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { founderConsent, founderTestimonials } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

/**
 * POST /api/founders/consent
 * Store user consent for Week-3 testimonial reminder
 */
router.post("/consent", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cohort: z.string().default("ALPHA"),
      hasConsented: z.boolean(),
    });

    const { userId, cohort, hasConsented } = schema.parse(req.body);
    const authUserId = (req as AuthenticatedRequest).authUser.id;
    if (userId !== authUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Upsert consent record
    const existing = await db
      .select()
      .from(founderConsent)
      .where(eq(founderConsent.userId, authUserId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(founderConsent)
        .set({
          hasConsented,
          consentedAt: hasConsented ? new Date() : null,
          reminderScheduled: hasConsented, // Schedule reminder if consented
        })
        .where(eq(founderConsent.userId, authUserId));
    } else {
      // Create new
      await db.insert(founderConsent).values({
        userId: authUserId,
        cohort,
        hasConsented,
        consentedAt: hasConsented ? new Date() : null,
        reminderScheduled: hasConsented,
      });
    }

    res.json({ 
      success: true,
      message: hasConsented 
        ? "You'll receive a reminder on Day 21 to submit your testimonial!" 
        : "Consent updated successfully"
    });
  } catch (error) {
    console.error("Error saving founder consent:", error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : "Failed to save consent" 
    });
  }
});

/**
 * POST /api/founders
 * Save founder testimonial (quote + media)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cohort: z.string().default("ALPHA"),
      name: z.string(),
      quote: z.string().min(10, "Quote must be at least 10 characters"),
      photoUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      audioUrl: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const authUserId = (req as AuthenticatedRequest).authUser.id;
    if (data.userId !== authUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [testimonial] = await db
      .insert(founderTestimonials)
      .values({ ...data, userId: authUserId } as any)
      .returning();

    res.json({ 
      success: true,
      testimonial,
      message: "Thank you for sharing your journey! Your testimonial has been saved." 
    });
  } catch (error) {
    console.error("Error saving founder testimonial:", error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : "Failed to save testimonial" 
    });
  }
});

/**
 * GET /api/founders
 * Get all founder testimonials (featured first)
 */
router.get("/", async (req, res) => {
  try {
    const cohort = req.query.cohort as string | undefined;

    let query = db.select().from(founderTestimonials);

    if (cohort) {
      query = query.where(eq(founderTestimonials.cohort, cohort)) as any;
    }

    const testimonials = await query.orderBy(
      desc(founderTestimonials.isFeatured),
      desc(founderTestimonials.createdAt)
    );

    res.json({ testimonials });
  } catch (error) {
    console.error("Error fetching founder testimonials:", error);
    res.status(500).json({ 
      error: "Failed to fetch testimonials" 
    });
  }
});

/**
 * GET /api/founders/consent/:userId
 * Get user's consent status
 */
router.get("/consent/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUserId = (req as AuthenticatedRequest).authUser.id;
    if (userId !== authUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [consent] = await db
      .select()
      .from(founderConsent)
      .where(eq(founderConsent.userId, authUserId))
      .limit(1);

    res.json({ consent: consent || null });
  } catch (error) {
    console.error("Error fetching founder consent:", error);
    res.status(500).json({ 
      error: "Failed to fetch consent" 
    });
  }
});

export default router;
