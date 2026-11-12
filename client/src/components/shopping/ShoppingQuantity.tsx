import type { ConsolidatedItem } from "@/lib/shoppingConsolidation";
import { formatQuantity } from "@/lib/formatQuantity";
import { getRetailQuantity } from "@/lib/retailIntelligence";
import { useTranslation } from "react-i18next";

/** Requirements are stored measurements; retail suggestions never replace them. */
export function ShoppingQuantity({ item }: { item: ConsolidatedItem }) {
  const { t } = useTranslation("shoppingTransfer");
  const amounts = item.requiredAmounts ?? [{ quantity: item.quantity, unit: item.unit }];
  const needed = amounts.map(a => formatQuantity(a.quantity, a.unit)).join(" + ");
  const buy = getRetailQuantity(item);
  return <div className="text-white/70 text-xs shrink-0 max-w-[11rem] text-right">
    <div>{t("quantityNeeded", { quantity: needed || t("quantityReview") })}</div>
    {buy && <div title={t("quantityEstimateHint")}>
      {t("quantityBuy", { quantity: buy })} <span className="text-white/50">{t("quantityEstimate")}</span>
    </div>}
    {item.mergedCount > 1 && <div className="text-white/50">{t("quantityCombined", { count: item.mergedCount })}</div>}
  </div>;
}
