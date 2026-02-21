type Item = { name: string; qty?: number; unit?: string; aisle?: string; notes?: string };
type Normalized = Item & { key: string; qty: number; unit: string };

const UNIT_ALIASES: Record<string,string> = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  each: "ea", ea: "ea", unit: "ea", units: "ea",
  cup: "cup", cups: "cup",
};

const OZ_PER_LB = 16;
const G_PER_KG = 1000;

function normUnit(u?: string) {
  const key = (u || "").trim().toLowerCase();
  return UNIT_ALIASES[key] || key || "ea";
}

function toCanonical(item: Item): Normalized {
  const displayName = String(item.name).trim();     // keep for UI
  const keyName = displayName.toLowerCase();        // use only for merging keys

  const unit = normUnit(item.unit);
  let qty = Number(item.qty ?? 1) || 1;

  // convert oz→lb, g→kg to reduce fragmentation
  if (unit === "oz") {
    qty = qty / OZ_PER_LB;
    return { ...item, name: displayName, qty, unit: "lb", key: `${keyName}|lb|${item.aisle || ""}` };
  }
  if (unit === "g") {
    qty = qty / G_PER_KG;
    return { ...item, name: displayName, qty, unit: "kg", key: `${keyName}|kg|${item.aisle || ""}` };
  }

  return { ...item, name: displayName, qty, unit, key: `${keyName}|${unit}|${item.aisle || ""}` };
}

export function mergeIngredients(items: Item[]): Item[] {
  const map = new Map<string, Normalized>();
  for (const it of items) {
    if (!it?.name) continue;
    const c = toCanonical(it);
    const prev = map.get(c.key);
    if (prev) map.set(c.key, { ...prev, qty: +(prev.qty + c.qty).toFixed(2) });
    else map.set(c.key, c);
  }
  return [...map.values()].map(({ key, ...rest }) => rest);
}

/**
 * Extract all ingredients from a planData blob.
 * Expected shape (example):
 * planData = { days:[ { date, meals:[ { name, ingredients:[{name, qty, unit, aisle, notes}] } ] } ] }
 */
export function extractIngredients(planData: any): Item[] {
  const out: Item[] = [];
  const days = planData?.days || [];
  for (const d of days) {
    for (const m of (d.meals || [])) {
      for (const ing of (m.ingredients || [])) {
        if (ing?.name) out.push({
          name: String(ing.name),
          qty: ing.qty != null ? Number(ing.qty) : undefined,
          unit: ing.unit,
          aisle: ing.aisle,
          notes: ing.notes,
        });
      }
    }
  }
  return out;
}