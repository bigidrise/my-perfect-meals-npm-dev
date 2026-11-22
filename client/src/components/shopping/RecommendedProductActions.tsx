import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bookmark, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BetterAlternative } from "@/lib/photoIngredientCapture";
import {
  groceryProductLabel, recommendationIdentity, recommendationProductKey,
  recommendationSavePayload,
} from "@/lib/savedGroceryRecommendation";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";

interface SavedProduct {
  id: string;
  productKey: string;
  productName: string;
  brand?: string | null;
}

/** A bookmark for this exact recommendation, independent of the parent scan. */
export default function RecommendedProductActions({ alternative, query, educationalFooter, source, subjectKind, catalogProduct, label, contextKey, disabled = false }: {
  alternative: BetterAlternative;
  query: string;
  educationalFooter: string;
  source?: "scanner" | "grocery-coach";
  subjectKind?: string;
  /** Optional Shopping adapter. Scanner/Coach callers retain their original behavior. */
  catalogProduct?: CatalogProductMatch;
  label?: string;
  contextKey?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const sessionRef = useRef({ owner, contextKey });
  if (sessionRef.current.owner !== owner || sessionRef.current.contextKey !== contextKey) sessionRef.current = { owner, contextKey };
  const { t } = useTranslation();
  const { toast } = useToast();
  // Preserve an explicitly sourced variant in the bookmark's identity, even
  // when the source has no UPC. Do not infer a variant from recommendation prose.
  const identity = catalogProduct ? {
    productName: catalogProduct.variant && !catalogProduct.name.toLowerCase().includes(catalogProduct.variant.toLowerCase())
      ? `${catalogProduct.name} ${catalogProduct.variant}` : catalogProduct.name,
    brand: catalogProduct.brand,
  } : recommendationIdentity(alternative);
  const productKey = catalogProduct?.barcode?.trim()
    ? `upc::${catalogProduct.barcode.trim()}` : recommendationProductKey(identity);
  const requestRef = useRef<{ session: object; token: object } | null>(null);
  const [pending, setPending] = useState<{ session: object; key: string } | null>(null);
  useEffect(() => () => { requestRef.current = null; }, []);
  const { data } = useQuery<{ items: SavedProduct[] }>({
    queryKey: ["/api/saved-groceries", owner],
    queryFn: () => apiRequest("/api/saved-groceries"),
    enabled: !!owner,
    staleTime: 0,
  });
  const saved = !!owner && !!data?.items?.some(item =>
    item.productKey === productKey ||
    // Older scans stored the full brand/name in productName, not split fields.
    (!catalogProduct?.barcode && groceryProductLabel(item).trim().toLowerCase() === groceryProductLabel(identity).trim().toLowerCase()),
  );
  const saving = pending?.session === sessionRef.current && pending.key === productKey;

  async function save() {
    if (!owner || disabled || saved || saving || !identity.productName) return;
    // Guard double clicks before React commits the disabled state.
    const token = {};
    const session = sessionRef.current;
    if (requestRef.current?.session === session) return;
    requestRef.current = { session, token };
    setPending({ session, key: productKey });
    try {
      const payload = recommendationSavePayload(alternative, { query, educationalFooter, source, subjectKind });
      const response = await apiRequest<{ item?: SavedProduct }>("/api/saved-groceries", {
        method: "POST",
        body: JSON.stringify(catalogProduct ? {
          ...payload, ...identity, barcode: catalogProduct.barcode || undefined,
          productMeta: {
            ...payload.productMeta,
            ingredients: catalogProduct.ingredients ? [catalogProduct.ingredients] : [],
            nutrition: catalogProduct.nutrition ?? [],
            allergenInformation: catalogProduct.allergenInformation ?? [],
            catalogSource: catalogProduct.source, sourceRecordId: catalogProduct.sourceRecordId,
            catalogDate: catalogProduct.catalogDate, variant: catalogProduct.variant,
            packageSize: catalogProduct.packageSize,
            catalogEvidenceStatus: catalogProduct.evidenceStatus,
            verificationMessage: [...new Set([
              catalogProduct.shoppingCaution || catalogProduct.verificationMessage,
              ...(catalogProduct.shoppingReference?.product.assessment.unresolvedRequirements ?? []),
            ].filter(Boolean))].join(" "),
            // Bookmarking never promotes catalog status to medical verification.
          },
        } : payload),
        headers: { "Content-Type": "application/json" },
      });
      if (sessionRef.current !== session || requestRef.current?.token !== token) return;
      if (response.item?.productKey !== productKey) throw new Error("Saved product identity mismatch");
      queryClient.setQueryData<{ items: SavedProduct[] }>(["/api/saved-groceries", owner], previous => ({
        items: [...(previous?.items ?? []).filter(item => item.productKey !== productKey), response.item!],
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/saved-groceries"] });
      try {
        const channel = new BroadcastChannel("mpm:grocery-saved");
        channel.postMessage(null);
        channel.close();
      } catch { /* optional cross-tab refresh */ }
      toast({
        title: t("ingredientSheet.toast.savedTitle"),
        description: t("ingredientSheet.toast.savedDesc", { name: groceryProductLabel(identity) }),
      });
    } catch {
      if (sessionRef.current === session && requestRef.current?.token === token) {
        toast({ title: t("ingredientSheet.toast.saveFailTitle"), description: t("ingredientSheet.toast.tryAgain"), variant: "destructive" });
      }
    } finally {
      if (requestRef.current?.token === token) {
        requestRef.current = null;
        setPending(null);
      }
    }
  }

  return (
    <button type="button" onClick={save} disabled={!owner || disabled || saved || saving}
      aria-label={`${label || t("ingredientSheet.saveToGroceries")}: ${groceryProductLabel(identity)}`}
      aria-pressed={saved}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-orange-300 disabled:opacity-60">
      {saved ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
      {saved ? t("ingredientSheet.savedToGroceries") : label || t("ingredientSheet.saveToGroceries")}
    </button>
  );
}
