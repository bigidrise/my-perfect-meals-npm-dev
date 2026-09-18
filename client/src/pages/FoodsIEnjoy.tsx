import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Heart, Plus, Save, Trash2 } from "lucide-react";
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
  const [, setLocation] = useLocation();
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

  return <main className="min-h-100dvh overflow-y-auto bg-[#fbf7ef] text-[#26332e]">
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
      <button type="button" onClick={() => setLocation("/dashboard")} className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-[#52635a]"><ArrowLeft className="h-4 w-4" /> Back to dashboard</button>
      <header className="max-w-2xl"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dce9df] text-[#35604c]"><Heart className="h-6 w-6" /></div><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#64836f]">Your food profile</p><h1 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#213b31] sm:text-6xl">Tell us what you actually enjoy eating.</h1><p className="mt-5 max-w-xl text-lg leading-relaxed text-[#627068]">There is no perfect answer here. Choose the foods, dishes, and flavors that feel like you — the everyday ones and the just-for-fun ones.</p></header>
      {isHousehold && <section className="mt-8 max-w-md rounded-2xl border border-[#d9e3d9] bg-white/70 p-4"><label htmlFor="food-profile" className="block text-sm font-semibold text-[#365344]">Whose foods are we saving?</label><select id="food-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)} disabled={profilesLoading} className="mt-2 min-h-12 w-full rounded-xl border border-[#cbd9ce] bg-[#fbf7ef] px-3 text-base"><option value="">My foods</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></section>}
      <section className="mt-10 rounded-[2rem] border border-[#d9e3d9] bg-white/75 p-5 shadow-[0_12px_40px_rgba(62,91,70,0.08)] sm:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl text-[#284a39]">Find your favorites</h2><p className="mt-1 text-sm text-[#718078]">Tap anything you enjoy. You can change this anytime.</p></div><span className="rounded-full bg-[#edf4ed] px-3 py-1 text-sm font-semibold text-[#4e715c]">{items.length} selected</span></div>
        <div className="mt-6 space-y-3">{Object.entries(GROUP_LABELS).map(([category, label]) => { const foods = FOODS_I_ENJOY_CATALOG.filter((entry) => entry.category === category); const open = openGroup === category; return <div key={category} className="overflow-hidden rounded-2xl border border-[#e0e8e0] bg-[#fbfcf8]"><button type="button" onClick={() => setOpenGroup(open ? "" : category)} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between px-4 text-left font-semibold text-[#365344]">{label}{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{open && <div className="grid grid-cols-2 gap-2 border-t border-[#e0e8e0] p-3 sm:grid-cols-3 lg:grid-cols-4">{foods.map((food) => { const selected = items.some((item) => item.conceptId === food.conceptId); return <button key={food.conceptId} type="button" aria-pressed={selected} onClick={() => selected ? remove(items.find((item) => item.conceptId === food.conceptId)!.id) : addCatalog(food)} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm ${selected ? "border-[#6f9c7a] bg-[#e3f0e5] font-semibold text-[#315d43]" : "border-[#e1e8e1] bg-white text-[#57665d]"}`}>{selected && <Check className="mr-1 inline h-4 w-4" />}{food.label}</button>; })}</div>}</div>; })}</div>
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[#b6cdbb] bg-[#f2f8f1] p-4 sm:p-5"><label htmlFor="custom-food" className="font-semibold text-[#315d43]">Don&apos;t see it? Add anything you enjoy.</label><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="custom-food" value={customFood} onChange={(event) => setCustomFood(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustom(); }} placeholder="A family recipe, a favorite takeout order…" className="min-h-12 flex-1 rounded-xl border border-[#cbd9ce] bg-white px-3 text-base" /><button type="button" onClick={addCustom} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315d43] px-5 font-semibold text-white"><Plus className="h-4 w-4" /> Add</button></div></div>
      </section>
      <section className="mt-6 rounded-2xl border border-[#d9e3d9] bg-[#edf4ed] p-5"><button type="button" onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen} className="flex w-full items-center justify-between text-left font-semibold text-[#315d43]">Why this matters {whyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{whyOpen && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5e7065]">Your preferences give My Perfect Meals a better starting point when it suggests meals and grocery ideas. This is your space — it is not a test, and there is no score or minimum to reach.</p>}</section>
      <section aria-labelledby="selected-heading" className="mt-8"><h2 id="selected-heading" className="font-serif text-2xl text-[#284a39]">Your list</h2>{loading ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[#e7eee7]" aria-label="Loading foods" /> : error && !document ? <div className="mt-4 rounded-2xl border border-[#e5c9c0] bg-[#fff7f3] p-5 text-sm text-[#8c4d3d]"><p>{error}</p><button type="button" onClick={load} className="mt-3 font-semibold underline">Try again</button></div> : items.length === 0 ? <p className="mt-3 rounded-2xl bg-white/60 p-5 text-sm text-[#718078]">Nothing selected yet. Start with one food that sounds good.</p> : <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <button type="button" key={item.id} onClick={() => remove(item.id)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#b9d0bc] bg-white px-4 text-sm font-medium text-[#3e624a]">{item.displayLabel}<Trash2 className="h-4 w-4 text-[#73917b]" /><span className="sr-only">Remove {item.displayLabel}</span></button>)}</div>}</section>
      {(notice || (error && document)) && <p role="status" className={`mt-5 text-sm font-semibold ${notice ? "text-[#3d7752]" : "text-[#9b5547]"}`}>{notice || error}</p>}<div className="mt-8 flex justify-end"><button type="button" onClick={save} disabled={saving || loading || !document} className="inline-flex min-h-13 items-center gap-2 rounded-xl bg-[#d46c45] px-6 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save my foods"}</button></div>
    </div>
  </main>;
}