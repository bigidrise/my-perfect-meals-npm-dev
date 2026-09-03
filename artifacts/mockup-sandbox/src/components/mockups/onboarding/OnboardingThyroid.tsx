import { useState } from "react";

const conditions = [
  { id: "diabetes", label: "Diabetes" },
  { id: "thyroid", label: "Thyroid Support" },
  { id: "hormone-optimization", label: "⚡ Hormone Optimization" },
  { id: "anti-inflammatory", label: "Anti-Inflammatory" },
  { id: "glp-1", label: "GLP-1 / Ozempic" },
  { id: "heart-health", label: "Heart Health" },
];

const thyroidSubtypes = [
  { id: "hypothyroid", label: "Hypothyroid" },
  { id: "hyperthyroid", label: "Hyperthyroid" },
  { id: "hashimotos", label: "Hashimoto's" },
];

export default function OnboardingThyroid() {
  const [selected, setSelected] = useState(["thyroid"]);
  const [thyroid, setThyroid] = useState("hypothyroid");

  const toggle = (id: string) => {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  const showSubtypes = selected.includes("thyroid");

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 50%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🧑‍⚕️</span>
            <span className="text-orange-400 text-xs font-semibold uppercase tracking-widest">Step 3 of 6</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-1">Health Conditions</h2>
          <p className="text-white/60 text-xs mb-4">
            Select all that apply. Your meals will be built around your clinical profile.
          </p>

          <div className="w-full bg-white/10 rounded-full h-1 mb-5">
            <div className="bg-orange-500 h-1 rounded-full" style={{ width: "50%" }} />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {conditions.map((c) => {
              const active = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {showSubtypes && (
            <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-4">
              <p className="text-orange-400 text-xs font-semibold mb-2 flex items-center gap-1">
                🦋 Thyroid Type
                <span className="text-white/40 font-normal ml-1">Select your specific condition</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {thyroidSubtypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThyroid(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      thyroid === t.id
                        ? "bg-orange-600 text-white shadow-lg shadow-orange-900/40"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-2">
                {thyroid === "hypothyroid" && "Slow metabolism · iodine support · selenium · low-goitrogenic foods"}
                {thyroid === "hyperthyroid" && "Overactive thyroid · anti-inflammatory · calcium · goitrogenic foods limited"}
                {thyroid === "hashimotos" && "Autoimmune · gluten-aware · selenium-rich · anti-inflammatory focus"}
              </p>
            </div>
          )}

          <button className="w-full py-3 rounded-full bg-orange-600 text-white font-bold text-sm hover:bg-orange-500 transition-all">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
