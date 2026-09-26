import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiRequest";

type Source = {
  id: string;
  protocol_key: string;
  care_relationship_id: string;
  directive_id: string | null;
  disposition: string | null;
  rule: { kind: string; ingredientKey?: string; nutrient?: string; amount?: number } | null;
};
type LegacyClaim = { id: string; protocol_key: string; membership_id: string };

/** Development shadow review only. This does not change any meal generator. */
export function ClinicalDirectiveReviewPanel({ clientUserId }: { clientUserId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [legacyClaims, setLegacyClaims] = useState<LegacyClaim[]>([]);
  const [reviewMode, setReviewMode] = useState<"source" | "legacy">("source");
  const [legacyId, setLegacyId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [kind, setKind] = useState<"avoid_ingredient" | "nutrient_bound">("avoid_ingredient");
  const [ingredient, setIngredient] = useState("");
  const [nutrient, setNutrient] = useState<"sodium" | "potassium" | "phosphorus" | "carbohydrate" | "protein" | "saturated_fat">("sodium");
  const [amount, setAmount] = useState("");
  const [comparator, setComparator] = useState<"at_most" | "at_least">("at_most");
  const [scope, setScope] = useState<"per_serving" | "per_day">("per_serving");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const path = `/api/health-context/provider/${encodeURIComponent(clientUserId)}`;
  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_IS_PRODUCTION_PROJECT === "true") return;
    let current = true;
    setLoading(true);
    setSources([]);
    setLegacyClaims([]);
    setSourceId("");
    setLegacyId("");
    setError("");
    apiRequest(`${path}/sources`).then((data: unknown) => {
      const response = data as { shadowOnly?: boolean; sources?: Source[]; legacyClaims?: LegacyClaim[] };
      if (!response.shadowOnly || !Array.isArray(response.sources) ||
          !Array.isArray(response.legacyClaims)) throw new Error("Review unavailable.");
      if (current) {
        setSources(response.sources);
        setSourceId(response.sources[0]?.id ?? "");
        setLegacyClaims(response.legacyClaims);
        setLegacyId(response.legacyClaims[0]?.id ?? "");
        setReviewMode(response.sources.length ? "source" : "legacy");
      }
    }).catch((err) => { if (current) setError(err instanceof Error ? err.message : "Review unavailable."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [path]);
  const refresh = async () => {
    const response = await apiRequest(`${path}/sources`) as { sources: Source[]; legacyClaims: LegacyClaim[] };
    setSources(response.sources);
    setLegacyClaims(response.legacyClaims);
    if (!response.legacyClaims.length) setReviewMode("source");
  };
  const selected = sources.find((source) => source.id === sourceId);
  const selectedLegacy = legacyClaims.find((claim) => claim.id === legacyId);
  const save = async () => {
    if ((reviewMode === "source" ? !selected : !selectedLegacy) || busy) return;
    setError("");
    setBusy(true);
    try {
      const rule = kind === "avoid_ingredient"
        ? { kind, ingredientKey: ingredient.trim().toLowerCase().replace(/\s+/g, "_") }
        : {
          kind, nutrient, comparator, amount: Number(amount),
          unit: ["sodium", "potassium", "phosphorus"].includes(nutrient) ? "mg" : "g",
          scope,
        };
      const verifyingLegacy = reviewMode === "legacy";
      await apiRequest(verifyingLegacy
        ? `${path}/legacy/${selectedLegacy!.id}/verify`
        : `${path}/directive`, {
        method: "POST", body: JSON.stringify({
          ...(verifyingLegacy ? {} : { sourceId: selected!.id }),
          membershipId: verifyingLegacy ? selectedLegacy!.membership_id : selected!.care_relationship_id,
          rule, effectiveAt: new Date().toISOString(),
        }),
      });
      await refresh();
      setIngredient("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Directive could not be recorded.");
    } finally { setBusy(false); }
  };
  const discontinue = async (source: Source) => {
    if (!source.directive_id || busy ||
        !window.confirm("Mark this exact provider instruction as no longer current? Its history will be retained.")) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`${path}/directive/${source.directive_id}/discontinue`, {
        method: "POST", body: JSON.stringify({
          sourceId: source.id, membershipId: source.care_relationship_id,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Directive could not be updated.");
    } finally { setBusy(false); }
  };
  if (!import.meta.env.DEV || import.meta.env.VITE_IS_PRODUCTION_PROJECT === "true") return null;
  return (
    <section className="rounded-xl border border-amber-400/30 bg-white/5 p-4 space-y-3" aria-label="Exact clinical food instructions">
      <h3 className="text-white font-semibold">Exact clinical food instructions · Development review</h3>
      <p className="text-xs text-white/70">These instructions are recorded for review only. Current meal safety rules are unchanged.</p>
      {loading && <p role="status" className="text-white/70 text-sm">Checking verified clinical sources…</p>}
      {error && <p role="alert" className="text-red-200 text-sm">{error}</p>}
      {!loading && sources.length === 0 && legacyClaims.length === 0 && !error &&
        <p className="text-amber-100 text-sm">No active verified provider source or pending legacy claim is available through your clinic. A condition name alone cannot establish a food instruction.</p>}
      {(sources.length > 0 || legacyClaims.length > 0) && (
        <>
          {sources.length > 0 && legacyClaims.length > 0 && (
            <label className="block text-sm text-white/80">Review action
              <select value={reviewMode} onChange={(event) => setReviewMode(event.target.value as typeof reviewMode)}
                className="block mt-1 w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                <option value="source">Record on a verified provider source</option>
                <option value="legacy">Verify a pending earlier claim</option>
              </select>
            </label>
          )}
          {reviewMode === "legacy" ? (
            <label className="block text-sm text-white/80">Pending earlier claim
              <select value={legacyId} onChange={(event) => setLegacyId(event.target.value)}
                className="block mt-1 w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                {legacyClaims.map((claim) => <option key={`${claim.id}:${claim.membership_id}`} value={claim.id}>
                  {claim.protocol_key} · earlier profile claim
                </option>)}
              </select>
            </label>
          ) : (
            <label className="block text-sm text-white/80">Verified provider source
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}
                className="block mt-1 w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                {[...new Map(sources.map((source) => [source.id, source])).values()].map((source) =>
                  <option key={source.id} value={source.id}>{source.protocol_key}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm text-white/80">Exact rule type
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}
              className="block mt-1 w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
              <option value="avoid_ingredient">Avoid exact ingredient</option>
              <option value="nutrient_bound">Measurable nutrient bound</option>
            </select>
          </label>
          {kind === "avoid_ingredient" ? (
            <label className="block text-sm text-white/80">Ingredient key
              <input value={ingredient} onChange={(event) => setIngredient(event.target.value)}
                placeholder="e.g. peanut" className="block mt-1 w-full rounded bg-neutral-900 border border-white/20 p-2 text-white" />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="text-white/80">Nutrient
                <select value={nutrient} onChange={(event) => setNutrient(event.target.value as typeof nutrient)}
                  className="block w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                  {["sodium", "potassium", "phosphorus", "carbohydrate", "protein", "saturated_fat"].map((value) =>
                    <option key={value} value={value}>{value.replace("_", " ")}</option>)}
                </select>
              </label>
              <label className="text-white/80">Bound
                <select value={comparator} onChange={(event) => setComparator(event.target.value as typeof comparator)}
                  className="block w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                  <option value="at_most">At most</option><option value="at_least">At least</option>
                </select>
              </label>
              <label className="text-white/80">Amount ({["sodium", "potassium", "phosphorus"].includes(nutrient) ? "mg" : "g"})
                <input type="number" min="0.01" step="any" value={amount} onChange={(event) => setAmount(event.target.value)}
                  className="block w-full rounded bg-neutral-900 border border-white/20 p-2 text-white" />
              </label>
              <label className="text-white/80">Scope
                <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}
                  className="block w-full rounded bg-neutral-900 border border-white/20 p-2 text-white">
                  <option value="per_serving">Per serving</option><option value="per_day">Per day</option>
                </select>
              </label>
            </div>
          )}
          <button type="button" disabled={busy || (kind === "avoid_ingredient" ? !ingredient.trim() : !Number(amount))}
            onClick={() => void save()} className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
            {reviewMode === "legacy" ? "Verify claim with exact instruction" : "Record exact instruction"}
          </button>
          {sources.filter((source) => source.directive_id).map((source) => (
            <div key={source.directive_id} className="flex items-center justify-between gap-2 rounded border border-white/15 p-2 text-xs text-white/80">
              <span>{source.protocol_key}: {source.rule?.kind === "avoid_ingredient"
                ? `Avoid ${source.rule.ingredientKey}`
                : `${source.rule?.nutrient} ${source.rule?.amount}`} — {source.disposition}</span>
              {source.disposition === "verified_provider_directive" &&
                <button disabled={busy} onClick={() => void discontinue(source)} className="text-amber-200 underline">Mark past</button>}
            </div>
          ))}
        </>
      )}
    </section>
  );
}