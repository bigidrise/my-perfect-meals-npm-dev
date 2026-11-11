import { createHash } from "node:crypto";
import {
  prepareShoppingSelection, shoppingTransferSchema, shoppingRound, shoppingUnit, stableShoppingJson,
  type PreparedShoppingIngredient, type TransferResult,
} from "../../../shared/mealShoppingSelection";
import { developmentShoppingGroups, mergeDevelopmentShoppingMetadata } from "../../../shared/developmentShoppingMerge";
import { parseIngredientMetadata, shoppingIdentityKey } from "../../../shared/shoppingIngredientMetadata";

export interface ShoppingSqlClient {
  query(sql: string, values?: any[]): Promise<{ rows: any[] }>;
  release?(): void;
}
export interface ShoppingSqlPool { connect(): Promise<ShoppingSqlClient> }
export class ShoppingTransferConflict extends Error {}

export async function shoppingTransferSchemaReady(pool: ShoppingSqlPool) {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT
      to_regclass('public.shopping_transfer_cycles') IS NOT NULL AND
      to_regclass('public.shopping_transfer_receipts') IS NOT NULL AND
      to_regclass('public.shopping_transfer_contributions') IS NOT NULL AS ready`);
    return result.rows[0]?.ready === true;
  } finally { client.release?.(); }
}
async function activeCycle(client: ShoppingSqlClient, owner: string) {
  await client.query(`INSERT INTO shopping_transfer_cycles(owner_id)
    VALUES($1) ON CONFLICT(owner_id,destination) WHERE active DO NOTHING`, [owner]);
  const { rows } = await client.query(`SELECT id FROM shopping_transfer_cycles
    WHERE owner_id=$1 AND destination='adhoc:inbox' AND active FOR UPDATE`, [owner]);
  if (!rows[0]) throw new ShoppingTransferConflict("Shopping cycle changed; retry.");
  return rows[0].id as string;
}
function fingerprint(selection: any, ingredients: PreparedShoppingIngredient[]) {
  return createHash("sha256").update(stableShoppingJson({
    quantityBasis: selection.quantityBasis, recipeYield: selection.recipeYield,
    shoppingServings: selection.shoppingServings, subjectKind: selection.subjectKind,
    ingredients: ingredients.map(i => ({
      name: i.name, quantity: i.quantity, unit: i.unit,
      ingredient: i.ingredientMetadata.ingredient,
      selectedProduct: i.ingredientMetadata.selectedProduct,
    })),
  })).digest("hex");
}
function identity(row: any) {
  return {
    name: row.name, productKey: row.product_key || null,
    ingredientMetadata: parseIngredientMetadata(row.ingredient_metadata),
    unit: shoppingUnit(1, row.unit).unit,
  };
}
async function removeContribution(client: ShoppingSqlClient, owner: string, receipt: any) {
  const { rows } = await client.query(`SELECT c.*, i.quantity, i.unit, i.checked, i.ingredient_metadata
    FROM shopping_transfer_contributions c LEFT JOIN shopping_list_items i ON i.id=c.item_id AND i.user_id=c.owner_id
    WHERE c.receipt_id=$1 AND c.owner_id=$2 ORDER BY c.id`, [receipt.id, owner]);
  if (!rows.length) throw new ShoppingTransferConflict("The previous shopping contribution is missing; review the list.");
  // Validate the complete prior contribution before changing any rows.
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.item_id || row.quantity == null || row.checked || (row.unit || "") !== row.applied_unit) {
      throw new ShoppingTransferConflict("A previous item was checked, deleted or edited; review it before updating.");
    }
    totals.set(row.item_id, (totals.get(row.item_id) || 0) + Number(row.applied_quantity));
  }
  for (const [id, amount] of totals) {
    const row = rows.find(r => r.item_id === id)!;
    const remaining = shoppingRound(Number(row.quantity) - amount);
    if (!Number.isFinite(remaining) || remaining < 0) {
      throw new ShoppingTransferConflict("Manual quantity edits conflict with this update; no groceries were changed.");
    }
    if (remaining === 0) await client.query("DELETE FROM shopping_list_items WHERE id=$1 AND user_id=$2", [id, owner]);
    else {
      const removed = new Set(rows.filter(r => r.item_id === id).flatMap(r => r.metadata_ids));
      const metadata = row.ingredient_metadata ? {
        ...row.ingredient_metadata, contributions: row.ingredient_metadata.contributions.filter((c: any) => !removed.has(c.id)),
      } : null;
      await client.query(`UPDATE shopping_list_items SET quantity=$1, ingredient_metadata=$2
        WHERE id=$3 AND user_id=$4`, [String(remaining), metadata, id, owner]);
    }
  }
  await client.query("DELETE FROM shopping_list_sources WHERE user_id=$1 AND meal_id=$2", [owner, receipt.selection_id]);
  await client.query("DELETE FROM shopping_transfer_contributions WHERE receipt_id=$1 AND owner_id=$2", [receipt.id, owner]);
}
async function appendIngredient(
  client: ShoppingSqlClient, owner: string, receipt: any, selection: any,
  ingredient: PreparedShoppingIngredient, index: number,
) {
  const metadata = { ...ingredient.ingredientMetadata,
    contributions: ingredient.ingredientMetadata.contributions.map((c, n) => ({
      ...c, id: `shopping:${receipt.id}:${receipt.version}:${index}:${n}`,
    })),
  };
  const incoming = { ...ingredient, ingredientMetadata: metadata, unit: shoppingUnit(1, ingredient.unit).unit };
  const { rows } = await client.query(`SELECT * FROM shopping_list_items WHERE user_id=$1
    AND scope_type='adhoc' AND scope_key='inbox' AND NOT checked ORDER BY id FOR UPDATE`, [owner]);
  const candidates: Array<ReturnType<typeof identity> & { existing?: any }> = rows.map(row => ({ ...identity(row), existing: row }));
  const groups = developmentShoppingGroups([...candidates, incoming],
    (a, b) => a.unit === b.unit);
  const matching = groups.find(g => g.includes(incoming));
  const existing = matching?.filter((x: any) => x.existing) as typeof candidates | undefined;
  // Never consolidate or delete multiple pre-existing manual rows to guess a target.
  const exact = existing?.filter(candidate => shoppingIdentityKey(candidate) === shoppingIdentityKey(incoming));
  const target = exact?.length === 1 ? exact[0].existing
    : !exact?.length && existing?.length === 1 ? existing[0].existing : undefined;
  let item: any, applied = ingredient.quantity, unit = ingredient.unit;
  if (target) {
    const parsed = Number(target.quantity);
    if (!Number.isFinite(parsed) || parsed < 0) throw new ShoppingTransferConflict("Review the existing grocery quantity.");
    applied = shoppingRound(shoppingUnit(ingredient.quantity, ingredient.unit).quantity / shoppingUnit(1, target.unit).factor);
    unit = target.unit || "";
    const merged = mergeDevelopmentShoppingMetadata(target.ingredient_metadata, metadata);
    const result = await client.query(`UPDATE shopping_list_items SET quantity=$1, ingredient_metadata=$2
      WHERE id=$3 AND user_id=$4 RETURNING *`, [String(shoppingRound(parsed + applied)), merged, target.id, owner]);
    item = result.rows[0];
  } else {
    const result = await client.query(`INSERT INTO shopping_list_items
      (user_id,name,quantity,unit,scope_type,scope_key,source_builder,checked,product_key,ingredient_metadata)
      VALUES($1,$2,$3,$4,'adhoc','inbox',$5,false,$6,$7) RETURNING *`,
    [owner, ingredient.name, String(applied), unit, selection.source, ingredient.productKey, metadata]);
    item = result.rows[0];
  }
  await client.query(`INSERT INTO shopping_transfer_contributions
    (owner_id,receipt_id,item_id,applied_quantity,applied_unit,metadata_ids) VALUES($1,$2,$3,$4,$5,$6)`,
  [owner, receipt.id, item.id, applied, unit, JSON.stringify(metadata.contributions.map(c => c.id))]);
  await client.query(`INSERT INTO shopping_list_sources(user_id,item_id,meal_id,meal_name,generator,qty,unit)
    VALUES($1,$2,$3,$4,$5,$6,$7)`, [owner, item.id, selection.selectionId, selection.recipeName, selection.source, String(applied), unit]);
}
export async function transferShoppingSelections(pool: ShoppingSqlPool, owner: string, input: unknown): Promise<TransferResult> {
  const request = shoppingTransferSchema.parse(input);
  const prepared = request.selections.map(selection => {
    const ingredients = prepareShoppingSelection(selection);
    return { selection, ingredients, hash: fingerprint(selection, ingredients) };
  });
  const unique = new Map<string, typeof prepared[number]>();
  for (const entry of prepared) {
    const previous = unique.get(entry.selection.selectionId);
    if (previous && previous.hash !== entry.hash) throw new ShoppingTransferConflict("One selection has conflicting recipes in this batch.");
    unique.set(entry.selection.selectionId, entry);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cycle = await activeCycle(client, owner);
    const plans = [];
    for (const entry of unique.values()) {
      const result = await client.query(`SELECT * FROM shopping_transfer_receipts
        WHERE owner_id=$1 AND cycle_id=$2 AND selection_id=$3 FOR UPDATE`, [owner, cycle, entry.selection.selectionId]);
      const previous = result.rows[0];
      if (previous) {
        const missing = await client.query(`SELECT count(*)::int AS n FROM shopping_transfer_contributions
          WHERE owner_id=$1 AND receipt_id=$2 AND item_id IS NULL`, [owner, previous.id]);
        if (missing.rows[0].n > 0) throw new ShoppingTransferConflict("Previously transferred groceries were deleted; review before re-adding.");
      }
      plans.push({ ...entry, previous });
    }
    if (plans.some(p => p.previous && p.previous.snapshot_hash !== p.hash &&
        (request.operation !== "replace" || p.selection.expectedVersion !== p.previous.version))) {
      await client.query("ROLLBACK");
      return { committed: false, results: plans.map(p => ({
        selectionId: p.selection.selectionId, version: p.previous?.version || 0,
        status: !p.previous ? "not_added" : p.previous.snapshot_hash === p.hash ? "already_added" : "update_required",
      })) };
    }
    const results: TransferResult["results"] = [];
    for (const plan of plans) {
      const { selection, previous, hash, ingredients } = plan;
      if (previous?.snapshot_hash === hash) {
        results.push({ selectionId: selection.selectionId, version: previous.version, status: "already_added" });
        continue;
      }
      if (previous) await removeContribution(client, owner, previous);
      const receiptResult = previous
        ? await client.query(`UPDATE shopping_transfer_receipts SET snapshot_hash=$1,snapshot=$2,version=version+1,updated_at=now()
          WHERE id=$3 AND owner_id=$4 RETURNING *`, [hash, selection, previous.id, owner])
        : await client.query(`INSERT INTO shopping_transfer_receipts(owner_id,cycle_id,selection_id,snapshot_hash,snapshot)
          VALUES($1,$2,$3,$4,$5) RETURNING *`, [owner, cycle, selection.selectionId, hash, selection]);
      const receipt = receiptResult.rows[0];
      for (const [index, ingredient] of ingredients.entries()) await appendIngredient(client, owner, receipt, selection, ingredient, index);
      results.push({ selectionId: selection.selectionId, version: receipt.version, status: previous ? "updated" : "added" });
    }
    await client.query("COMMIT");
    return { committed: true, results };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release?.(); }
}
export async function clearShoppingTransferCycle(pool: ShoppingSqlPool, owner: string, destinationOnly = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cycle = await activeCycle(client, owner);
    await client.query(destinationOnly
      ? "DELETE FROM shopping_list_items WHERE user_id=$1 AND scope_type='adhoc' AND scope_key='inbox'"
      : "DELETE FROM shopping_list_items WHERE user_id=$1", [owner]);
    await client.query("UPDATE shopping_transfer_cycles SET active=false WHERE id=$1 AND owner_id=$2", [cycle, owner]);
    await client.query("INSERT INTO shopping_transfer_cycles(owner_id) VALUES($1)", [owner]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release?.(); }
}
