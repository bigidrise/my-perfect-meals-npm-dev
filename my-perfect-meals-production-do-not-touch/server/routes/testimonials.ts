import { Router } from "express";
import { db } from "../db"; // your drizzle db instance
import { userTestimonials, insertUserTestimonialSchema } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.post("/create", async (req, res) => {
  try {
    const data = insertUserTestimonialSchema.parse(req.body);
    const [row] = await db.insert(userTestimonials).values(data).returning();
    return res.status(201).json({ success: true, testimonial: row });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    const isValidation = !!err?.issues;
    return res.status(isValidation ? 400 : 500).json({ success: false, error: msg });
  }
});

// GET /api/testimonials - List testimonials with pagination and filtering
router.get("/", async (req, res) => {
  try {
    const { status, offset = "0", limit = "20" } = req.query;
    const offsetNum = parseInt(offset as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    let items;
    
    if (status && typeof status === "string") {
      items = await db
        .select()
        .from(userTestimonials)
        .where(eq(userTestimonials.status, status as any))
        .orderBy(desc(userTestimonials.createdAt))
        .limit(limitNum)
        .offset(offsetNum);
    } else {
      items = await db
        .select()
        .from(userTestimonials)
        .orderBy(desc(userTestimonials.createdAt))
        .limit(limitNum)
        .offset(offsetNum);
    }
    
    return res.json({ 
      success: true, 
      items, 
      limit: limitNum, 
      offset: offsetNum 
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "List failed" });
  }
});

// PATCH /api/testimonials/:id/status - Update testimonial status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!["pending", "posted", "failed"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }
    
    const [testimonial] = await db
      .update(userTestimonials)
      .set({ status })
      .where(eq(userTestimonials.id, id))
      .returning();
    
    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }
    
    return res.json({ success: true, testimonial });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Update failed" });
  }
});

export { router as testimonialsRouter };