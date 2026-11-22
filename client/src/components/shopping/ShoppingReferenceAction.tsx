import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import type { ShoppingIngredientRequest, ShoppingProductReference } from "@shared/shoppingProductSelection";
import { parseShoppingProductReference, shoppingIngredientSignature } from "@shared/shoppingProductSelection";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";
import { shoppingProductActionsDevelopmentEnabled } from "@/lib/shoppingProductActionsGate";

/** Validate the already-issued exact reference; never create one from a name. */
export function existingCatalogReference(product: CatalogProductMatch, ingredient: ShoppingIngredientRequest): ShoppingProductReference | null {
  if (product.shoppingDisplay !== "label_review" || !product.shoppingReference) return null;
  try {
    const reference = parseShoppingProductReference(product.shoppingReference);
    return reference.product.productKey === product.productKey &&
      reference.product.name === product.name && reference.product.brand === product.brand &&
      reference.product.variant === product.variant &&
      shoppingIngredientSignature(reference.ingredient) === shoppingIngredientSignature(ingredient)
      ? reference : null;
  } catch { return null; }
}

/** Existing confirmed-reference contract, exposed on catalog fallback cards. */
export default function ShoppingReferenceAction({ reference, disabled, onConfirm, recommendation }: {
  reference: ShoppingProductReference;
  disabled: boolean;
  onConfirm: (reference: ShoppingProductReference) => Promise<void>;
  /** Explicitly distinguish a related source listing from the AI suggestion. */
  recommendation?: string;
}) {
  const { t } = useConsumerCopy();
  const [confirming, setConfirming] = useState(false);
  if (shoppingProductActionsDevelopmentEnabled) return <div className="mt-2">
    <p className="mb-2 text-xs text-white/75">{t("Product details not fully verified.")}</p>
    <Button type="button" disabled={disabled} onClick={() => void onConfirm(reference)}
      className="min-h-11 w-full whitespace-normal bg-orange-600 text-white hover:bg-orange-500">{t("Choose Product")}</Button>
  </div>;
  if (!confirming) return <Button type="button" disabled={disabled} onClick={() => setConfirming(true)}
    className="mt-2 min-h-11 w-full whitespace-normal border border-amber-200/30 bg-amber-100/[0.07] text-amber-50 hover:bg-amber-100/[0.12]">
    {t("Choose Product")}
  </Button>;
  return <div className="mt-2 space-y-2">
    <div className="rounded-lg border border-amber-200/25 bg-amber-100/[0.07] p-3 text-xs leading-relaxed text-amber-50/90">
      {recommendation && <>
        <p className="font-semibold">{t("Review the actual catalog product")}</p>
        <p className="mb-2">{t("This listing is not a confirmed match for {{recommendation}}. Only the catalog product shown below will be chosen.", { recommendation })}</p>
      </>}
      <p className="font-semibold">{t("Shopping reference — Unverified")}</p>
      <p className="mt-1">{t("This records shopping intent only. It is not medical or restricted-diet clearance.")}</p>
      <p className="mt-2 font-medium">{t("Unresolved review items")}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {reference.product.assessment.unresolvedRequirements.map((warning, index) => <li key={index}>{warning}</li>)}
      </ul>
      <p className="mt-2">{reference.product.brand} {reference.product.name} · {reference.product.variant}
        {reference.product.packageDescription ? ` · ${reference.product.packageDescription}` : ""}
      </p>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" disabled={disabled} onClick={() => setConfirming(false)}
        className="min-h-11 flex-1 border border-white/20 bg-transparent text-white hover:bg-white/10">{t("Cancel shopping reference")}</Button>
      <Button type="button" disabled={disabled} onClick={() => void onConfirm(reference)}
        className="min-h-11 flex-1 whitespace-normal bg-amber-700 text-white hover:bg-amber-600">{t("Confirm shopping reference")}</Button>
    </div>
  </div>;
}
