import { useState } from "react";
import type { ShoppingListItem } from "@/stores/shoppingListStore";
import { catalogProductLabel, packagedProductEligibility } from "@/lib/groceryCoachPackagedIngredients";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { shoppingProductActionsDevelopmentEnabled } from "@/lib/shoppingProductActionsGate";

interface Props {
  item: ShoppingListItem;
  enabled: boolean;
  hasAccess: boolean;
  onChoose: () => void;
  onUpgrade: () => void;
  onClear: () => Promise<void>;
}

/** A secondary, historical retail choice; the recipe ingredient remains primary. */
export default function SmartShoppingProductChoice({ item, enabled, hasAccess, onChoose, onUpgrade, onClear }: Props) {
  const { t } = useConsumerCopy();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const coachChoice = item.ingredientMetadata?.selectedProduct?.source.source === "Product Scan by-name guidance";
  if (!enabled && !coachChoice) return null;
  const originalName = item.ingredientMetadata?.ingredient.originalName || item.name;
  if (!packagedProductEligibility(originalName, enabled ? { surface: "smart_shopping" } : {}).eligible) return null;
  const product = item.ingredientMetadata?.selectedProduct;
  const label = product
    ? catalogProductLabel({ brand: product.brand || "", name: product.name })
    : "";
  const isShoppingReference = product?.selectionKind === "unverified_shopping_reference";

  async function clearChoice() {
    if (clearing) return;
    setClearing(true);
    setError("");
    try { await onClear(); }
    catch { setError("Could not confirm the complete clear. Some source rows may already be cleared; refresh before retrying."); }
    finally { setClearing(false); }
  }
  function beginChoose() {
    if (hasAccess) onChoose();
    else onUpgrade();
  }

  if (shoppingProductActionsDevelopmentEnabled && product) return <div className="shopping-product-choice mt-1">
    <div className="flex items-center gap-2 text-xs">
      {enabled && <button type="button" onClick={beginChoose} className="shopping-product-choice-action rounded-md border border-white/15 px-2 py-1 text-white/80">Change</button>}
      {enabled && <button type="button" disabled={clearing} onClick={() => void clearChoice()} className="shopping-product-choice-action rounded-md border border-white/15 px-2 py-1 text-white/80">{clearing ? "Clearing…" : "Clear"}</button>}
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-red-200">{error}</p>}
  </div>;

  return (
    <div className="shopping-product-choice mt-1">
      {product ? (
        <div className="shopping-product-choice-details flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-orange-100/80">
          {isShoppingReference
            ? <span className="shopping-product-choice-label font-semibold text-amber-100">{t("Shopping reference — Unverified")}</span>
            : <span className="shopping-product-choice-label font-medium">{label}</span>}
          {isShoppingReference && <span className="text-orange-50/85">{label}
            {product.variant ? ` · ${product.variant}` : ""}
            {product.packageDescription
              ? ` · ${product.packageDescription}`
              : product.retailQuantity !== undefined
                ? ` · ${product.retailQuantity}${product.servingDescription ? ` ${product.servingDescription}` : ""}`
                : ""}
          </span>}
          {!isShoppingReference && product.assessment.status === "review_required" && <span className="text-amber-100/75">{t("Saved with review required")}</span>}
          {isShoppingReference && <>
            <span className="basis-full text-amber-100/75">Not medical or restricted-diet clearance.</span>
            {product.assessment.unresolvedRequirements.map((warning, index) =>
              <span key={`${index}-${warning}`} className="basis-full text-amber-100/75">Unresolved: {warning}</span>)}
          </>}
          <span className="text-white/40">Historical shopping choice; not a current safety assessment</span>
          {enabled && <button type="button" onClick={beginChoose} className="shopping-product-choice-action rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10">Change</button>}
          {enabled && <button type="button" disabled={clearing} onClick={() => void clearChoice()} className="shopping-product-choice-action rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-50">{clearing ? "Clearing…" : "Clear"}</button>}
        </div>
      ) : (
        <button type="button" onClick={beginChoose} className="shopping-product-options-button rounded-md border border-orange-200/25 bg-orange-200/[0.06] px-2 py-1 text-[11px] font-medium text-orange-100/90 hover:bg-orange-200/10">
          See Product Options
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-200">{error}</p>}
    </div>
  );
}
