import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PillButton } from "@/components/ui/pill-button";
import { post } from "@/lib/api";
import type { SavedGroceryItem } from "./SavedGroceriesSheet";

interface Props {
  item: SavedGroceryItem;
  onUpdated: (item: SavedGroceryItem) => void;
}

/** Mounted only for an explicitly opened, human recommendation. Never auto-run. */
export function SavedProductAnalysisAction({ item, onUpdated }: Props) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const active = useRef(true);
  const requestId = useRef(globalThis.crypto?.randomUUID?.() ?? `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function analyze() {
    if (busy.current || !item.evidenceRevision) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await post<{ item: SavedGroceryItem }>(`/api/saved-groceries/${item.id}/analyze`, {
        requestId: requestId.current, expectedRevision: item.evidenceRevision,
      });
      if (active.current) onUpdated({ ...item, ...response.item, compliance: item.compliance });
    } catch (failure) {
      if (!active.current) return;
      let code = "";
      try { code = JSON.parse((failure as { body?: string }).body ?? "{}").code ?? ""; } catch { /* unknown transport outcome */ }
      const messages: Record<string, string> = {
        analysis_in_progress: "Analysis is already in progress. Reopen this product to check its result.",
        stale_record: "This saved product changed. Reopen it before requesting analysis.",
        not_found: "This saved product was deleted. It has not been recreated.",
        persistence_uncertain: "Analysis finished, but saving could not be confirmed. Reopen this product; do not start another analysis.",
        previous_request_failed: "This request did not complete. Reopen the product before explicitly trying again.",
        analysis_unavailable: "Analysis could not be completed. Your saved recommendation is unchanged.",
        AI_REQUIRES_SUBSCRIPTION: "An active subscription is required to generate a new analysis.",
      };
      setError(messages[code] ?? "The request outcome could not be confirmed. Reopen this product to check before trying again.");
      // Keep the same operation ID after uncertainty; a retry cannot start a
      // second paid request or silently replace another record's evidence.
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }

  return <section className="rounded-xl border border-orange-400/30 p-3 mb-4 space-y-2">
    <p className="text-xs text-white/75">{t("ingredientSheet.simple.analyzeNotice", {
      defaultValue: "Generate this product's own personalized by-name analysis using AI. This uses the paid AI service; opening saved results does not run it again.",
    })}</p>
    <PillButton disabled={pending || !item.evidenceRevision} onClick={analyze}>
      {pending ? t("ingredientSheet.simple.analyzingProduct", { defaultValue: "Analyzing This Product…" })
        : t("ingredientSheet.simple.analyzeProduct", { defaultValue: "Analyze This Product" })}
    </PillButton>
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
  </section>;
}
