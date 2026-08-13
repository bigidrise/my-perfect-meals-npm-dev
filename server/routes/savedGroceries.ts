/**
 * Saved Groceries Routes
 *
 * Persistent grocery preference library. Distinct from shopping_list_items
 * (which is ephemeral/scoped). A saved grocery item is a product the user
 * liked and wants Grocery Coach to remember across sessions.
 *
 * Endpoints:
 *   GET    /api/saved-groceries           — list all saved items for the user
 *   POST   /api/saved-groceries           — save an item (idempotent on productKey)
 *   DELETE /api/saved-groceries/:id       — unsave an item
 *   POST   /api/saved-groceries/:id/add-to-list — push one item to shopping list
 */

import express from "express";
import { db } from "../db";
import { userSavedGroceryItems, shoppingListItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = express.Router();

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

/**
 * Compute a stable deduplication key for a grocery product.
 * - Barcode/UPC is the strongest identity — two scans of the same product always collide.
 * - Without barcode, fall back to normalized brand + product name.
 */
export function computeProductKey(
  barcode: string | undefined | null,
  brand: string | undefined | null,
  productName: string,
): string {
  if (barcode?.trim()) return `upc::${barcode.trim()}`;
  const b = (brand ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = productName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `name::${b}::${n}`;
}

// ── GET / — list all saved items ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const items = await db
      .select()
      .from(userSavedGroceryItems)
      .where(eq(userSavedGroceryItems.userId, userId))
      .orderBy(userSavedGroceryItems.savedAt);

    return res.json({ items });
  } catch (err: any) {
    console.error("[SavedGroceries] GET error:", err?.message);
    return res.status(500).json({ error: "Could not load saved groceries." });
  }
});

// ── POST / — save an item (idempotent) ───────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      productName, brand, barcode, category,
      source, nutritionJson, productMeta, imageUrl,
    } = req.body;

    if (!productName || typeof productName !== "string" || !productName.trim()) {
      return res.status(400).json({ error: "productName is required" });
    }
    const validSources = ["grocery-coach", "scanner", "manual"];
    if (!source || !validSources.includes(source)) {
      return res.status(400).json({ error: "source must be grocery-coach, scanner, or manual" });
    }

    const productKey = computeProductKey(barcode, brand, productName);

    // Idempotency: return existing row if already saved
    const [existing] = await db
      .select()
      .from(userSavedGroceryItems)
      .where(and(
        eq(userSavedGroceryItems.userId, userId),
        eq(userSavedGroceryItems.productKey, productKey),
      ))
      .limit(1);

    if (existing) {
      return res.json({ item: existing, created: false });
    }

    const [created] = await db
      .insert(userSavedGroceryItems)
      .values({
        userId,
        productName: productName.trim(),
        brand: brand?.trim() || null,
        barcode: barcode?.trim() || null,
        productKey,
        category: category?.trim() || null,
        source,
        nutritionJson: nutritionJson ?? null,
        productMeta: productMeta ?? null,
        imageUrl: imageUrl?.trim() || null,
      })
      .returning();

    console.log(`[SavedGroceries] Saved: "${productName}" for user ${userId} (source: ${source})`);
    return res.status(201).json({ item: created, created: true });
  } catch (err: any) {
    console.error("[SavedGroceries] POST error:", err?.message);
    return res.status(500).json({ error: "Could not save grocery item." });
  }
});

// ── DELETE /:id — unsave an item ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;
    await db
      .delete(userSavedGroceryItems)
      .where(and(
        eq(userSavedGroceryItems.id, id),
        eq(userSavedGroceryItems.userId, userId),
      ));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[SavedGroceries] DELETE error:", err?.message);
    return res.status(500).json({ error: "Could not remove saved item." });
  }
});

// ── POST /:id/add-to-list — push one saved item to the shopping list ─────────
router.post("/:id/add-to-list", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { id } = req.params;
    const [item] = await db
      .select()
      .from(userSavedGroceryItems)
      .where(and(
        eq(userSavedGroceryItems.id, id),
        eq(userSavedGroceryItems.userId, userId),
      ))
      .limit(1);

    if (!item) return res.status(404).json({ error: "Saved item not found" });

    // Build the display name: "Brand ProductName" or just ProductName
    const displayName = item.brand
      ? `${item.brand} ${item.productName}`
      : item.productName;

    await db.insert(shoppingListItems).values({
      userId,
      name: displayName,
      quantity: "1",
      unit: null,
      category: item.category ?? "Other",
      scopeType: "adhoc",
      scopeKey: "inbox",
      sourceBuilder: "saved_groceries",
      checked: false,
    });

    console.log(`[SavedGroceries] Added to list: "${displayName}" for user ${userId}`);
    return res.json({ success: true, name: displayName });
  } catch (err: any) {
    console.error("[SavedGroceries] add-to-list error:", err?.message);
    return res.status(500).json({ error: "Could not add item to shopping list." });
  }
});

export default router;
