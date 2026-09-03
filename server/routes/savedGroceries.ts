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
import { eq, and, inArray, sql } from "drizzle-orm";
import { computeProductKey } from "../utils/productKey";
import { revalidateSavedGroceriesForUser } from "../services/savedGroceryRevalidation";

export { computeProductKey };

const router = express.Router();

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

type ExistingShoppingListRow = {
  id: string;
  name: string;
  productKey: string | null;
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
  executor: any,
  userId: string,
  item: {
    id: string;
    productName: string;
    brand: string | null;
    barcode: string | null;
    productKey: string;
    category: string | null;
  },
  existingRows: ExistingShoppingListRow[],
): Promise<{
  id: string;
  name: string;
  status: "added" | "already_on_list" | "restored";
}> {
  const displayName = savedItemDisplayName(item);
  let existing = existingRows.find(
    (row) => row.productKey === item.productKey,
  );

  // One-time compatibility bridge for rows created before product_key existed.
  // Once matched, persist the identity so every later membership check is key-based.
  if (!existing) {
    existing = existingRows.find(
      (row) =>
        !row.productKey &&
        normalizeListName(row.name) === normalizeListName(displayName),
    );
    if (existing) {
      await executor
        .update(shoppingListItems)
        .set({ productKey: item.productKey })
        .where(and(
          eq(shoppingListItems.id, existing.id),
          eq(shoppingListItems.userId, userId),
        ));
      existing.productKey = item.productKey;
    }
  }

  if (existing && !existing.checked) {
    return { id: item.id, name: displayName, status: "already_on_list" };
  }

  if (existing && existing.checked) {
    await executor
      .update(shoppingListItems)
      .set({ checked: false })
      .where(and(
        eq(shoppingListItems.id, existing.id),
        eq(shoppingListItems.userId, userId),
      ));
    existing.checked = false;
    return { id: item.id, name: displayName, status: "restored" };
  }

  const [created] = await executor
    .insert(shoppingListItems)
    .values({
      userId,
      name: displayName,
      productKey: item.productKey,
      quantity: "1",
      unit: null,
      category: item.category ?? "Other",
      scopeType: "adhoc",
      scopeKey: "inbox",
      sourceBuilder: "saved_groceries",
      checked: false,
    })
    .returning({ id: shoppingListItems.id });

  existingRows.push({
    id: created.id,
    name: displayName,
    productKey: item.productKey,
    checked: false,
  });
  return { id: item.id, name: displayName, status: "added" };
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

    const decisions = await revalidateSavedGroceriesForUser(userId, items);
    const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
    return res.json({
      items: items.map((item) => ({
        ...item,
        compliance: decisionById.get(item.id) ?? {
          status: "blocked",
          reason: "Current profile compatibility could not be verified.",
        },
      })),
    });
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
      .onConflictDoNothing({
        target: [
          userSavedGroceryItems.userId,
          userSavedGroceryItems.productKey,
        ],
      })
      .returning();

    if (created) {
      console.log(`[SavedGroceries] Saved: "${productName}" for user ${userId} (source: ${source})`);
      return res.status(201).json({ item: created, created: true });
    }

    // ON CONFLICT waits for a concurrent winner to commit. Re-read that row so
    // retries and double taps receive the same successful idempotent contract.
    const [existing] = await db
      .select()
      .from(userSavedGroceryItems)
      .where(and(
        eq(userSavedGroceryItems.userId, userId),
        eq(userSavedGroceryItems.productKey, productKey),
      ))
      .limit(1);
    if (!existing) {
      throw new Error("Product-key conflict occurred but the saved row could not be reloaded");
    }
    return res.json({ item: existing, created: false });
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

    const uniqueIds = Array.from(new Set(ids)) as string[];
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

    const decisions = await revalidateSavedGroceriesForUser(userId, items);
    const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
    const approvedItems = items
      .filter((item) => decisionById.get(item.id)?.status === "approved")
      .sort((a, b) => a.productKey.localeCompare(b.productKey));

    // Every approved write is one atomic unit. Advisory locks serialize
    // concurrent attempts for the same user/product identity.
    const writtenResults = await db.transaction(async (tx) => {
      for (const item of approvedItems) {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtext(${userId}),
            hashtext(${item.productKey})
          )
        `);
      }

      const existingRows = await tx
        .select({
          id: shoppingListItems.id,
          name: shoppingListItems.name,
          productKey: shoppingListItems.productKey,
          checked: shoppingListItems.checked,
        })
        .from(shoppingListItems)
        .where(eq(shoppingListItems.userId, userId));

      const results = [];
      for (const item of approvedItems) {
        results.push(await addSavedItemToShoppingList(tx, userId, item, existingRows));
      }
      return results;
    });

    const writtenById = new Map(writtenResults.map((result) => [result.id, result]));
    const results = uniqueIds.map((id) => {
      const item = items.find((candidate) => candidate.id === id)!;
      const decision = decisionById.get(id);
      if (decision?.status === "blocked") {
        return {
          id,
          name: savedItemDisplayName(item),
          status: "blocked" as const,
          reason: decision.reason,
        };
      }
      return writtenById.get(id)!;
    });

    const addedCount = results.filter((result) => result.status === "added").length;
    const restoredCount = results.filter((result) => result.status === "restored").length;
    const alreadyOnListCount = results.filter((result) => result.status === "already_on_list").length;
    const blockedCount = results.filter((result) => result.status === "blocked").length;

    console.log(
      `[SavedGroceries] Bulk list add for ${userId}: ${addedCount} added, ${restoredCount} restored, ${alreadyOnListCount} already present, ${blockedCount} blocked`,
    );
    return res.json({
      success: true,
      items: results,
      addedCount,
      restoredCount,
      alreadyOnListCount,
      blockedCount,
    });
  } catch (err: any) {
    console.error("[SavedGroceries] bulk add-to-list error:", err?.message);
    return res.status(500).json({
      error: "Could not add saved groceries to shopping list. No approved items were added.",
      atomic: true,
    });
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

    const [decision] = await revalidateSavedGroceriesForUser(userId, [item]);
    if (!decision || decision.status === "blocked") {
      return res.json({
        success: false,
        name: savedItemDisplayName(item),
        status: "blocked",
        reason: decision?.reason ?? "Current profile compatibility could not be verified.",
      });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${userId}),
          hashtext(${item.productKey})
        )
      `);
      const existingRows = await tx
        .select({
          id: shoppingListItems.id,
          name: shoppingListItems.name,
          productKey: shoppingListItems.productKey,
          checked: shoppingListItems.checked,
        })
        .from(shoppingListItems)
        .where(eq(shoppingListItems.userId, userId));
      return addSavedItemToShoppingList(tx, userId, item, existingRows);
    });

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
