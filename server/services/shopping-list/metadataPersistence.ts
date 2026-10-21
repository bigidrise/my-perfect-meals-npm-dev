import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { shoppingListItems, shoppingListSources } from "@shared/schema";
import { prepareShoppingRecipeIngredient } from "@shared/shoppingRecipeIngredient";
import {
  makeIngredientMetadata, parseIngredientMetadata, type ShoppingIngredientMetadata,
  preserveRecipeContributions,
} from "@shared/shoppingIngredientMetadata";
import { developmentShoppingGroups, mergeDevelopmentShoppingMetadata } from "@shared/developmentShoppingMerge";

export const shoppingMetadataDevelopment = () => process.env.NODE_ENV === "development";

/** Called only for explicit new transfers; never a hydration/backfill operation. */
export function developmentIngredientFields(item: any) {
  if (!shoppingMetadataDevelopment()) return {};
  const ingredientMetadata = makeIngredientMetadata({
    name: item.name || item.item,
    quantity: item.quantity ?? item.qty,
    unit: item.unit || "",
    originalText: item.originalText,
    recipeId: item.recipeId,
    recipeName: item.recipeName || item.sourceMeals?.[0],
    source: item.source || item.sourceBuilder || item.notes,
    ingredientMetadata: item.ingredientMetadata,
  });
  return {
    name: ingredientMetadata.ingredient.originalName,
    ingredientMetadata,
    productKey: ingredientMetadata.selectedProduct?.productKey || item.productKey || null,
  };
}

export function developmentSavedProductFields(item: {
  id: string; productKey: string; productName: string; brand: string | null;
  barcode: string | null; productMeta?: unknown; nutritionJson?: unknown;
}) {
  if (!shoppingMetadataDevelopment()) return {};
  const metadata = makeIngredientMetadata({
    name: item.brand ? `${item.brand} ${item.productName}`.trim() : item.productName,
    quantity: 1, unit: "", source: "saved_groceries",
  });
  return {
    ingredientMetadata: parseIngredientMetadata({
      ...metadata,
      selectedProduct: {
        productKey: item.productKey, name: item.productName,
        ...(item.brand ? { brand: item.brand } : {}),
        ...(/^\d{8,14}$/.test(item.barcode || "") ? { upc: item.barcode } : {}),
        source: { source: "saved_groceries", sourceRecordId: item.id },
        sourcePayloadJson: JSON.stringify({ productMeta: item.productMeta ?? null, nutrition: item.nutritionJson ?? null }),
        evidence: [],
        assessment: {
          status: "review_required", unresolvedRequirements: ["current_profile_and_label_review"],
          reasons: ["Saved product evidence is historical; saving does not establish current medical suitability."],
        },
      },
    }),
  };
}

export function metadataInputFailure(error: unknown, res: any): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({ ok: false, error: "Invalid shopping ingredient metadata", message: "Invalid shopping ingredient metadata" });
    return true;
  }
  return false;
}

export const shoppingItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(2000).optional(),
  quantity: z.union([z.number().finite().nonnegative(), z.string().regex(/^\d+(?:\.\d+)?$/)]).optional(),
  unit: z.string().max(200).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  checked: z.boolean().optional(),
  ingredientMetadata: z.unknown().optional(),
}).strict();

export function developmentItemPatch(body: unknown, existing: any) {
  const patch = shoppingItemPatchSchema.parse(body);
  const updates: Record<string, unknown> = { ...patch };
  if (patch.quantity !== undefined) updates.quantity = String(patch.quantity);
  if (Object.prototype.hasOwnProperty.call(patch, "ingredientMetadata")) {
    // Removing a product uses selectedProduct:null, not erasure of provenance.
    let metadata = parseIngredientMetadata(patch.ingredientMetadata);
    if (!metadata) throw new z.ZodError([{ code: "custom", path: ["ingredientMetadata"], message: "Ingredient metadata cannot be erased" }]);
    const previous = parseIngredientMetadata(existing.ingredientMetadata);
    if (previous) {
      if (patch.name === undefined && metadata.ingredient.originalName !== previous.ingredient.originalName) {
        throw new z.ZodError([{ code: "custom", path: ["ingredientMetadata"], message: "Retail selection cannot rename the original ingredient" }]);
      }
      metadata = preserveRecipeContributions(previous, metadata);
    }
    updates.ingredientMetadata = metadata;
    updates.productKey = metadata.selectedProduct?.productKey || null;
    updates.name = metadata.ingredient.originalName;
  } else if (patch.name !== undefined && existing.ingredientMetadata) {
    // Editing the ingredient invalidates the old retail association, but keeps
    // original recipe contributions as historical evidence.
    const prior = parseIngredientMetadata(existing.ingredientMetadata)!;
    const next = makeIngredientMetadata({ name: patch.name, quantity: existing.quantity, unit: existing.unit || "" });
    updates.ingredientMetadata = { ...next, contributions: prior.contributions, selectedProduct: null };
    updates.productKey = null;
  }
  return updates;
}

/** Shared by BOTH POST registrations. No application boot or migration imports. */
export async function developmentShoppingPost(req: any, res: any, database: any, userId: string) {
  if (!userId) return res.status(401).json({ ok: false, message: "Not authenticated" });
  try {
    const body = req.body || {};
    if (!Array.isArray(body.items) || !body.items.length) {
      return res.status(400).json({ ok: false, message: "No items provided" });
    }
    const scope = body.scope || { type: body.scopeType || "adhoc", key: body.scopeKey || "inbox" };
    z.object({ type: z.enum(["day", "week", "adhoc"]), key: z.string().min(1).max(200) }).strict().parse(scope);
    const multiplier = z.number().finite().positive().parse(body.multiplier ?? 1);
    // Validate every item BEFORE any replace_scope deletion.
    const rows = body.items.map((item: any) => ({
      userId,
      name: item.name || item.item || "",
      quantity: String(z.coerce.number().finite().nonnegative().parse(item.quantity ?? item.qty ?? 1) * multiplier),
      unit: item.unit || "",
      category: item.category || "",
      scopeType: scope.type,
      scopeKey: scope.key,
      sourceBuilder: body.sourceBuilder || item.source || item.sourceBuilder || null,
      checked: false,
      ...developmentIngredientFields(item),
    }));
    const inserted = await database.transaction(async (tx: any) => {
      if (body.strategy === "replace_scope") {
        await tx.delete(shoppingListItems).where(and(
          eq(shoppingListItems.userId, userId),
          eq(shoppingListItems.scopeType, scope.type),
          eq(shoppingListItems.scopeKey, scope.key),
        ));
      }
      return tx.insert(shoppingListItems).values(rows).returning();
    });
    return res.status(201).json({
      ok: true, success: true, added: rows.length, itemsAdded: rows.length,
      items: inserted, scope, strategy: body.strategy || "append",
    });
  } catch (error) {
    if (metadataInputFailure(error, res)) return;
    throw error;
  }
}

export function aggregateDevelopmentShoppingItems(items: any[]) {
  return developmentShoppingGroups(items, (a, b) =>
    (a.unit || "") === (b.unit || "") && (a.category || "") === (b.category || "")
  ).map(group => {
    const ingredientMetadata = group.reduce<ShoppingIngredientMetadata | undefined>((m, item) =>
      mergeDevelopmentShoppingMetadata(m, item.ingredientMetadata), undefined);
    return {
      ...group[0], quantity: String(group.reduce((sum, item) => sum + Number(item.quantity), 0)),
      ids: group.map(item => item.id), ingredientMetadata,
      productKey: ingredientMetadata?.selectedProduct?.productKey || group[0].productKey,
    };
  });
}

export function developmentMealIngredients(meals: any[]) {
  return meals.flatMap(meal => (meal.ingredients || []).map((ing: any) => {
    const prepared = prepareShoppingRecipeIngredient(ing, {
      id: meal.mealId || meal.id, name: meal.name || meal.mealName,
      source: meal.generator || "meal-plan",
    });
    return {
      name: prepared.name,
      quantity: prepared.qty,
      unit: prepared.unit,
      category: typeof ing === "object" ? ing.category || "Other" : "Other",
      recipeId: meal.mealId || meal.id,
      recipeName: meal.name || meal.mealName,
      source: meal.generator || "meal-plan",
      ingredientMetadata: prepared.ingredientMetadata,
    };
  }));
}

export function developmentPlanMeals(plan: unknown, depth = 0): any[] {
  if (depth > 8 || !plan || typeof plan !== "object") return [];
  if (Array.isArray(plan)) return plan.flatMap(p => developmentPlanMeals(p, depth + 1));
  if (Array.isArray((plan as any).ingredients)) return [plan];
  return Object.values(plan).flatMap(p => developmentPlanMeals(p, depth + 1));
}

/** Development replacement for the legacy commit path's removed builder. */
export async function developmentMealCommit(req: any, res: any, database: any, userId: string) {
  try {
    const meals = req.body?.meals;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (!Array.isArray(meals) || !meals.length) return res.status(400).json({ error: "meals array is required" });
    // Validate all metadata before opening a write transaction.
    const prepared = developmentMealIngredients(meals).map(item => ({
      ...item, ...developmentIngredientFields(item),
      quantity: z.coerce.number().finite().nonnegative().parse(item.quantity),
    }));
    const count = await database.transaction(async (tx: any) => {
      const sources = await tx.query.shoppingListSources.findMany({
        where: (s: any, op: any) => op.eq(s.userId, userId),
      });
      const seen = new Set(sources.map((s: any) => s.mealId));
      const existing = await tx.query.shoppingListItems.findMany({
        where: (s: any, op: any) => op.eq(s.userId, userId),
      });
      let added = 0;
      for (const item of prepared) {
        if (item.recipeId && seen.has(item.recipeId)) continue;
        const scopeKey = meals.find(m => (m.mealId || m.id) === item.recipeId)?.day || "current";
        const group = developmentShoppingGroups([...existing, item], (a: any, b: any) => {
          const inScope = (row: any) => row === item ||
            (row.scopeType === "week" && row.scopeKey === scopeKey);
          return inScope(a) && inScope(b) && (a.unit || "") === (b.unit || "");
        }).find(g => g.includes(item))!;
        const match = group.find(row => row !== item && row.ingredientMetadata?.selectedProduct) ||
          group.find(row => row !== item);
        let id: string;
        if (match) {
          const ingredientMetadata = mergeDevelopmentShoppingMetadata(match.ingredientMetadata, item.ingredientMetadata);
          const changes = {
            quantity: String(Number(match.quantity) + item.quantity),
            ingredientMetadata,
            productKey: ingredientMetadata?.selectedProduct?.productKey || match.productKey || null,
          };
          await tx.update(shoppingListItems).set(changes).where(and(
            eq(shoppingListItems.id, match.id), eq(shoppingListItems.userId, userId),
          ));
          Object.assign(match, changes);
          id = match.id;
        } else {
          const [created] = await tx.insert(shoppingListItems).values({
            userId, name: item.name, quantity: String(item.quantity), unit: item.unit,
            category: item.category, scopeType: "week", scopeKey,
            sourceBuilder: item.source, checked: false,
            ingredientMetadata: item.ingredientMetadata,
            productKey: item.productKey,
          }).returning();
          id = created.id;
          existing.push(created);
          added++;
        }
        if (item.recipeId) await tx.insert(shoppingListSources).values({
          userId, itemId: id, mealId: item.recipeId, mealName: item.recipeName || "Meal",
          generator: item.source, day: scopeKey, qty: String(item.quantity), unit: item.unit,
        });
      }
      return added;
    });
    return res.json({ message: "Items added to shopping list", itemsAdded: count });
  } catch (error) {
    if (metadataInputFailure(error, res)) return;
    throw error;
  }
}
