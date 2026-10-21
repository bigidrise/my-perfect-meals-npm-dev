import { useState } from "react";
import type { ShoppingListItem } from "@/stores/shoppingListStore";
import { catalogProductLabel, packagedProductEligibility } from "@/lib/groceryCoachPackagedIngredients";

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
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  if (!enabled) return null;
  const originalName = item.ingredientMetadata?.ingredient.originalName || item.name;
  if (!packagedProductEligibility(originalName).eligible) return null;
  const product = item.ingredientMetadata?.selectedProduct;
  const label = product
    ? catalogProductLabel({ brand: product.brand || "", name: product.name })
    : "";

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

  return (
    <div className="mt-1">
      {product ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-orange-100/80">
          <span className="font-medium">{label}</span>
          {product.assessment.status === "review_required" && <span className="text-amber-100/75">Saved with review required</span>}
          <span className="text-white/40">Historical shopping choice; not a current safety assessment</span>
          <button type="button" onClick={beginChoose} className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10">Change</button>
          <button type="button" disabled={clearing} onClick={() => void clearChoice()} className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-50">{clearing ? "Clearing…" : "Clear"}</button>
        </div>
      ) : (
        <button type="button" onClick={beginChoose} className="rounded-md border border-orange-200/25 bg-orange-200/[0.06] px-2 py-1 text-[11px] font-medium text-orange-100/90 hover:bg-orange-200/10">
          Choose Product
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-200">{error}</p>}
    </div>
  );
}
