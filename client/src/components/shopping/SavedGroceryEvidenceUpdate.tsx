import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import type { SavedGroceryItem } from "./SavedGroceriesSheet";
import { groceryProductLabel } from "@/lib/savedGroceryRecommendation";

/** An explicit confirmation after the customer has chosen a new label scan. */
export default function SavedGroceryEvidenceUpdate({ target, analysis, onUpdated, onCancel }: {
  target: SavedGroceryItem;
  analysis: IngredientScanResult;
  onUpdated: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const session = useRef({ owner: user?.id });
  if (session.current.owner !== user?.id) session.current = { owner: user?.id };
  const [confirmed, setConfirmed] = useState(false);
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [basis, setBasis] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function update() {
    if (!confirmed || !user || pending.current) return;
    const started = session.current;
    pending.current = true;
    setSaving(true); setError("");
    try {
      const nutrition = fat.trim() || carbs.trim() ? {
        ...(fat.trim() ? { fat: Number(fat) } : {}),
        ...(carbs.trim() ? { carbs: Number(carbs) } : {}),
        servingBasis: basis,
      } : undefined;
      await apiRequest(`/api/saved-groceries/${target.id}/evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: target.evidenceRevision, confirmedCurrentLabel: confirmed,
          analysis, nutrition,
        }),
      });
      if (started !== session.current) return;
      queryClient.invalidateQueries({ queryKey: ["/api/saved-groceries"] });
      onUpdated();
    } catch (e: any) {
      if (started === session.current) {
        let body = e?.body;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* retain the plain error */ } }
        setError(body?.error || e?.message || "Evidence was not updated. Previous evidence is unchanged.");
      }
    } finally {
      pending.current = false;
      if (started === session.current) setSaving(false);
    }
  }
  return <section className="rounded-xl border border-orange-400/40 p-3 my-3 text-sm space-y-3">
    <h3 className="font-bold">Update label evidence: {groceryProductLabel(target)}</h3>
    <p>This does not grant safety approval. Your previous evidence is retained; current profile checks still apply.</p>
    <p>Scanned product: {analysis.productName || "Name unavailable"}</p>
    <label className="block">Optional label fat (g per serving)
      <input aria-label="Label fat" type="number" min="0" step="any" value={fat} onChange={e => setFat(e.target.value)} className="block bg-slate-800 p-2 w-full" />
    </label>
    <label className="block">Optional label carbohydrates (g per serving)
      <input aria-label="Label carbohydrates" type="number" min="0" step="any" value={carbs} onChange={e => setCarbs(e.target.value)} className="block bg-slate-800 p-2 w-full" />
    </label>
    <label className="block">Serving size exactly as shown on the label
      <input aria-label="Label serving basis" value={basis} onChange={e => setBasis(e.target.value)} className="block bg-slate-800 p-2 w-full" />
    </label>
    <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
      I confirm this is the current ingredient label for this exact brand and product.
    </label>
    {error && <p role="alert">{error}</p>}
    <button disabled={!confirmed || saving || !user} onClick={update} className="border border-orange-400 rounded-lg p-2 disabled:opacity-50">
      {saving ? "Updating…" : "Confirm evidence update"}
    </button>{" "}
    <button disabled={saving} onClick={onCancel} className="border rounded-lg p-2">Cancel update</button>
  </section>;
}
