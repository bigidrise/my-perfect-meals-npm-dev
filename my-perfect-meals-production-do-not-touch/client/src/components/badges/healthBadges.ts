const MAP: Record<string, { label: string; desc: string }> = {
  heart:        { label: "Heart-friendly",    desc: "Better for heart health" },
  sugar_low:    { label: "Lower sugar",       desc: "Lower in added sugar" },
  sodium_low:   { label: "Lower sodium",      desc: "Lower in sodium" },
  fiber_high:   { label: "High fiber",        desc: "High in fiber" },
  protein_high: { label: "High protein",      desc: "High in protein" },
  balanced:     { label: "Balanced",          desc: "Balanced protein, carbs, and fat" },
  allergen:     { label: "Allergen",          desc: "Contains common allergens" },
  glp1_friendly:{ label: "GLP-1 friendly",    desc: "Helps GLP-1 goals" },
};

export function normalizeBadges(keys?: string[]): {key:string,label:string,desc:string}[] {
  if (!keys?.length) return [];
  return keys
    .filter(k => k != null && k !== "")
    .map(k => {
      const canon =
        k in MAP ? k :
        k === "low_sugar" ? "sugar_low" :
        k === "low_sodium" ? "sodium_low" :
        k === "high_fiber" ? "fiber_high" :
        k === "high_protein" ? "protein_high" :
        k;
      const meta = MAP[canon] ?? { label: canon.replace(/_/g," "), desc: "" };
      return { key: canon, label: meta.label, desc: meta.desc };
    })
    .filter((v, i, a) => a.findIndex(x => x.key === v.key) === i);
}
