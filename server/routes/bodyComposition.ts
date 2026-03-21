import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { bodyFatEntries } from "../db/schema/bodyComposition";
import { eq, and, desc } from "drizzle-orm";
import { createBodyFatSchema, updateBodyFatSchema } from "../../shared/bodyCompositionSchema";

const router = Router();

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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      res.status(400).json({ error: "Failed to create entry" });
    }
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

// PATCH /api/users/:userId/body-composition/goal
// Update only the goalBodyFatPct on the latest client entry (or create a minimal entry)
router.patch("/users/:userId/body-composition/goal", async (req, res) => {
  try {
    const { userId } = req.params;
    const schema = z.object({ goalBodyFatPct: z.number().min(3).max(60) });
    const { goalBodyFatPct } = schema.parse(req.body);

    const [latestClient] = await db.select()
      .from(bodyFatEntries)
      .where(and(
        eq(bodyFatEntries.userId, userId),
        eq(bodyFatEntries.source, "client")
      ))
      .orderBy(desc(bodyFatEntries.recordedAt))
      .limit(1);

    if (latestClient) {
      const [updated] = await db.update(bodyFatEntries)
        .set({ goalBodyFatPct: goalBodyFatPct.toString(), updatedAt: new Date() })
        .where(eq(bodyFatEntries.id, latestClient.id))
        .returning();
      return res.json({ entry: updated });
    }

    const [created] = await db.insert(bodyFatEntries).values({
      userId,
      currentBodyFatPct: "0",
      goalBodyFatPct: goalBodyFatPct.toString(),
      scanMethod: "Other",
      source: "client",
      recordedAt: new Date(),
    }).returning();
    res.json({ entry: created });
  } catch (error) {
    console.error("Error updating body fat goal:", error);
    res.status(400).json({ error: "Failed to update goal" });
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
