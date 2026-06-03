import { useState } from "react";

const conditions = [
  { id: "thyroid", label: "🦋 Thyroid Support", active: true },
  { id: "hormone-optimization", label: "⚡ Hormone Optimization", active: true },
  { id: "glp-1", label: "💉 GLP-1 / Ozempic", active: false },
  { id: "anti-inflammatory", label: "🌿 Anti-Inflammatory", active: false },
  { id: "heart-health", label: "❤️ Heart Health", active: false },
  { id: "renal", label: "🫘 Kidney Support", active: false },
];

const priorityNutrients = [
  { name: "Healthy Fats", desc: "avocado · salmon · walnuts", icon: "🥑" },
  { name: "Zinc", desc: "oysters · pumpkin seeds · lean beef", icon: "⚗️" },
  { name: "Vitamin D", desc: "salmon · eggs · Brazil nuts", icon: "☀️" },
  { name: "Magnesium", desc: "dark leafy greens · almonds", icon: "🥬" },
  { name: "Complex Carbs", desc: "sweet potato · oats · quinoa", icon: "🍠" },
  { name: "Protein", desc: "min 25g/meal · lean meats · legumes", icon: "🥩" },
];

export default function HormoneOptimization() {
  const [active, setActive] = useState(conditions.map((c) => c.id));
  const toggle = (id: string) => {
    setActive((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  };

  const hormoneActive = active.includes("hormone-optimization");

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 50%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚡</span>
            <div>
              <p className="text-white font-semibold text-sm">Protocol Settings</p>
              <p className="text-white/40 text-xs">Active conditions shaping your meals</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {conditions.map((c) => {
              const on = active.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    on ? "bg-orange-600 text-white shadow-lg" : "bg-white/10 text-white/50"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {hormoneActive && (
            <>
              <div className="rounded-xl border border-orange-400/50 bg-orange-900/20 p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <div>
                    <p className="text-orange-300 text-sm font-bold">Hormone Optimization</p>
                    <p className="text-white/50 text-xs">Protocol active · modifying all meal generation</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {priorityNutrients.map((n) => (
                    <div key={n.name} className="bg-black/30 rounded-lg p-1.5 flex items-start gap-1.5">
                      <span className="text-xs">{n.icon}</span>
                      <div>
                        <p className="text-white/80 text-xs font-semibold leading-tight">{n.name}</p>
                        <p className="text-white/30 text-xs leading-tight">{n.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-900/10 p-3 mb-3">
                <p className="text-red-400 text-xs font-semibold mb-1">🚫 Hard Blocks</p>
                <div className="flex flex-wrap gap-1">
                  {["Refined sugar", "Seed oils", "Processed meats", "Trans fats", "Alcohol"].map((b) => (
                    <span key={b} className="px-2 py-0.5 bg-red-900/30 text-red-300 text-xs rounded-full">{b}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="text-white/30 text-xs text-center">
            {active.length} protocol{active.length !== 1 ? "s" : ""} active · meals automatically adjusted
          </p>
        </div>
      </div>
    </div>
  );
}
