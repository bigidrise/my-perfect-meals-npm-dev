import { useState } from "react";

const client = {
  name: "Sarah Mitchell",
  avatar: "SM",
  conditions: ["thyroid", "hormone-optimization"],
  thyroidType: "hashimotos",
  labs: { totalTestosterone: 32, freeTestosterone: 0.8, tsh: 4.2 },
};

export default function ClinicalProtocolCardDemo() {
  const [hormoneOn, setHormoneOn] = useState(true);
  const [thyroidType, setThyroidType] = useState(client.thyroidType);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); }, 800);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 50%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold">
              {client.avatar}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{client.name}</p>
              <p className="text-white/40 text-xs">ProCare · Clinical Protocol</p>
            </div>
            <div className="ml-auto flex gap-1">
              <span className="bg-orange-600/30 border border-orange-500/40 text-orange-300 text-xs px-2 py-0.5 rounded-full">🦋 Thyroid</span>
              <span className="bg-orange-600/30 border border-orange-500/40 text-orange-300 text-xs px-2 py-0.5 rounded-full">⚡ Hormone</span>
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-3">
            <p className="text-orange-400 text-xs font-semibold mb-2 uppercase tracking-wide">🦋 Thyroid Protocol</p>
            <div className="flex gap-2 mb-2">
              {["hypothyroid", "hyperthyroid", "hashimotos"].map((t) => (
                <button
                  key={t}
                  onClick={() => setThyroidType(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    thyroidType === t
                      ? "bg-orange-600 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1).replace("-", "'")}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-black/20 rounded-lg p-1.5 text-center">
                <p className="text-white/40 text-xs">TSH</p>
                <p className="text-white text-sm font-bold">{client.labs.tsh}</p>
                <p className="text-yellow-400 text-xs">mIU/L</p>
              </div>
              <div className="bg-black/20 rounded-lg p-1.5 text-center">
                <p className="text-white/40 text-xs">Total T</p>
                <p className="text-white text-sm font-bold">{client.labs.totalTestosterone}</p>
                <p className="text-red-400 text-xs">Low</p>
              </div>
              <div className="bg-black/20 rounded-lg p-1.5 text-center">
                <p className="text-white/40 text-xs">Free T</p>
                <p className="text-white text-sm font-bold">{client.labs.freeTestosterone}</p>
                <p className="text-red-400 text-xs">Low</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-xs font-semibold">⚡ Hormone Optimization</p>
                <p className="text-white/40 text-xs">Modifies all AI meal generation</p>
              </div>
              <button
                onClick={() => { setHormoneOn(!hormoneOn); setSaved(false); }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hormoneOn ? "bg-orange-600" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    hormoneOn ? "translate-x-4.5" : "translate-x-1"
                  }`}
                  style={{ transform: hormoneOn ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
            {hormoneOn && (
              <div className="mt-2 flex flex-wrap gap-1">
                {["Zinc priority", "Healthy fats every meal", "No seed oils", "No alcohol", "25g+ protein/meal"].map((tag) => (
                  <span key={tag} className="bg-orange-900/30 text-orange-300 text-xs px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-black/30 border border-white/10 p-3 mb-3">
            <p className="text-white/50 text-xs font-semibold mb-1">Clinician Note</p>
            <p className="text-white/70 text-xs leading-relaxed">
              Client reports fatigue and low libido. Labs confirm low free testosterone. Hormone optimization protocol activated. Monitoring selenium and zinc intake.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2.5 rounded-full text-sm font-bold transition-all ${
              saved ? "bg-green-600 text-white" : saving ? "bg-orange-800 text-white/60" : "bg-orange-600 text-white"
            }`}
          >
            {saved ? "✓ Protocol Updated" : saving ? "Saving..." : "Update Protocol"}
          </button>
        </div>
      </div>
    </div>
  );
}
