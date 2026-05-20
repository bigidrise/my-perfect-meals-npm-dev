import { Router } from "express";
import { db } from "../db";
import { shoppingListItems, shoppingListSources } from "@shared/schema";
import { normalizeShopping } from "../services/shopping-list/builder-v2";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";

type MealInput = any;

export const shoppingPreviewRouter = Router();

export const shoppingRouter = Router();

shoppingPreviewRouter.post("/preview", async (req: any, res: any) => {
  try {
    const { meals } = req.body as { meals: MealInput[] };
    
    if (!Array.isArray(meals) || meals.length === 0) {
      return res.status(400).json({ error: "meals array is required" });
    }

    const items = normalizeShopping(meals);
    
    res.json(items);
  } catch (error: any) {
    console.error("Error previewing shopping list:", error);
    res.status(500).json({ error: "Failed to preview shopping list" });
  }
});

shoppingRouter.post("/commit", requireAuth, async (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);

    const { meals } = req.body as { meals: MealInput[] };
    
    if (!Array.isArray(meals) || meals.length === 0) {
      return res.status(400).json({ error: "meals array is required" });
    }

    const items = normalizeShopping(meals);
    
    const mealIds = meals.map(m => m.mealId);
    const existingSources = await db.query.shoppingListSources.findMany({
      where: (sources, { eq, inArray, and, exists }) => 
        and(
          inArray(sources.mealId, mealIds),
          exists(
            db.select().from(shoppingListItems).where(
              and(
                eq(shoppingListItems.id, sources.itemId),
                eq(shoppingListItems.userId, userId)
              )
            )
          )
        )
    });
    
    const existingMealIds = new Set(existingSources.map(s => s.mealId));
    const newMeals = meals.filter(m => !existingMealIds.has(m.mealId));
    
    if (newMeals.length === 0) {
      return res.json({ message: "Meals already in shopping list", itemsAdded: 0 });
    }

    const newItems = buildShoppingListFromMeals(newMeals);
    
    let itemsAdded = 0;
    
    for (const item of newItems) {
      const existingItem = await db.query.shoppingListItems.findFirst({
        where: (items, { eq, and }) => and(
          eq(items.userId, userId),
          eq(items.name, item.name),
          eq(items.unit, item.unit || '')
        )
      });
      
      let itemId: string;
      
      if (existingItem) {
        const newQty = (parseFloat(existingItem.quantity) + item.totalQty).toString();
        await db.update(shoppingListItems)
          .set({ quantity: newQty })
          .where(eq(shoppingListItems.id, existingItem.id));
        itemId = existingItem.id;
      } else {
        const [newItem] = await db.insert(shoppingListItems).values({
          userId,
          name: item.name,
          quantity: item.totalQty.toString(),
          unit: item.unit || '',
          category: item.category,
          scopeType: 'week',
          scopeKey: newMeals[0]?.day || 'current',
          sourceBuilder: newMeals[0]?.generator || 'manual',
          checked: false,
        }).returning();
        itemId = newItem.id;
        itemsAdded++;
      }
      
      for (const source of item.sources) {
        await db.insert(shoppingListSources).values({
          userId,
          itemId,
          mealId: source.mealId,
          mealName: source.mealName,
          generator: source.generator,
          day: source.day,
          slot: source.slot,
          qty: source.qty,
          unit: source.unit,
        });
      }
    }
    
    res.json({ message: "Items added to shopping list", itemsAdded });
  } catch (error: any) {
    console.error("Error committing to shopping list:", error);
    res.status(500).json({ error: "Failed to commit to shopping list" });
  }
});

shoppingRouter.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);

    const items = await db.query.shoppingListItems.findMany({
      where: (items, { eq }) => eq(items.userId, userId),
      with: {
        sources: true,
      },
      orderBy: (items, { asc }) => [asc(items.category), asc(items.name)],
    });

    res.json({ items });
  } catch (error: any) {
    console.error("Error fetching shopping list:", error);
    res.status(500).json({ error: "Failed to fetch shopping list" });
  }
});

shoppingRouter.patch("/:id", requireAuth, async (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;
    const updates = req.body;

    const existing = await db.query.shoppingListItems.findFirst({
      where: (items, { eq, and }) => and(
        eq(items.id, id),
        eq(items.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    await db.update(shoppingListItems)
      .set(updates)
      .where(eq(shoppingListItems.id, id));

    const updated = await db.query.shoppingListItems.findFirst({
      where: (items, { eq }) => eq(items.id, id),
      with: { sources: true },
    });

    res.json({ item: updated });
  } catch (error: any) {
    console.error("Error updating shopping list item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

shoppingRouter.delete("/:id", requireAuth, async (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);
    const { id } = req.params;

    const existing = await db.query.shoppingListItems.findFirst({
      where: (items, { eq, and }) => and(
        eq(items.id, id),
        eq(items.userId, userId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    await db.delete(shoppingListItems)
      .where(eq(shoppingListItems.id, id));

    res.json({ message: "Item deleted" });
  } catch (error: any) {
    console.error("Error deleting shopping list item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

shoppingRouter.delete("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = getAuthUserId(req);

    await db.delete(shoppingListItems)
      .where(eq(shoppingListItems.userId, userId));

    res.json({ message: "Shopping list cleared" });
  } catch (error: any) {
    console.error("Error clearing shopping list:", error);
    res.status(500).json({ error: "Failed to clear shopping list" });
  }
});

shoppingRouter.post("/parse-voice", requireAuth, async (req: any, res: any) => {
  try {
    const { transcript } = req.body;
    if (!transcript?.trim()) {
      return res.status(400).json({ error: "transcript required" });
    }

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a shopping list parser. Extract every distinct shopping item from the user's spoken text.

Return a JSON object with an "items" array. Each item has:
- "name": the product name, capitalized naturally. Include brand names if mentioned (e.g. "Great Value Honey Roasted Peanuts", "Sprite Zero Sugar", "Kleenex").
- "quantity": a positive number (default 1 if not stated)
- "unit": the unit string (e.g. "pack", "box", "bottle", "bag", "can", "lb", "oz") — empty string "" if just a count

Rules:
- "a six pack of Sprite" → name: "Sprite Zero Sugar", quantity: 6, unit: "pack" (NOT 1 six-pack)
- "two boxes of Kleenex" → name: "Kleenex", quantity: 2, unit: "box"
- Ignore filler words like "I want", "I need", "can you add", "also get me", "oh and"
- If quantity/unit is ambiguous, default to quantity: 1, unit: ""
- Never return an empty items array — if you cannot parse anything, return your best guess

Only return valid JSON.`,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(response.choices[0].message.content || "{}");
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.items)
      ? raw.items
      : [];

    res.json({ items });
  } catch (error: any) {
    console.error("parse-voice error:", error);
    res.status(500).json({ error: "Failed to parse voice transcript" });
  }
});

export default shoppingRouter;
