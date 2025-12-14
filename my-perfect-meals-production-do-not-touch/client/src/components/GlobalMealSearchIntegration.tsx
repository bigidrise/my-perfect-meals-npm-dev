// GlobalMealSearchIntegration.tsx
// Route search clicks to /meals/:type?mealId=...&template=... using the hubs you have.
// Works with either backend search (preferred) or local fallback index.

// Global meal search with routing integration
import type { PresetMeal } from "@/features/meals/MealHubFactory";
import { breakfastMeals } from "@/data/breakfastMealsData";
import { lunchMealsData } from "@/data/lunchMealsData";
import { dinnerMealsData } from "@/data/dinnerMealsData";
import { snacksMealsData } from "@/data/snacksMealsData";

// 1) Utility — always send users to the section first
export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
export function openMealByType(type: MealType, mealId?: string, templateSlug?: string) {
  const q = new URLSearchParams();
  if (mealId) q.set("mealId", mealId);
  if (templateSlug) q.set("template", templateSlug);
  window.location.href = `/meals/${type}?${q.toString()}`;
}

// 2) Build a local index (fallback; handy for client-side filtering or to infer type)
const bundles: Record<MealType, PresetMeal[]> = {
  breakfast: breakfastMeals,
  lunch: lunchMealsData,
  dinner: dinnerMealsData,
  snacks: snacksMealsData
};

export const mealTypeById: Record<string, MealType> = {};
export const templateSlugDefaultById: Record<string, string> = {};
export const mealDisplayNameById: Record<string, string> = {};

for (const [type, meals] of Object.entries(bundles) as [MealType, PresetMeal[]][]) {
  for (const m of meals) {
    mealTypeById[m.id] = type;
    mealDisplayNameById[m.id] = m.name;
    templateSlugDefaultById[m.id] = Object.values(m.templates)[0]?.slug || "classic";
  }
}

// 3) Click handler that works with results from your backend OR local index
export type SearchResult = {
  id: string;               // meal id (matches our datasets)
  name?: string;            // optional display name from backend
  type?: MealType;          // if backend returns the type, we use it; else we infer
  templateSlug?: string;    // optional template suggestion
};

export function onSearchResultClick(r: SearchResult) {
  const type = r.type || mealTypeById[r.id];
  if (!type) return; // unknown id; optionally show a toast
  const tpl = r.templateSlug || templateSlugDefaultById[r.id];
  openMealByType(type, r.id, tpl);
}

// 4) Optional: lightweight client-side search (good for dev/testing)
export function localSearchMeals(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const [type, meals] of Object.entries(bundles) as [MealType, PresetMeal[]][]) {
    for (const m of meals) {
      if (m.name.toLowerCase().includes(q) || m.slug.includes(q)) {
        results.push({ id: m.id, name: m.name, type, templateSlug: Object.values(m.templates)[0]?.slug });
      }
      for (const [key, t] of Object.entries(m.templates)) {
        const alias = `${m.name} ${t.name}`.toLowerCase();
        if (alias.includes(q)) {
          results.push({ id: m.id, name: `${m.name} — ${t.name}`, type, templateSlug: t.slug });
        }
      }
    }
  }
  // Deduplicate by id+templateSlug
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.id}::${r.templateSlug || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

// 5) Example Search UI snippet — plug into your header or a page
// Replace the fetch with your real /api/search endpoint if available.
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GlobalMealSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      // Preferred: const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
      // const data: SearchResult[] = await res.json();
      // setResults(data);
      // Fallback: local search
      setResults(localSearchMeals(q));
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search meals (e.g., 'chicken', 'oats', 'burrito')"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="bg-black/30 text-white border-white/20"
      />
      <div className="space-y-2">
        {results.map((r) => (
          <Card key={`${r.id}::${r.templateSlug || "default"}`} className="flex items-center justify-between p-3 border-white/10 bg-white/5">
            <div className="text-white/90">
              <div className="text-sm font-medium">{r.name || mealDisplayNameById[r.id] || r.id}</div>
              <div className="text-xs text-white/60">{r.type || mealTypeById[r.id]} • {r.templateSlug || templateSlugDefaultById[r.id]}</div>
            </div>
            <Button onClick={() => onSearchResultClick(r)}>Open</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Usage examples:
// 1) Place <GlobalMealSearch /> in your header or a /search route.
// 2) From anywhere you have a meal object, do: onSearchResultClick({ id: meal.id, type: "lunch" })
//    This will redirect to /meals/lunch with that meal preselected in the hub.