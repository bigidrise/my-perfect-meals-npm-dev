import { Router } from "express";
import { db } from "../db";
import { shoppingListItems, insertShoppingListItemSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Helper: get authenticated userId (works with demo user and real auth)
function getUserId(req: any): string {
  // Check session first (real auth)
  if (req.session?.userId) return req.session.userId as string;
  
  // Check header (for demo/dev)
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  
  // Default to demo user for alpha testing
  return "00000000-0000-0000-0000-000000000001";
}

// POST /shopping-list - Add items to shopping list
router.post("/shopping-list", async (req, res) => {
  const userId = getUserId(req);
  
  const { items, scopeType = "adhoc", scopeKey = "inbox" } = req.body || {};
  
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: "No items provided" });
  }
  
  try {
    // Prepare items for insertion
    const toInsert = items.map((item: any) => ({
      userId,
      name: item.name || "",
      quantity: String(item.quantity || 1),
      unit: item.unit || null,
      category: item.category || null,
      scopeType,
      scopeKey,
      sourceBuilder: item.source || item.sourceBuilder || null,
      checked: false,
    }));
    
    // Insert all items
    await db.insert(shoppingListItems).values(toInsert);
    
    return res.json({ 
      ok: true, 
      added: toInsert.length, 
      message: `${toInsert.length} items added to shopping list` 
    });
  } catch (error) {
    console.error("Shopping list POST error:", error);
    return res.status(500).json({ ok: false, message: "Failed to add items" });
  }
});

// GET /shopping-list - Get user's shopping list
router.get("/shopping-list", async (req, res) => {
  const userId = getUserId(req);
  
  const { scopeType = "adhoc", scopeKey = "inbox" } = req.query;
  
  try {
    const items = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.userId, userId),
          eq(shoppingListItems.scopeType, String(scopeType)),
          eq(shoppingListItems.scopeKey, String(scopeKey))
        )
      )
      .orderBy(shoppingListItems.createdAt);
    
    // Aggregate duplicate items by name+unit+category
    const aggregateMap = new Map<string, any>();
    
    for (const item of items) {
      const key = `${item.name?.toLowerCase()}|${item.unit || ''}|${item.category || ''}`;
      
      if (aggregateMap.has(key)) {
        const existing = aggregateMap.get(key);
        existing.quantity = String(Number(existing.quantity) + Number(item.quantity));
        existing.ids.push(item.id);
      } else {
        aggregateMap.set(key, {
          name: item.name,
          unit: item.unit,
          category: item.category,
          quantity: item.quantity,
          ids: [item.id],
          checked: item.checked,
        });
      }
    }
    
    const aggregated = Array.from(aggregateMap.values());
    
    return res.json({ ok: true, items, aggregated });
  } catch (error) {
    console.error("Shopping list GET error:", error);
    return res.status(500).json({ ok: false, message: "Failed to fetch shopping list" });
  }
});

// PATCH /shopping-list/:id - Update item (check/uncheck)
router.patch("/shopping-list/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { checked } = req.body || {};
  
  try {
    const [updated] = await db
      .update(shoppingListItems)
      .set({ checked: Boolean(checked) })
      .where(
        and(
          eq(shoppingListItems.id, id),
          eq(shoppingListItems.userId, userId)
        )
      )
      .returning();
    
    if (!updated) {
      return res.status(404).json({ ok: false, message: "Item not found" });
    }
    
    return res.json({ ok: true, item: updated });
  } catch (error) {
    console.error("Shopping list PATCH error:", error);
    return res.status(500).json({ ok: false, message: "Failed to update item" });
  }
});

// DELETE /shopping-list/:id - Delete item
router.delete("/shopping-list/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  
  try {
    await db
      .delete(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, id),
          eq(shoppingListItems.userId, userId)
        )
      );
    
    return res.json({ ok: true, message: "Item removed" });
  } catch (error) {
    console.error("Shopping list DELETE error:", error);
    return res.status(500).json({ ok: false, message: "Failed to delete item" });
  }
});

// DELETE /shopping-list - Clear all items in scope
router.delete("/shopping-list", async (req, res) => {
  const userId = getUserId(req);
  const { scopeType = "adhoc", scopeKey = "inbox" } = req.query;
  
  try {
    await db
      .delete(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.userId, userId),
          eq(shoppingListItems.scopeType, String(scopeType)),
          eq(shoppingListItems.scopeKey, String(scopeKey))
        )
      );
    
    return res.json({ ok: true, message: "Shopping list cleared" });
  } catch (error) {
    console.error("Shopping list clear error:", error);
    return res.status(500).json({ ok: false, message: "Failed to clear list" });
  }
});

export default router;
