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

interface SavedProduct {
  id: string;
  productKey: string;
  productName: string;
  brand?: string | null;
}

/** A bookmark for this exact recommendation, independent of the parent scan. */
export default function RecommendedProductActions({ alternative, query, educationalFooter }: {
  alternative: BetterAlternative;
  query: string;
  educationalFooter: string;
}) {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const sessionRef = useRef({ owner });
  if (sessionRef.current.owner !== owner) sessionRef.current = { owner };
  const { t } = useTranslation();
  const { toast } = useToast();
  const identity = recommendationIdentity(alternative);
  const productKey = recommendationProductKey(identity);
  const requestRef = useRef<{ session: object; token: object } | null>(null);
  const [pending, setPending] = useState<{ session: object; key: string } | null>(null);
  useEffect(() => () => { requestRef.current = null; }, []);
  const { data } = useQuery<{ items: SavedProduct[] }>({
    queryKey: ["/api/saved-groceries", owner],
    queryFn: () => apiRequest("/api/saved-groceries"),
    enabled: !!owner,
    staleTime: 0,
  });
  const saved = !!owner && !!data?.items?.some(item => item.productKey === productKey);
  const saving = pending?.session === sessionRef.current && pending.key === productKey;

  async function save() {
    if (!owner || saved || saving || !identity.productName) return;
    // Guard double clicks before React commits the disabled state.
    const token = {};
    const session = sessionRef.current;
    if (requestRef.current?.session === session) return;
    requestRef.current = { session, token };
    setPending({ session, key: productKey });
    try {
      const response = await apiRequest<{ item?: SavedProduct }>("/api/saved-groceries", {
        method: "POST",
        body: JSON.stringify(recommendationSavePayload(alternative, { query, educationalFooter })),
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
    <button type="button" onClick={save} disabled={!owner || saved || saving}
      aria-label={`${t("ingredientSheet.saveToGroceries")}: ${groceryProductLabel(identity)}`}
      aria-pressed={saved}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-orange-300 disabled:opacity-60">
      {saved ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
      {saved ? t("ingredientSheet.savedToGroceries") : t("ingredientSheet.saveToGroceries")}
    </button>
  );
}
