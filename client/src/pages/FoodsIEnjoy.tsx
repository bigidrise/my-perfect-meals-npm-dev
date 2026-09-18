import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Heart, Plus, Save, Trash2, Sparkles, Users, AlertCircle } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useHousehold } from "@/contexts/HouseholdContext";
import {
  FOODS_I_ENJOY_CATALOG,
  FOODS_I_ENJOY_VERSION,
  type FoodEnjoymentItem,
  type FoodsIEnjoyDocument,
} from "@shared/foodsIEnjoy";

const GROUP_LABELS: Record<string, string> = {
  "meals-dishes": "Meals & Dishes", breakfast: "Breakfast", proteins: "Proteins",
  "fruits-vegetables": "Fruits & Vegetables", "snacks-treats": "Snacks & Treats",
  desserts: "Desserts", drinks: "Drinks", cuisines: "Cuisines",
};

function clientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readDocument(payload: any): FoodsIEnjoyDocument {
  return payload?.document ?? payload?.data?.document ?? payload;
}

export default function FoodsIEnjoy() {
  const { profiles, isHousehold, loading: profilesLoading } = useHousehold();
  const [profileId, setProfileId] = useState("");
  const [document, setDocument] = useState<FoodsIEnjoyDocument | null>(null);
  const [openGroup, setOpenGroup] = useState("meals-dishes");
  const [customFood, setCustomFood] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endpoint = useMemo(() => profileId
    ? `/api/household/profiles/${profileId}/foods-i-enjoy`
    : "/api/foods-i-enjoy", [profileId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(apiUrl(endpoint), { headers: getAuthHeaders(), credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.details || payload?.error || "We couldn't load your foods right now.");
      setDocument(readDocument(payload));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't load your foods right now.");
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const items = document?.items.filter((item) => !item.revokedAt) ?? [];
  const addCatalog = (entry: typeof FOODS_I_ENJOY_CATALOG[number]) => {
    if (items.some((item) => item.conceptId === entry.conceptId)) return;
    const item: FoodEnjoymentItem = {
      id: clientId(), conceptId: entry.conceptId, kind: entry.kind, category: entry.category,
      displayLabel: entry.label, originalText: null, locale: navigator.language || "en-US",
      source: "catalog", provenance: "explicit", selectedAt: new Date().toISOString(), revokedAt: null,
    };
    setDocument((current) => current ? { ...current, configured: true, items: [...current.items, item] } : current);
  };
  const addCustom = () => {
    const text = customFood.trim();
    if (!text || items.some((item) => item.displayLabel.toLowerCase() === text.toLowerCase())) return;
    const item: FoodEnjoymentItem = {
      id: clientId(), conceptId: null, kind: "custom", category: "custom", displayLabel: text,
      originalText: text, locale: navigator.language || "en-US", source: "free_text",
      provenance: "explicit", selectedAt: new Date().toISOString(), revokedAt: null,
    };
    setDocument((current) => current ? { ...current, configured: true, items: [...current.items, item] } : current);
    setCustomFood("");
  };
  const remove = (id: string) => setDocument((current) => current ? {
    ...current, items: current.items.map((item) => item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item),
  } : current);
  const save = async () => {
    if (!document) return;
    setSaving(true); setError(null); setNotice(null);
    const payload: FoodsIEnjoyDocument = { ...document, version: FOODS_I_ENJOY_VERSION, updatedAt: new Date().toISOString() };
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include", body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result?.details || result?.message || result?.error;
        throw new Error(detail ? `Your foods couldn't be saved: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "Your foods couldn't be saved. Please try again.");
      }
      setDocument(readDocument(result)); setNotice("Saved. We'll keep your favorites in mind.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your foods couldn't be saved. Please try again.");
    } finally { setSaving(false); }
  };

  return <main className="min-h-100dvh overflow-y-auto bg-gradient-to-br from-black via-orange-950/90 to-black pb-safe-nav text-white">
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute -right-24 top-[38rem] h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
    </div>
    <div className="relative mx-auto max-w-5xl px-4 pb-28 pt-[calc(env(safe-area-inset-top)+2rem)] sm:px-8 sm:pt-12">
      <header className="max-w-3xl rounded-2xl border border-white/15 bg-black/50 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-300/30 bg-orange-500/15 text-orange-300 shadow-lg shadow-orange-950/40"><Heart className="h-6 w-6" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Food profile</p><p className="mt-1 text-xs text-white/45">A better starting point for every meal</p></div>
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">Tell us what you actually enjoy eating.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">There is no perfect answer here. Choose the foods, dishes, and flavors that feel like you — the everyday ones and the just-for-fun ones.</p>
      </header>
      {isHousehold && <section className="mt-8 max-w-md rounded-2xl border border-white/15 bg-black/45 p-4 shadow-2xl backdrop-blur-xl">
        <label htmlFor="food-profile" className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-orange-300" /> Whose foods are we saving?</label>
        <select id="food-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)} disabled={profilesLoading} className="mt-3 min-h-12 w-full rounded-xl border border-white/15 bg-black/60 px-3 text-base text-white outline-none transition-colors focus:border-orange-400 disabled:opacity-50"><option value="">My foods</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select>
      </section>}
      <section className="mt-10 rounded-[2rem] border border-white/15 bg-black/50 p-4 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-orange-300" /><h2 className="text-xl font-bold tracking-tight text-white">Find your favorites</h2></div><p className="mt-1 text-sm text-white/50">Tap anything you enjoy. You can change this anytime.</p></div><span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1 text-sm font-semibold text-orange-200">{items.length} selected</span></div>
        <div className="mt-6 space-y-3">{Object.entries(GROUP_LABELS).map(([category, label]) => { const foods = FOODS_I_ENJOY_CATALOG.filter((entry) => entry.category === category); const open = openGroup === category; return <div key={category} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 transition-colors hover:border-orange-300/30"><button type="button" onClick={() => setOpenGroup(open ? "" : category)} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between px-4 text-left text-base font-medium text-white/90 transition-colors hover:bg-white/5">{label}{open ? <ChevronUp className="h-4 w-4 text-orange-300" /> : <ChevronDown className="h-4 w-4 text-white/45" />}</button>{open && <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3 sm:grid-cols-3 lg:grid-cols-4">{foods.map((food) => { const selected = items.some((item) => item.conceptId === food.conceptId); return <button key={food.conceptId} type="button" aria-pressed={selected} onClick={() => selected ? remove(items.find((item) => item.conceptId === food.conceptId)!.id) : addCatalog(food)} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm transition-all hover:-translate-y-0.5 ${selected ? "border-orange-300/70 bg-orange-400/20 font-semibold text-orange-100 shadow-lg shadow-orange-950/30" : "border-white/10 bg-black/30 text-white/65 hover:border-white/30 hover:bg-white/10"}`}>{selected && <Check className="mr-1 inline h-4 w-4 text-orange-300" />}{food.label}</button>; })}</div>}</div>; })}</div>
        <div className="mt-6 rounded-2xl border border-dashed border-orange-300/35 bg-orange-400/10 p-4 sm:p-5"><label htmlFor="custom-food" className="font-semibold text-orange-100">Don&apos;t see it? Add anything you enjoy.</label><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="custom-food" value={customFood} onChange={(event) => setCustomFood(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustom(); }} placeholder="A family recipe, a favorite takeout order…" className="min-h-12 flex-1 rounded-xl border border-white/15 bg-black/60 px-3 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-orange-400" /><button type="button" onClick={addCustom} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 font-bold text-white transition-all hover:bg-orange-400 hover:-translate-y-0.5"><Plus className="h-4 w-4" /> Add</button></div></div>
      </section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl"><button type="button" onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen} className="flex w-full items-center justify-between text-left font-semibold text-white/90">Why this matters {whyOpen ? <ChevronUp className="h-4 w-4 text-orange-300" /> : <ChevronDown className="h-4 w-4 text-white/45" />}</button>{whyOpen && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">Your preferences give My Perfect Meals a better starting point when it suggests meals and grocery ideas. This is your space — it is not a test, and there is no score or minimum to reach.</p>}</section>
      <section aria-labelledby="selected-heading" className="mt-8"><h2 id="selected-heading" className="text-2xl font-bold tracking-tight text-white">Your list</h2>{loading ? <div className="mt-4 h-24 animate-pulse rounded-2xl border border-white/10 bg-white/10" aria-label="Loading foods" /> : error && !document ? <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-950/50 p-5 text-sm text-red-100"><div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0 text-red-300" /><div><p>{error}</p><button type="button" onClick={load} className="mt-3 font-semibold text-orange-200 underline">Try again</button></div></div></div> : items.length === 0 ? <p className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-5 text-sm text-white/50">Nothing selected yet. Start with one food that sounds good.</p> : <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <button type="button" key={item.id} onClick={() => remove(item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-300/35 bg-black/45 px-4 text-sm font-medium text-orange-100 transition-colors hover:border-red-300/60 hover:bg-red-950/40">{item.displayLabel}<Trash2 className="h-4 w-4 text-orange-300" /><span className="sr-only">Remove {item.displayLabel}</span></button>)}</div>}</section>
      {(notice || (error && document)) && <p role="status" className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${notice ? "border-emerald-300/25 bg-emerald-950/45 text-emerald-200" : "border-red-300/25 bg-red-950/45 text-red-200"}`}>{notice || error}</p>}
      <div className="mt-8 flex justify-end"><button type="button" onClick={save} disabled={saving || loading || !document} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-6 font-black text-black shadow-xl shadow-orange-950/40 transition-all hover:-translate-y-0.5 hover:from-orange-400 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save my foods"}</button></div>
    </div>
  </main>;
}