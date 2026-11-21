import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PickerModal } from "@/components/ui/universal-modal";
import type { ShoppingIngredientRequest, ShoppingProductReference, ShoppingProductSelection } from "@shared/shoppingProductSelection";
import { parseShoppingProductReference, parseShoppingProductSelection, shoppingIngredientSignature } from "@shared/shoppingProductSelection";
import type { ShoppingRecommendationVerification } from "@shared/shoppingRecommendationVerification";
import type { BetterAlternative } from "@/lib/photoIngredientCapture";
import { BetterAlternativesSection } from "@/components/biometrics/IngredientIntelligenceSheet";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";
import ProductCatalogChoices from "./ProductCatalogChoices";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: ShoppingIngredientRequest;
  quantityLabel: string;
  sessionKey: string;
  currentSelection: ShoppingProductSelection | null;
  onCommit: (selection: ShoppingProductSelection | null) => Promise<void>;
  onCommitReference?: (reference: ShoppingProductReference) => Promise<void>;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export default function ShoppingProductPicker({
  open, onOpenChange, ingredient, quantityLabel, sessionKey, currentSelection, onCommit, onCommitReference,
}: Props) {
  const { t } = useConsumerCopy();
  const [matches, setMatches] = useState<CatalogProductMatch[]>([]);
  const [allCatalogMatches, setAllCatalogMatches] = useState<CatalogProductMatch[]>([]);
  const [hasSelectable, setHasSelectable] = useState(false);
  const [shoppingTip, setShoppingTip] = useState("");
  const [recommendationNotice, setRecommendationNotice] = useState("");
  const [recommendations, setRecommendations] = useState<BetterAlternative[] | null>(null);
  const [recommendationChecks, setRecommendationChecks] = useState<ShoppingRecommendationVerification[]>([]);
  const [recommendationContext, setRecommendationContext] = useState<{ query: string; educationalFooter: string; verdictLevel: string } | null>(null);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingReferenceCategory, setPendingReferenceCategory] = useState<string | null>(null);
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
      setAllCatalogMatches([]);
      setHasSelectable(false);
      setShoppingTip("");
      setRecommendationNotice("");
      setRecommendations(null);
      setRecommendationChecks([]);
      setRecommendationContext(null);
      setCatalogUnavailable(false);
      setLoading(false);
      setError("");
      onOpenChange(false);
    }
  }, [identity, onOpenChange]);

  useEffect(() => {
    generation.current += 1;
    setMatches([]);
    setAllCatalogMatches([]);
    setHasSelectable(false);
    setShoppingTip("");
    setRecommendationNotice("");
    setRecommendations(null);
    setRecommendationChecks([]);
    setRecommendationContext(null);
    setCatalogUnavailable(false);
    setError("");
    setSaving(false);
    setPendingReferenceCategory(null);
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
    // Let StrictMode's setup/cleanup replay finish before dispatch. Abandoned
    // effects never send; each real opening still resolves fresh catalog data.
    Promise.resolve().then(() => {
      if (generation.current !== requestGeneration) return;
      return post("/api/grocery-coach/product-advisor", {
        mode: "find_product",
        ingredients: [ingredient.originalName],
        shoppingIngredient: ingredient,
      });
    }).then(data => {
      if (generation.current !== requestGeneration) return;
      if (data?.error) throw new Error("Catalog lookup unavailable");
      if (!Array.isArray(data?.catalogMatches)) throw new Error("Catalog lookup unavailable");
      const hasRecommendations = Object.prototype.hasOwnProperty.call(data, "recommendations");
      if (hasRecommendations && (!Array.isArray(data.recommendations) ||
        data.recommendations.length > 3 || data.recommendations.some((item: BetterAlternative) =>
          !item || typeof item.category !== "string" || !item.category.trim() ||
          !Array.isArray(item.whyBetter) || item.whyBetter.some(text => typeof text !== "string") ||
          typeof item.targetCriteria !== "string"))) {
        throw new Error("Invalid recommendation presentation");
      }
      const nextRecommendations = hasRecommendations
        ? (Array.isArray(data.recommendations) ? data.recommendations as BetterAlternative[] : [])
        : null;
      setRecommendations(nextRecommendations);
      setRecommendationChecks(Array.isArray(data.recommendationChecks) ? data.recommendationChecks.filter(
        (check: ShoppingRecommendationVerification) => check &&
          typeof check.recommendationCategory === "string" &&
          (check.status === "eligible" || check.status === "review_only") &&
          typeof check.reason === "string" &&
          (check.productKey === undefined || typeof check.productKey === "string") &&
          (check.catalogProductKey === undefined || typeof check.catalogProductKey === "string"),
      ) : []);
      setRecommendationContext(data.recommendationContext && typeof data.recommendationContext === "object" ? {
        query: typeof data.recommendationContext.query === "string" ? data.recommendationContext.query : ingredient.originalName,
        educationalFooter: typeof data.recommendationContext.educationalFooter === "string" ? data.recommendationContext.educationalFooter : "",
        verdictLevel: typeof data.recommendationContext.verdictLevel === "string" ? data.recommendationContext.verdictLevel : "caution",
      } : { query: ingredient.originalName, educationalFooter: "", verdictLevel: "caution" });
      setRecommendationNotice(typeof data.recommendationNotice === "string" ? data.recommendationNotice : "");
      const tip = typeof data.shoppingTip === "string" ? data.shoppingTip.trim() : "";
      setShoppingTip(tip.length > 180 ? `${tip.slice(0, 177)}…` : tip);
      if (data.catalogSearchAvailable === false) {
        if (hasRecommendations) {
          setMatches([]);
          setHasSelectable(false);
          setCatalogUnavailable(true);
          setRecommendationNotice("The product catalog is temporarily unavailable. These personalized suggestions are for review only; no product can be selected.");
        } else {
          setError("The product catalog is temporarily unavailable. Your ingredient and saved choice are unchanged. You can keep it generic.");
        }
        return;
      }
      const all = data.catalogMatches as CatalogProductMatch[];
      setAllCatalogMatches(all);
      const isSupported = (match: CatalogProductMatch) => {
        if (match?.evidenceStatus !== "eligible" || match.shoppingSelection?.eligible !== true) return false;
        try {
          const selection = parseShoppingProductSelection(match.shoppingSelection.selection);
          return selection.product.productKey === match.productKey &&
            shoppingIngredientSignature(selection.ingredient) === shoppingIngredientSignature(ingredient);
        } catch { return false; }
      };
      const displayable = all.filter(match => {
        const display = match.shoppingDisplay;
        return display !== "hidden" && (display === "label_review" || (isSupported(match)));
      }).slice(0, 3);
      setMatches(displayable);
      setHasSelectable(displayable.some(match => {
        const display = match.shoppingDisplay;
        return display !== "hidden" && display !== "label_review" && isSupported(match);
      }));
      setCatalogUnavailable(false);
    }).catch((error: unknown) => {
      if (generation.current !== requestGeneration) return;
      const status = (error as { status?: number } | null)?.status;
      setError(status === 409
        ? "We couldn't confirm your current requirements. Keep this ingredient generic or try again later."
        : status === 401 || status === 403
          ? "Product lookup isn't available for this account. Your ingredient and saved choice are unchanged."
          : "We couldn’t check product choices just now. Your ingredient and saved choice are unchanged. You can keep it generic or close and try again.");
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

  async function commitReference(reference: ShoppingProductReference) {
    if (saving || !onCommitReference) return;
    setSaving(true);
    setError("");
    const commitGeneration = generation.current;
    try {
      await onCommitReference(reference);
      if (open && generation.current === commitGeneration) {
        generation.current += 1;
        onOpenChange(false);
      }
    } catch {
      if (generation.current === commitGeneration) setError("Could not confirm the complete shopping reference save. Some source rows may already have saved; refresh before retrying.");
    } finally {
      setSaving(false);
      setPendingReferenceCategory(null);
    }
  }

  function renderRecommendationAction(alternative: BetterAlternative) {
    const category = typeof alternative.category === "string" ? alternative.category.trim() : "";
    const check = recommendationChecks.find(item => item.recommendationCategory.trim() === category);
    const referenceKey = check?.productKey ?? check?.catalogProductKey;
    const match = referenceKey ? allCatalogMatches.find(item => item.productKey === referenceKey &&
      "recommendationLead" in item && item.recommendationLead === category &&
      item.shoppingDisplay !== "hidden") : undefined;
    let shoppingReference: ShoppingProductReference | null = null;
    if (!catalogUnavailable && onCommitReference && category && check?.status === "review_only" &&
      check.catalogProductKey && check.reference && match &&
      match.productKey === check.catalogProductKey &&
      "recommendationLead" in match &&
      match.recommendationLead === category &&
      match.recommendationIdentityVerified === true &&
      match.shoppingReference) {
      try {
        const fromCheck = parseShoppingProductReference(check.reference);
        const fromCatalog = parseShoppingProductReference(match.shoppingReference);
        if (fromCheck.product.productKey === match.productKey &&
          fromCatalog.product.productKey === match.productKey &&
          shoppingIngredientSignature(fromCheck.ingredient) === shoppingIngredientSignature(ingredient) &&
          shoppingIngredientSignature(fromCatalog.ingredient) === shoppingIngredientSignature(ingredient) &&
          stableJson(fromCheck) === stableJson(fromCatalog)) {
          shoppingReference = fromCheck;
        }
      } catch { /* invalid or mismatched intent stays review-only */ }
    }
    let verifiedSelection: ShoppingProductSelection | null = null;
    if (!catalogUnavailable && check?.status === "eligible" && check.productKey && match &&
      "recommendationLead" in match && match.recommendationLead === category &&
      match.productKey === check.productKey &&
      match.recommendationIdentityVerified === true &&
      match.evidenceStatus === "eligible" &&
      match.shoppingDisplay === "selectable" &&
      match.shoppingSelection?.eligible === true) {
      try {
        const parsed = parseShoppingProductSelection(match.shoppingSelection.selection);
        if (parsed.product.productKey === match.productKey &&
          shoppingIngredientSignature(parsed.ingredient) === shoppingIngredientSignature(ingredient)) {
          verifiedSelection = parsed;
        }
      } catch { /* incomplete catalog evidence remains review-only */ }
    }
    const facts = match ? [
      ...(match.nutrition ?? []).map(item => ({ text: item.statement, source: item.source })),
      ...(match.allergenInformation ?? []).map(item => ({ text: item.statement, source: item.source })),
    ].filter(item => item.text && item.source).slice(0, 3) : [];
    return (
      <div className="mt-2 space-y-2">
        {match && <details className="rounded-lg border border-white/10 bg-black/15 p-2.5 text-xs text-white/75">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold text-orange-100">{t("Review product identity and label evidence")}</summary>
          {match.recommendationIdentityVerified !== true && <p className="mb-2 text-amber-100">{t("Catalog candidate only — not confirmed as the exact recommended variant.")}</p>}
          <p className="font-semibold text-white">{match.name}{match.brand ? ` · ${match.brand}` : ""}</p>
          {match.variant && <p className="mt-1">Variant: {match.variant}</p>}
          {match.packageSize && <p className="mt-1">Package: {match.packageSize}</p>}
          <p className="mt-1 text-white/60">Source: {match.source} · Record: {match.sourceRecordId}</p>
          {match.serving && <p className="mt-1">{match.serving} <span className="text-white/45">Source: {match.source}</span></p>}
          {facts.map((fact, index) => <p key={`${fact.source}-${index}`} className="mt-1 leading-relaxed">
            {fact.text} <span className="text-white/45">Source: {fact.source}</span>
          </p>)}
          {match.ingredients && <p className="mt-1 text-white/60">Catalog ingredient list: {match.ingredients} <span className="text-white/45">Source: {match.source}</span></p>}
        </details>}
        {verifiedSelection ? <Button
          type="button"
          disabled={saving}
          onClick={() => void commit(verifiedSelection)}
          className="shopping-recommendation-action min-h-11 w-full whitespace-normal bg-orange-600 text-white hover:bg-orange-500"
        >{t("Choose for My List")}</Button> : shoppingReference ? <div className="space-y-2">
          {pendingReferenceCategory === category ? <>
            <div className="rounded-lg border border-amber-200/25 bg-amber-100/[0.07] p-3 text-xs leading-relaxed text-amber-50/90">
              <p className="font-semibold">{t("Shopping reference — Unverified")}</p>
              <p className="mt-1">This records shopping intent only. It is not medical or restricted-diet clearance.</p>
              <p className="mt-2 font-medium">{t("Unresolved review items")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {shoppingReference.product.assessment.unresolvedRequirements.map((warning, index) =>
                  <li key={`${index}-${warning}`}>{warning}</li>)}
              </ul>
              <p className="mt-2">Product: {shoppingReference.product.brand} {shoppingReference.product.name}
                {shoppingReference.product.variant ? ` · ${shoppingReference.product.variant}` : ""}
                {shoppingReference.product.packageDescription
                  ? ` · ${shoppingReference.product.packageDescription}`
                  : shoppingReference.product.retailQuantity !== undefined
                    ? ` · ${shoppingReference.product.retailQuantity}${shoppingReference.product.servingDescription ? ` ${shoppingReference.product.servingDescription}` : ""}`
                    : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={saving} onClick={() => setPendingReferenceCategory(null)}
                className="min-h-11 flex-1 border border-white/20 bg-transparent text-white hover:bg-white/10">{t("Cancel shopping reference")}</Button>
              <Button type="button" disabled={saving} onClick={() => void commitReference(shoppingReference)}
                className="min-h-11 flex-1 whitespace-normal bg-amber-700 text-white hover:bg-amber-600">
                {saving ? "Saving reference…" : "Confirm shopping reference"}
              </Button>
            </div>
          </> : <Button type="button" disabled={saving} onClick={() => setPendingReferenceCategory(category)}
            className="min-h-11 w-full whitespace-normal border border-amber-200/30 bg-amber-100/[0.07] text-amber-50 hover:bg-amber-100/[0.12]">
            Use as shopping reference
          </Button>}
        </div> : <p className="rounded-lg border border-amber-200/15 bg-amber-100/[0.05] px-3 py-2 text-xs leading-relaxed text-amber-50/80">
          Review only — {catalogUnavailable
            ? "The product catalog is temporarily unavailable. No exact product can be selected."
            : check?.status === "review_only" && check.reason
              ? check.reason
              : "A matching exact-product selection could not be verified for this ingredient."}
        </p>}
      </div>
    );
  }

  return (
    <PickerModal
      open={open}
      onOpenChange={closeWithoutSaving}
      title="Here are your product options."
      description={`${ingredient.originalName} · Original amount: ${quantityLabel}. Your ingredient and recipe quantities stay the same.`}
      className="shopping-product-picker border border-orange-200/15 bg-[#211c18] text-white"
      footer={<div className="shopping-picker-footer flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => closeWithoutSaving(false)} className="text-white/75 hover:bg-white/10">Cancel</Button>
        <div className="shopping-picker-footer-actions flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={saving} onClick={() => currentSelection ? void commit(null) : closeWithoutSaving(false)} className="border-white/20 bg-transparent text-white hover:bg-white/10">Keep generic</Button>
          {currentSelection && <Button type="button" variant="outline" disabled={saving} onClick={() => void commit(null)} className="border-orange-200/25 bg-transparent text-orange-100 hover:bg-orange-300/10">Clear choice</Button>}
        </div>
      </div>}
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm text-white/75">These are shopping references, not medical approval. Check the package label before you buy.</p>
        </div>
        {loading && <div role="status" aria-label="Loading catalog choices" className="space-y-3">{[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.06]" />)}<p className="text-xs text-white/55">Finding personalized options and checking existing catalog evidence…</p></div>}
        {error && <p role="alert" className="rounded-lg border border-red-200/20 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
        {!loading && !error && recommendations !== null && <>
          {catalogUnavailable && <p role="status" className="rounded-lg border border-amber-200/15 bg-amber-100/[0.05] p-3 text-sm text-amber-50/80">{recommendationNotice}</p>}
          <BetterAlternativesSection
            alternatives={recommendations}
            branded
            verdictLevel={recommendationContext?.verdictLevel}
            query={recommendationContext?.query ?? ingredient.originalName}
            educationalFooter={recommendationContext?.educationalFooter ?? ""}
            source="grocery-coach"
            showEvidenceNote={false}
            renderAction={renderRecommendationAction}
          badgeLabel="Shopping options"
          />
          {recommendations.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/75">{recommendationNotice || "No personalized product recommendations are available. You can keep this ingredient generic."}</p>}
        </>}
        {!loading && !error && recommendations === null && <>
          {matches.length > 0 && <ProductCatalogChoices
            products={matches}
            compactShopping
            disabled={saving}
            onSelect={(product) => {
              if (product.shoppingDisplay === "label_review") return;
              const selection = product.shoppingSelection?.selection;
              if (selection) void commit(selection);
            }}
          />}
          {!hasSelectable && <>
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-white/75">{recommendationNotice || (matches.length
              ? "Personalized product options are available for review, but verification is incomplete. Choose is unavailable until the existing requirements are met."
              : "No suitable specific product could be identified. You can keep this ingredient generic.")}</p>
          </>}
        </>}
        {!loading && (recommendations !== null || !hasSelectable) && <p className="rounded-lg border border-orange-200/10 bg-orange-100/[0.04] px-3 py-2 text-xs leading-relaxed text-orange-50/75">{shoppingTip || "Product labels can vary; check the current package before choosing."}</p>}
        {saving && <p role="status" className="text-xs text-white/60">Saving your choice…</p>}
      </div>
    </PickerModal>
  );
}
