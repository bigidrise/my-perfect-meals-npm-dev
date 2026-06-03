import { useState } from "react";

export default function ClinicalLabsTestosterone() {
  const [totalT, setTotalT] = useState("450");
  const [freeT, setFreeT] = useState("12.4");
  const [tsh, setTsh] = useState("2.8");
  const [t3, setT3] = useState("3.1");
  const [saved, setSaved] = useState(false);

  const totalTStatus = () => {
    const v = parseFloat(totalT);
    if (!v) return null;
    if (v < 300) return { label: "Low", color: "text-red-400" };
    if (v > 1000) return { label: "High", color: "text-yellow-400" };
    return { label: "Normal", color: "text-green-400" };
  };

  const freeTStatus = () => {
    const v = parseFloat(freeT);
    if (!v) return null;
    if (v < 9) return { label: "Low", color: "text-red-400" };
    if (v > 30) return { label: "High", color: "text-yellow-400" };
    return { label: "Normal", color: "text-green-400" };
  };

  const ts = totalTStatus();
  const fs = freeTStatus();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 50%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧪</span>
            <div>
              <p className="text-white font-semibold text-sm">Clinical Labs</p>
              <p className="text-white/40 text-xs">Biometrics &amp; Lab Values</p>
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-3">
            <p className="text-orange-400 text-xs font-semibold mb-3 uppercase tracking-wide">🦋 Thyroid Panel</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/50 text-xs block mb-1">TSH <span className="text-white/30">(mIU/L)</span></label>
                <input
                  type="number"
                  value={tsh}
                  onChange={(e) => setTsh(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                  placeholder="e.g. 2.5"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs block mb-1">Free T3 <span className="text-white/30">(pg/mL)</span></label>
                <input
                  type="number"
                  value={t3}
                  onChange={(e) => setT3(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                  placeholder="e.g. 3.1"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-orange-500/30 p-3 mb-4">
            <p className="text-orange-400 text-xs font-semibold mb-3 uppercase tracking-wide">⚡ Hormonal / Testosterone</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-white/50 text-xs">Total Testosterone <span className="text-white/30">(ng/dL)</span></label>
                  {ts && <span className={`text-xs font-semibold ${ts.color}`}>{ts.label}</span>}
                </div>
                <input
                  type="number"
                  value={totalT}
                  onChange={(e) => { setTotalT(e.target.value); setSaved(false); }}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="e.g. 450"
                />
                <p className="text-white/30 text-xs mt-1">Reference: 300–1000 ng/dL</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-white/50 text-xs">Free Testosterone <span className="text-white/30">(pg/mL)</span></label>
                  {fs && <span className={`text-xs font-semibold ${fs.color}`}>{fs.label}</span>}
                </div>
                <input
                  type="number"
                  value={freeT}
                  onChange={(e) => { setFreeT(e.target.value); setSaved(false); }}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="e.g. 12.4"
                />
                <p className="text-white/30 text-xs mt-1">Reference: 9–30 pg/mL</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSaved(true)}
            className={`w-full py-2.5 rounded-full text-sm font-bold transition-all ${
              saved ? "bg-green-600 text-white" : "bg-orange-600 text-white"
            }`}
          >
            {saved ? "✓ Lab Values Saved" : "Save Lab Values"}
          </button>
        </div>
      </div>
    </div>
  );
}
