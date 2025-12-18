import { parseQuantity } from "./quantityParser";
import { apiRequest } from "./apiRequest";

export type ShoppingScope = {
  type: "day" | "week" | "adhoc";
  key: string;
};

export type ShoppingItemInput = {
  name: string;
  quantity?: number | string;
  unit?: string;
  category?: string;
  source?: string;
  weekStartIso?: string;
};

/**
 * Core function: Send items to shopping list
 */
export async function sendToShoppingList(
  items: ShoppingItemInput[],
  options?: {
    scope?: ShoppingScope;
    multiplier?: number;
    sourceBuilder?: string;
  }
) {
  const { scope, sourceBuilder } = options || {};
  
  const formattedItems = items.map(item => ({
    name: item.name,
    quantity: typeof item.quantity === 'string' ? parseFloat(item.quantity) || 1 : (item.quantity || 1),
    unit: item.unit || null,
    category: item.category || null,
    source: sourceBuilder || item.source || "manual",
  }));

  console.log(`🛒 Sending ${formattedItems.length} items to shopping list`);

  const data = await apiRequest("/api/shopping-list", {
    method: "POST",
    body: JSON.stringify({
      items: formattedItems,
      scopeType: scope?.type || "adhoc",
      scopeKey: scope?.key || "inbox",
    }),
  });

  window.dispatchEvent(new Event("shopping:updated"));
  return data;
}

/**
 * Get shopping list items
 */
export async function getShoppingList(scope?: ShoppingScope) {
  const scopeType = scope?.type || "adhoc";
  const scopeKey = scope?.key || "inbox";
  
  const data = await apiRequest(
    `/api/shopping-list?scopeType=${scopeType}&scopeKey=${scopeKey}`,
    { method: "GET" }
  );

  return data;
}

/**
 * Update item checked status
 */
export async function setItemChecked(id: string, checked: boolean) {
  const data = await apiRequest(`/api/shopping-list/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ checked }),
  });

  window.dispatchEvent(new Event("shopping:updated"));
  return data;
}

/**
 * Delete a shopping list item
 */
export async function deleteShoppingItem(id: string) {
  const data = await apiRequest(`/api/shopping-list/${id}`, {
    method: "DELETE",
  });

  window.dispatchEvent(new Event("shopping:updated"));
  return data;
}

/**
 * Clear all items in a scope
 */
export async function clearShoppingList(scope?: ShoppingScope) {
  const scopeType = scope?.type || "adhoc";
  const scopeKey = scope?.key || "inbox";
  
  const data = await apiRequest(
    `/api/shopping-list?scopeType=${scopeType}&scopeKey=${scopeKey}`,
    { method: "DELETE" }
  );

  window.dispatchEvent(new Event("shopping:updated"));
  return data;
}

// Helper: Extract quantity and unit from ingredient objects
function extractQuantityAndUnit(ing: any): { quantity: number; unit: string } {
  if (typeof ing === "string") {
    return { quantity: 1, unit: "" };
  }

  let quantityStr = ing.quantity || ing.qty || ing.amount || "1";
  let unit = ing.unit || "";

  if (typeof quantityStr === "string" && quantityStr.includes(" ")) {
    const parts = quantityStr.trim().split(/\s+/);
    
    let qtyParts: string[] = [];
    let unitParts: string[] = [];
    let foundUnit = false;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (!foundUnit && /^[\d½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞\/\.]+$/.test(part)) {
        qtyParts.push(part);
      } else {
        foundUnit = true;
        unitParts.push(part);
      }
    }
    
    if (qtyParts.length > 0) {
      const qtyString = qtyParts.join(" ");
      const parsed = parseQuantity(qtyString);
      if (!isNaN(parsed) && parsed > 0) {
        return { 
          quantity: parsed, 
          unit: unitParts.join(" ") || unit 
        };
      }
    }
  }

  const quantity = parseQuantity(quantityStr);
  return { 
    quantity: isNaN(quantity) ? 1 : quantity, 
    unit 
  };
}

/**
 * Helper: Send meals with ingredients to shopping list
 */
export async function sendMealsToShopping(
  meals: any[],
  options: {
    scope: ShoppingScope;
    multiplier?: number;
    sourceBuilder?: string;
    strategy?: "replace_scope" | "merge";
  }
) {
  const { scope, multiplier = 1, sourceBuilder } = options;

  const allIngredients: ShoppingItemInput[] = meals.flatMap((meal) =>
    (meal.ingredients || []).map((ing: any) => {
      const { quantity, unit } = extractQuantityAndUnit(ing);
      return {
        name: typeof ing === "string" ? ing : ing.name || ing.item || ing.ingredient,
        quantity: quantity * multiplier,
        unit,
        category: typeof ing === "string" ? "" : ing.category || "",
      };
    })
  );

  if (allIngredients.length === 0) {
    console.log("⚠️ No ingredients to add to shopping list");
    return { ok: true, added: 0 };
  }

  return sendToShoppingList(allIngredients, { scope, sourceBuilder });
}

/**
 * Helper: Add weekly meal board meals to shopping
 */
export async function addMealsToShopping(weekStartISO: string, meals: any[]) {
  return sendMealsToShopping(meals, {
    scope: { type: "week", key: weekStartISO },
    sourceBuilder: "weekly-meal-board",
  });
}

/**
 * Helper: Merge shopping items (legacy format support)
 */
export async function mergeShoppingItems(
  items: Array<{ item: string; qty: number; unit?: string }>,
  source: string
) {
  const formattedItems = items.map((item) => ({
    name: item.item,
    quantity: item.qty,
    unit: item.unit || "",
  }));

  return sendToShoppingList(formattedItems, {
    scope: { type: "adhoc", key: "inbox" },
    sourceBuilder: source,
  });
}
