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
 *   POST   /api/saved-groceries/add-to-list — push multiple saved items to shopping list
 *   POST   /api/saved-groceries/:id/add-to-list — push one item to shopping list
 */

import express from "express";
import { db } from "../db";
import { userSavedGroceryItems, shoppingListItems } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { computeProductKey } from "../utils/productKey";

export { computeProductKey };

const router = express.Router();

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

type ExistingShoppingListRow = {
  id: string;
  name: string;
  checked: boolean | null;
};

function normalizeListName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function savedItemDisplayName(item: {
  productName: string;
  brand: string | null;
}): string {
  return item.brand
    ? `${item.brand} ${item.productName}`.trim()
    : item.productName.trim();
}

async function addSavedItemToShoppingList(
  userId: string,
  item: {
    productName: string;
    brand: string | null;
    category: string | null;
  },
  existingRows: ExistingShoppingListRow[],
): Promise<{
  name: string;
  status: "added" | "already_on_list" | "restored";
}> {
  const displayName = savedItemDisplayName(item);
  const normalizedName = normalizeListName(displayName);
  const existing = existingRows.find(
    (row) => normalizeListName(row.name) === normalizedName,
  );

  if (existing && !existing.checked) {
    return { name: displayName, status: "already_on_list" };
  }

  if (existing && existing.checked) {
    await db
      .update(shoppingListItems)
      .set({ checked: false })
      .where(and(
        eq(shoppingListItems.id, existing.id),
        eq(shoppingListItems.userId, userId),
      ));
    existing.checked = false;
    return { name: displayName, status: "restored" };
  }

  const [created] = await db
    .insert(shoppingListItems)
    .values({
      userId,
      name: displayName,
      quantity: "1",
      unit: null,
      category: item.category ?? "Other",
      scopeType: "adhoc",
      scopeKey: "inbox",
      sourceBuilder: "saved_groceries",
      checked: false,
    })
    .returning({ id: shoppingListItems.id });

  existingRows.push({ id: created.id, name: displayName, checked: false });
  return { name: displayName, status: "added" };
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

// ── POST /add-to-list — push multiple saved items without duplicates ──────────
// This route must appear before /:id so "add-to-list" is not treated as an ID.
router.post("/add-to-list", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { ids } = req.body;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 500 ||
      ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return res.status(400).json({ error: "ids must contain between 1 and 500 saved grocery IDs" });
    }

    const uniqueIds = Array.from(new Set(ids));
    const items = await db
      .select()
      .from(userSavedGroceryItems)
      .where(and(
        eq(userSavedGroceryItems.userId, userId),
        inArray(userSavedGroceryItems.id, uniqueIds),
      ));

    if (items.length !== uniqueIds.length) {
      return res.status(404).json({ error: "One or more saved grocery items were not found" });
    }

    const existingRows = await db
      .select({
        id: shoppingListItems.id,
        name: shoppingListItems.name,
        checked: shoppingListItems.checked,
      })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.userId, userId));

    const results = [];
    for (const id of uniqueIds) {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) continue;
      results.push(await addSavedItemToShoppingList(userId, item, existingRows));
    }

    const addedCount = results.filter((result) => result.status === "added").length;
    const restoredCount = results.filter((result) => result.status === "restored").length;
    const alreadyOnListCount = results.filter((result) => result.status === "already_on_list").length;

    console.log(
      `[SavedGroceries] Bulk list add for ${userId}: ${addedCount} added, ${restoredCount} restored, ${alreadyOnListCount} already present`,
    );
    return res.json({
      success: true,
      items: results,
      addedCount,
      restoredCount,
      alreadyOnListCount,
    });
  } catch (err: any) {
    console.error("[SavedGroceries] bulk add-to-list error:", err?.message);
    return res.status(500).json({ error: "Could not add saved groceries to shopping list." });
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

    const existingRows = await db
      .select({
        id: shoppingListItems.id,
        name: shoppingListItems.name,
        checked: shoppingListItems.checked,
      })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.userId, userId));
    const result = await addSavedItemToShoppingList(userId, item, existingRows);

    console.log(`[SavedGroceries] Added to list: "${result.name}" for user ${userId} (${result.status})`);
    return res.json({
      success: true,
      name: result.name,
      status: result.status,
      alreadyOnList: result.status === "already_on_list",
    });
  } catch (err: any) {
    console.error("[SavedGroceries] add-to-list error:", err?.message);
    return res.status(500).json({ error: "Could not add item to shopping list." });
  }
});

export default router;
