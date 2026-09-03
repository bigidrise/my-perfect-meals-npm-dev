import { useState } from "react";

const thyroidSubtypes = [
  { id: "hypothyroid", label: "Hypothyroid" },
  { id: "hyperthyroid", label: "Hyperthyroid" },
  { id: "hashimotos", label: "Hashimoto's" },
];

const specialtyOptions = [
  { id: "thyroid", label: "🦋 Thyroid Support" },
  { id: "hormone-optimization", label: "⚡ Hormone Optimization" },
  { id: "anti-inflammatory", label: "🌿 Anti-Inflammatory" },
  { id: "glp-1", label: "💉 GLP-1 / Ozempic" },
  { id: "heart-health", label: "❤️ Heart Health" },
];

export default function ProfileThyroid() {
  const [thyroid, setThyroid] = useState("hypothyroid");
  const [specialty, setSpecialty] = useState(["thyroid", "hormone-optimization"]);
  const [saved, setSaved] = useState(false);

  const toggleSpecialty = (id: string) => {
    setSpecialty((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 50%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold">JD</div>
            <div>
              <p className="text-white text-sm font-semibold">Edit Profile</p>
              <p className="text-white/40 text-xs">Clinical &amp; Dietary Settings</p>
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-3">
            <p className="text-orange-400 text-xs font-semibold mb-2 uppercase tracking-wide">Specialty Conditions</p>
            <div className="flex flex-wrap gap-2">
              {specialtyOptions.map((o) => {
                const active = specialty.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleSpecialty(o.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      active
                        ? "bg-orange-600 text-white"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {specialty.includes("thyroid") && (
            <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-3">
              <p className="text-orange-400 text-xs font-semibold mb-2 flex items-center gap-1">
                🦋 Thyroid Subtype
              </p>
              <div className="flex gap-2 flex-wrap">
                {thyroidSubtypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThyroid(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      thyroid === t.id
                        ? "bg-orange-600 text-white shadow-lg"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-2">
                {thyroid === "hypothyroid" && "Selenium · iodine · low-goitrogenic · metabolic support"}
                {thyroid === "hyperthyroid" && "Calcium · anti-inflammatory · limited goitrogens"}
                {thyroid === "hashimotos" && "Gluten-aware · selenium-rich · anti-inflammatory"}
              </p>
            </div>
          )}

          {specialty.includes("hormone-optimization") && (
            <div className="rounded-xl border border-orange-400/40 bg-orange-900/20 p-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-base">⚡</span>
                <div>
                  <p className="text-orange-300 text-xs font-semibold">Hormone Optimization Active</p>
                  <p className="text-white/50 text-xs">Zinc · vitamin D · healthy fats · no seed oils</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setSaved(true)}
            className={`w-full py-2.5 rounded-full text-sm font-bold transition-all ${
              saved ? "bg-green-600 text-white" : "bg-orange-600 text-white"
            }`}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
