import { catalogProductLabel } from "@/lib/groceryCoachPackagedIngredients";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";
import { BetterAlternativesSection } from "@/components/biometrics/IngredientIntelligenceSheet";
import type { ReactNode } from "react";

interface Props {
  products: CatalogProductMatch[];
  selectedLabel?: string;
  onSelect?: (product: CatalogProductMatch) => void;
  shoppingOnly?: boolean;
  compactShopping?: boolean;
  disabled?: boolean;
  renderAdditionalActions?: (product: CatalogProductMatch) => ReactNode;
}

/** Shared catalog cards; compact Smart Grocery distinguishes view-only leads from selections. */
export default function ProductCatalogChoices({ products, selectedLabel, onSelect, shoppingOnly = false, compactShopping = false, disabled = false, renderAdditionalActions }: Props) {
  const visible = compactShopping
    ? products.filter(product => {
      const display = product.shoppingDisplay;
      return display !== "hidden" && (
        display === "label_review" ||
        (product.shoppingSelection?.eligible === true && !!product.shoppingSelection.selection)
      );
    })
    : shoppingOnly
      ? products.filter(product => product.shoppingSelection?.eligible === true && !!product.shoppingSelection.selection)
      : products;
  if (compactShopping) {
    // Catalog fallback uses the very same cards as Product Scan. Catalog facts
    // still govern eligibility, but are not dumped into the recommendation UI.
    // Missing explanations remain missing: do not fabricate benefits or stores.
    return <BetterAlternativesSection
      alternatives={visible.map(product => ({
        category: catalogProductLabel(product),
        whyBetter: product.recommendationExplanation?.whyBetter ?? [],
        targetCriteria: product.recommendationExplanation?.targetCriteria ?? "",
      }))}
      branded
      query=""
      educationalFooter=""
      source="grocery-coach"
      badgeLabel="Shopping options"
      showEvidenceNote={false}
      cardTestId={(_alternative, index) => `catalog-choice-${visible[index].productKey}`}
      renderAction={(_alternative, index) => {
        const product = visible[index];
        const reviewOnly = product.shoppingDisplay === "label_review";
        return <div className="mt-2">
          {reviewOnly && <p className="text-xs text-amber-100/85">Check the current label</p>}
          <p className="mt-1 text-xs leading-relaxed text-white/65">
            {product.shoppingCaution?.trim() || "Package details can change; check the current label before buying."}
          </p>
          {!reviewOnly && onSelect && <button type="button" disabled={disabled}
            className="shopping-picker-choice-button mt-3 rounded-2xl border border-orange-500/30 px-3 py-3 text-xs font-semibold text-orange-200 hover:bg-orange-500/10 disabled:opacity-50"
            onClick={() => onSelect(product)}>
            {selectedLabel === catalogProductLabel(product) ? "Selected for shopping" : "Choose this option"}
          </button>}
          {renderAdditionalActions?.(product)}
        </div>;
      }}
    />;
  }
  return (
    <div className="space-y-3">
      {visible.map(product => {
        const label = catalogProductLabel(product);
        return (
          <article key={product.productKey} data-testid={`catalog-choice-${product.productKey}`} className="rounded-xl border border-white/15 bg-black/20 p-4 text-sm text-white/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{label}</h3>
                <p className="mt-1 text-xs text-emerald-200/80">
                  {shoppingOnly
                    ? "Evidence-supported catalog option"
                    : product.recommendationStatus === "profile_matched_pick" ? "Profile-Matched Pick" : "Check the Label"}
                </p>
              </div>
              {product.shoppingSelection?.eligible && <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-medium text-emerald-100">Evidence supported</span>}
            </div>
            <p className="mt-2 text-xs leading-relaxed">{product.verificationMessage}</p>
            <p className="mt-1 text-xs text-white/55">{product.evidenceStatus === "eligible" ? "Supporting catalog evidence available" : "Further label verification required"}</p>
            {product.profileInsight && <p className="mt-2 text-xs text-orange-100/80">{product.profileInsight}</p>}
            <p className="mt-2 text-[11px] text-white/50">Source: {product.source} · Record: {product.sourceRecordId}</p>
            {product.ingredients && <p className="mt-2 text-xs"><span className="text-white/50">Ingredients: </span>{product.ingredients}</p>}
            {!!product.nutrition?.length && <ul className="mt-2 space-y-1 text-xs">{product.nutrition.map((fact, index) => <li key={`${fact.source}-${index}`}>{fact.statement} <span className="text-white/45">({fact.source})</span></li>)}</ul>}
            {!!product.allergenInformation?.length && <ul className="mt-2 space-y-1 text-xs">{product.allergenInformation.map((fact, index) => <li key={`${fact.source}-${index}`}>{fact.statement} <span className="text-white/45">({fact.source})</span></li>)}</ul>}
            {product.serving && <p className="mt-2 text-xs text-white/55">Catalog serving: {product.serving} (not the recipe quantity)</p>}
            {onSelect && <button type="button" disabled={disabled} className="mt-3 rounded-lg border border-orange-200/30 bg-orange-300/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-300/20 disabled:opacity-50" onClick={() => onSelect(product)}>
              {selectedLabel === label ? "Selected for shopping" : !shoppingOnly && product.recommendationStatus === "review" ? "Choose for shopping — label review needed" : "Choose for shopping"}
            </button>}
          </article>
        );
      })}
    </div>
  );
}
