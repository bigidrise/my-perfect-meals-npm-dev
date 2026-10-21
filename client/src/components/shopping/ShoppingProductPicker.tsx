import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PickerModal } from "@/components/ui/universal-modal";
import type { ShoppingIngredientRequest, ShoppingProductSelection } from "@shared/shoppingProductSelection";
import { parseShoppingProductSelection, shoppingIngredientSignature } from "@shared/shoppingProductSelection";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";
import ProductCatalogChoices from "./ProductCatalogChoices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: ShoppingIngredientRequest;
  quantityLabel: string;
  sessionKey: string;
  currentSelection: ShoppingProductSelection | null;
  onCommit: (selection: ShoppingProductSelection | null) => Promise<void>;
}

export default function ShoppingProductPicker({
  open, onOpenChange, ingredient, quantityLabel, sessionKey, currentSelection, onCommit,
}: Props) {
  const [matches, setMatches] = useState<CatalogProductMatch[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const rowKey = `${ingredient.originalName}|${JSON.stringify(ingredient.requirements)}`;
  const identity = `${sessionKey}|${rowKey}`;
  const lastIdentity = useRef(identity);
  const effectIdentity = useRef(identity);
  const lastOpen = useRef(open);
  if (lastIdentity.current !== identity) {
    lastIdentity.current = identity;
    generation.current += 1;
  }
  if (lastOpen.current !== open) {
    lastOpen.current = open;
    generation.current += 1;
  }

  useEffect(() => {
    if (effectIdentity.current !== identity) {
      effectIdentity.current = identity;
      generation.current += 1;
      setMatches([]);
      setReviewCount(0);
      setBlockedReasons([]);
      setLoading(false);
      setError("");
      onOpenChange(false);
    }
  }, [identity, onOpenChange]);

  useEffect(() => {
    generation.current += 1;
    setMatches([]);
    setReviewCount(0);
    setBlockedReasons([]);
    setNotice("");
    setError("");
    setSaving(false);
    if (!open) {
      setLoading(false);
      return;
    }
    if (ingredient.originalName.trim().length > 80) {
      setLoading(false);
      setError("This ingredient is longer than the 80-character lookup limit. Nothing was shortened; keep it generic.");
      return;
    }
    const requestGeneration = generation.current;
    setLoading(true);
    post("/api/grocery-coach/product-advisor", {
      mode: "find_product",
      ingredients: [ingredient.originalName],
      shoppingIngredient: ingredient,
    }).then(data => {
      if (generation.current !== requestGeneration) return;
      if (data?.error) throw new Error("Catalog lookup unavailable");
      if (!Array.isArray(data?.catalogMatches)) throw new Error("Catalog lookup unavailable");
      const all = data.catalogMatches as CatalogProductMatch[];
      const isSupported = (match: CatalogProductMatch) => {
        if (match?.evidenceStatus !== "eligible" || match.shoppingSelection?.eligible !== true) return false;
        try {
          const selection = parseShoppingProductSelection(match.shoppingSelection.selection);
          return selection.product.productKey === match.productKey &&
            shoppingIngredientSignature(selection.ingredient) === shoppingIngredientSignature(ingredient);
        } catch { return false; }
      };
      const supported = all.filter(isSupported).slice(0, 3);
      setMatches(supported);
      const blocked = all.filter(match => !isSupported(match));
      setReviewCount(blocked.length);
      setBlockedReasons([...new Set(blocked.map(match => match.shoppingSelection?.reason || match.verificationMessage).filter((reason): reason is string => !!reason))].slice(0, 3));
      setNotice(typeof data.catalogNotice === "string" ? data.catalogNotice : "");
    }).catch(() => {
      if (generation.current === requestGeneration) setError("Could not load catalog choices. Your ingredient and saved choice are unchanged. Close this picker and choose again to retry.");
    }).finally(() => {
      if (generation.current === requestGeneration) setLoading(false);
    });
    return () => { generation.current += 1; };
  }, [open]);

  const closeWithoutSaving = (nextOpen: boolean) => {
    if (!nextOpen) {
      generation.current += 1;
      onOpenChange(false);
    }
  };

  async function commit(selection: ShoppingProductSelection | null) {
    if (saving) return;
    setSaving(true);
    setError("");
    const commitGeneration = generation.current;
    try {
      await onCommit(selection);
      if (open && generation.current === commitGeneration) {
        generation.current += 1;
        onOpenChange(false);
      }
    } catch {
      if (generation.current === commitGeneration) setError("Could not confirm the complete shopping choice. Some source rows may already have saved. Refresh the list before retrying.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PickerModal
      open={open}
      onOpenChange={closeWithoutSaving}
      title="Choose a product"
      description={`Original ingredient: ${ingredient.originalName} · Recipe amount: ${quantityLabel}. Product packages do not change recipe quantities.`}
      className="border border-orange-200/15 bg-[#211c18] text-white"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => closeWithoutSaving(false)} className="text-white/75 hover:bg-white/10">Cancel</Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={saving} onClick={() => currentSelection ? void commit(null) : closeWithoutSaving(false)} className="border-white/20 bg-transparent text-white hover:bg-white/10">Keep generic</Button>
          {currentSelection && <Button type="button" variant="outline" disabled={saving} onClick={() => void commit(null)} className="border-orange-200/25 bg-transparent text-orange-100 hover:bg-orange-300/10">Clear choice</Button>}
        </div>
      </div>}
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200/70">Shopping choice only</p>
          <p className="mt-1 text-sm text-white/75">The original ingredient, its amount, meal contributions, and nutrition remain unchanged. Saved assessments are historical evidence, not current medical advice.</p>
        </div>
        {loading && <div role="status" aria-label="Loading catalog choices" className="space-y-3">{[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.06]" />)}<p className="text-xs text-white/55">Checking existing catalog evidence…</p></div>}
        {error && <p role="alert" className="rounded-lg border border-red-200/20 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
        {!loading && !error && <>
          {notice && <p className="text-xs text-white/60">{notice}</p>}
          {matches.length > 0 ? <ProductCatalogChoices
            products={matches}
            shoppingOnly
            disabled={saving}
            onSelect={(product) => {
              const selection = product.shoppingSelection?.selection;
              if (selection) void commit(selection);
            }}
          /> : <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">No evidence-supported catalog choices are available. Keep the original ingredient generic.</p>}
          {reviewCount > 0 && <p className="text-xs leading-relaxed text-amber-100/75">{reviewCount} catalog {reviewCount === 1 ? "option needs" : "options need"} further review and {reviewCount === 1 ? "is" : "are"} not selectable here.</p>}
          {!!blockedReasons.length && <ul aria-label="Why other catalog options are unavailable" className="list-disc space-y-1 pl-5 text-xs text-amber-100/70">{blockedReasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul>}
        </>}
        {saving && <p role="status" className="text-xs text-white/60">Saving your choice…</p>}
      </div>
    </PickerModal>
  );
}
