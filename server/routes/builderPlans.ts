
import { Router } from "express";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { builderPlans } from "../db/schema/builderPlans";

const r = Router();

// GET active plan
r.get("/api/builders/:key/plan", async (req, res) => {
  const userId = "00000000-0000-0000-0000-000000000001"; // TODO: get from auth middleware
  const { key } = req.params;
  
  try {
    const row = await db.query.builderPlans.findFirst({
      where: and(
        eq(builderPlans.userId, userId),
        eq(builderPlans.builderKey, key),
      ),
    });
    
    return res.json({ 
      plan: row?.plan ?? null, 
      days: row?.days ?? 0, 
      updatedAt: row?.updatedAt 
    });
  } catch (error) {
    console.error("Error fetching builder plan:", error);
    return res.status(500).json({ error: "Failed to fetch plan" });
  }
});

// POST replace active plan (deprecated - use PUT)
r.post("/api/builders/:key/plan", async (req, res) => {
  const userId = "00000000-0000-0000-0000-000000000001"; // TODO: get from auth middleware
  const { key } = req.params;
  const { plan, days } = req.body;

  try {
    // Use UPSERT (insert or update on conflict)
    const inserted = await db.insert(builderPlans)
      .values({
        userId, 
        builderKey: key, 
        days, 
        plan,
      })
      .onConflictDoUpdate({
        target: [builderPlans.userId, builderPlans.builderKey],
        set: {
          days,
          plan,
          updatedAt: new Date(),
        },
      })
      .returning({ id: builderPlans.id });

    res.json({ ok: true, id: inserted[0].id });
  } catch (error) {
    console.error("Error saving builder plan:", error);
    return res.status(500).json({ error: "Failed to save plan" });
  }
});

// PUT replace active plan (idempotent UPSERT)
r.put("/api/builders/:key/plan", async (req, res) => {
  const userId = "00000000-0000-0000-0000-000000000001"; // TODO: get from auth middleware
  const { key } = req.params;
  const { plan, days } = req.body;

  try {
    // Use UPSERT (insert or update on conflict)
    const inserted = await db.insert(builderPlans)
      .values({
        userId, 
        builderKey: key, 
        days, 
        plan,
      })
      .onConflictDoUpdate({
        target: [builderPlans.userId, builderPlans.builderKey],
        set: {
          days,
          plan,
          updatedAt: new Date(),
        },
      })
      .returning({ id: builderPlans.id });

    res.json({ ok: true, id: inserted[0].id });
  } catch (error) {
    console.error("Error saving builder plan:", error);
    return res.status(500).json({ error: "Failed to save plan" });
  }
});

// PATCH update (e.g., delete a day)
r.patch("/api/builders/:key/plan", async (req, res) => {
  const userId = "00000000-0000-0000-0000-000000000001"; // TODO: get from auth middleware
  const { key } = req.params;
  const { plan } = req.body;
  
  try {
    const row = await db.query.builderPlans.findFirst({
      where: and(
        eq(builderPlans.userId, userId), 
        eq(builderPlans.builderKey, key),
      ),
    });
    
    if (!row) return res.status(404).json({ error: "No plan found" });
    
    await db.update(builderPlans)
      .set({ plan, updatedAt: new Date() })
      .where(eq(builderPlans.id, row.id));
      
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updating builder plan:", error);
    return res.status(500).json({ error: "Failed to update plan" });
  }
});

// DELETE clear active plan
r.delete("/api/builders/:key/plan", async (req, res) => {
  const userId = "00000000-0000-0000-0000-000000000001"; // TODO: get from auth middleware
  const { key } = req.params;
  
  try {
    await db.delete(builderPlans)
      .where(and(
        eq(builderPlans.userId, userId), 
        eq(builderPlans.builderKey, key),
      ));
      
    res.json({ ok: true });
  } catch (error) {
    console.error("Error clearing builder plan:", error);
    return res.status(500).json({ error: "Failed to clear plan" });
  }
});

export default r;
