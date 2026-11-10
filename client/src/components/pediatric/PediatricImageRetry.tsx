import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import type { PediatricImageGeneration } from "@shared/pediatricMealImage";

export interface PediatricImageRetryResult {
  imageUrl: string | null;
  imageGeneration: PediatricImageGeneration;
  imagePersisted: boolean;
}

/** Explicit recovery only. Never calls the image endpoint on mount or reload. */
export function PediatricImageRetry({
  mealId, childProfileId, onRecovered,
}: {
  mealId: string;
  childProfileId: string;
  onRecovered: (result: PediatricImageRetryResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    // A lost HTTP response reuses the same operation ID, never a second charge.
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await post<PediatricImageRetryResult>(
        `/api/my-perfect-beginning/generated-meals/${mealId}/regenerate-image`,
        { childProfileId, requestId: requestId.current },
      );
      if (!mounted.current) return;
      onRecovered(result);
      if (!result.imagePersisted) {
        setMessage(`No photograph was saved${result.imageGeneration.failureCode
          ? ` (${result.imageGeneration.failureCode.replace(/_/g, " ")})` : ""}. Wait five minutes before another attempt.`);
        requestId.current = null;
      }
    } catch (error: any) {
      if (mounted.current) {
        setMessage(error?.message || "The request could not be confirmed. Reopen the meal before another attempt.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="mt-3 space-y-2">
    <p className="text-xs text-white/60">
      No generated photograph is saved. Retrying makes one image-generation attempt; your recipe stays unchanged.
    </p>
    <button type="button" onClick={retry} disabled={busy}
      className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-900/40 disabled:opacity-50">
      {busy ? "Generating image…" : "Regenerate Image"}
    </button>
    <p role="status" aria-live="polite" className="text-xs text-amber-200">{message}</p>
  </div>;
}
