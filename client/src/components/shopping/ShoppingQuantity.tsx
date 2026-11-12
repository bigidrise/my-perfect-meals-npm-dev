import type { ConsolidatedItem } from "@/lib/shoppingConsolidation";
import { formatQuantity } from "@/lib/formatQuantity";
import { getRetailQuantity } from "@/lib/retailIntelligence";

/** Requirements are stored measurements; retail suggestions never replace them. */
export function ShoppingQuantity({ item }: { item: ConsolidatedItem }) {
  const amounts = item.requiredAmounts ?? [{ quantity: item.quantity, unit: item.unit }];
  const needed = amounts.map(a => formatQuantity(a.quantity, a.unit)).join(" + ");
  const buy = getRetailQuantity(item);
  return <div className="text-white/70 text-xs shrink-0 max-w-[11rem] text-right">
    <div>Needed: {needed || "Review quantity"}</div>
    {buy && <div title="Estimated purchase amount; package and produce sizes vary.">
      Buy: {buy} <span className="text-white/50">(estimate)</span>
    </div>}
    {item.mergedCount > 1 && <div className="text-white/50">{item.mergedCount} list entries combined</div>}
  </div>;
}
