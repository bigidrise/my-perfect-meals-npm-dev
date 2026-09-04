import { Router } from "express";
import { db } from "../db";
import { userTimePresets } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

const actorId = (req: any) => (req as AuthenticatedRequest).authUser.id;

// List user's time presets
router.get("/time-presets", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req);
    
    const presets = await db.select().from(userTimePresets)
      .where(eq(userTimePresets.userId, userId))
      .orderBy(sql`${userTimePresets.isDefault} DESC, ${userTimePresets.createdAt} DESC`);
    
    res.json({ presets });
  } catch (error) {
    console.error("Error fetching time presets:", error);
    res.status(500).json({ error: "Failed to fetch time presets" });
  }
});

// Create or update time preset
router.post("/time-presets/save", requireAuth, async (req, res) => {
  try {
    const { id, name, times, notify, isDefault } = req.body;
    const userId = actorId(req);
    
    if (!name || !times || !notify) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await db.update(userTimePresets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(userTimePresets.userId, userId));
    }

    if (id) {
      // Update existing preset
      await db.update(userTimePresets)
        .set({ 
          name, 
          times, 
          notify, 
          isDefault: !!isDefault, 
          updatedAt: new Date() 
        })
        .where(and(
          eq(userTimePresets.userId, userId), 
          eq(userTimePresets.id, id)
        ));
      
      res.json({ ok: true, id });
    } else {
      // Create new preset
      const [newPreset] = await db.insert(userTimePresets)
        .values({ 
          userId, 
          name, 
          times, 
          notify, 
          isDefault: !!isDefault 
        })
        .returning({ id: userTimePresets.id });
      
      res.json({ ok: true, id: newPreset.id });
    }
  } catch (error) {
    console.error("Error saving time preset:", error);
    res.status(500).json({ error: "Failed to save time preset" });
  }
});

// Delete time preset
router.post("/time-presets/delete", requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const userId = actorId(req);
    
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    
    await db.delete(userTimePresets)
      .where(and(
        eq(userTimePresets.userId, userId), 
        eq(userTimePresets.id, id)
      ));
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting time preset:", error);
    res.status(500).json({ error: "Failed to delete time preset" });
  }
});

// Get user's default time preset
router.get("/time-presets/default", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req);
    
    const [defaultPreset] = await db.select().from(userTimePresets)
      .where(and(
        eq(userTimePresets.userId, userId), 
        eq(userTimePresets.isDefault, true)
      ));
    
    res.json({ preset: defaultPreset || null });
  } catch (error) {
    console.error("Error fetching default time preset:", error);
    res.status(500).json({ error: "Failed to fetch default time preset" });
  }
});

export default router;