import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { bodyFatEntries } from "../db/schema/bodyComposition";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const createBodyFatSchema = z.object({
  currentBodyFatPct: z.number().min(1).max(70),
  goalBodyFatPct: z.number().min(1).max(70).optional().nullable(),
  scanMethod: z.enum(["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"]),
  source: z.enum(["client", "trainer", "physician"]).optional(),
  createdById: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().datetime(),
});

const updateBodyFatSchema = z.object({
  currentBodyFatPct: z.number().min(1).max(70).optional(),
  goalBodyFatPct: z.number().min(1).max(70).optional().nullable(),
  scanMethod: z.enum(["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"]).optional(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

// GET /api/users/:userId/body-composition/latest
// Returns the latest effective body fat entry with precedence: trainer/physician > client
router.get("/users/:userId/body-composition/latest", async (req, res) => {
  try {
    const { userId } = req.params;

    // First try to get the most recent trainer/physician entry
    const [trainerEntry] = await db.select()
      .from(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.userId, userId),
        eq(bodyFatEntries.source, "trainer")
      ))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(1);

    if (trainerEntry) {
      return res.json({ entry: trainerEntry, source: "trainer" });
    }

    // Check for physician entry
    const [physicianEntry] = await db.select()
      .from(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.userId, userId),
        eq(bodyFatEntries.source, "physician")
      ))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(1);

    if (physicianEntry) {
      return res.json({ entry: physicianEntry, source: "physician" });
    }

    // Fall back to client entry
    const [clientEntry] = await db.select()
      .from(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.userId, userId),
        eq(bodyFatEntries.source, "client")
      ))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(1);

    if (clientEntry) {
      return res.json({ entry: clientEntry, source: "client" });
    }

    // No entries found
    res.json({ entry: null, source: null });
  } catch (error) {
    console.error("Error fetching body composition:", error);
    res.status(500).json({ error: "Failed to fetch body composition" });
  }
});

// GET /api/users/:userId/body-composition/history
// Returns all body fat entries for the user
router.get("/users/:userId/body-composition/history", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = "20" } = req.query;

    const entries = await db.select()
      .from(bodyFatEntries)
      .where(eq(bodyFatEntries.userId, userId))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(parseInt(limit as string));

    res.json({ items: entries });
  } catch (error) {
    console.error("Error fetching body composition history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// POST /api/users/:userId/body-composition
// Create a new body fat entry
router.post("/users/:userId/body-composition", async (req, res) => {
  try {
    const { userId } = req.params;
    const data = createBodyFatSchema.parse(req.body);

    const [entry] = await db.insert(bodyFatEntries).values({
      userId,
      currentBodyFatPct: data.currentBodyFatPct.toString(),
      goalBodyFatPct: data.goalBodyFatPct?.toString() ?? null,
      scanMethod: data.scanMethod,
      source: data.source || "client",
      createdById: data.createdById || null,
      notes: data.notes || null,
      recordedAt: new Date(data.recordedAt),
    }).returning();

    res.json(entry);
  } catch (error) {
    console.error("Error creating body composition entry:", error);
    res.status(400).json({ error: "Failed to create entry" });
  }
});

// PUT /api/users/:userId/body-composition/:entryId
// Update an existing body fat entry
router.put("/users/:userId/body-composition/:entryId", async (req, res) => {
  try {
    const { userId, entryId } = req.params;
    const data = updateBodyFatSchema.parse(req.body);

    const updateData: any = { updatedAt: new Date() };
    if (data.currentBodyFatPct !== undefined) {
      updateData.currentBodyFatPct = data.currentBodyFatPct.toString();
    }
    if (data.goalBodyFatPct !== undefined) {
      updateData.goalBodyFatPct = data.goalBodyFatPct?.toString() ?? null;
    }
    if (data.scanMethod !== undefined) {
      updateData.scanMethod = data.scanMethod;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.recordedAt !== undefined) {
      updateData.recordedAt = new Date(data.recordedAt);
    }

    const [entry] = await db.update(bodyFatEntries)
      .set(updateData)
      .where(and(
        eq(bodyFatEntries.id, parseInt(entryId)),
        eq(bodyFatEntries.userId, userId)
      ))
      .returning();

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json(entry);
  } catch (error) {
    console.error("Error updating body composition entry:", error);
    res.status(400).json({ error: "Failed to update entry" });
  }
});

// DELETE /api/users/:userId/body-composition/:entryId
// Delete a body fat entry
router.delete("/users/:userId/body-composition/:entryId", async (req, res) => {
  try {
    const { userId, entryId } = req.params;

    const [deleted] = await db.delete(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.id, parseInt(entryId)),
        eq(bodyFatEntries.userId, userId)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting body composition entry:", error);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

// ProCare routes - for trainers/physicians to manage client body composition

// GET /api/pro/clients/:clientId/body-composition
// Get client's latest body fat (for trainer/physician dashboard)
router.get("/pro/clients/:clientId/body-composition", async (req, res) => {
  try {
    const { clientId } = req.params;

    const [entry] = await db.select()
      .from(bodyFatEntries)
      .where(eq(bodyFatEntries.userId, clientId))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(1);

    res.json({ entry: entry || null });
  } catch (error) {
    console.error("Error fetching client body composition:", error);
    res.status(500).json({ error: "Failed to fetch client data" });
  }
});

// POST /api/pro/clients/:clientId/body-composition
// Trainer/physician sets client's body fat (creates override entry)
router.post("/pro/clients/:clientId/body-composition", async (req, res) => {
  try {
    const { clientId } = req.params;
    const data = createBodyFatSchema.parse(req.body);

    // Source must be trainer or physician for ProCare entries
    const source = data.source === "physician" ? "physician" : "trainer";

    const [entry] = await db.insert(bodyFatEntries).values({
      userId: clientId,
      currentBodyFatPct: data.currentBodyFatPct.toString(),
      goalBodyFatPct: data.goalBodyFatPct?.toString() ?? null,
      scanMethod: data.scanMethod,
      source,
      createdById: data.createdById || null,
      notes: data.notes || null,
      recordedAt: new Date(data.recordedAt),
    }).returning();

    res.json(entry);
  } catch (error) {
    console.error("Error creating client body composition:", error);
    res.status(400).json({ error: "Failed to create entry" });
  }
});

export default router;
