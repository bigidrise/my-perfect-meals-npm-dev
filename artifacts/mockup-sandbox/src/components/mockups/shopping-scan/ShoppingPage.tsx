import { useState } from "react";
import { Mic, List, ShoppingCart, Check, Scan, ChevronDown, X } from "lucide-react";

const items = [
  { id: 1, category: "Produce", name: "Baby spinach", qty: "1 bag", checked: true },
  { id: 2, category: "Produce", name: "Blueberries", qty: "1 pint", checked: false },
  { id: 3, category: "Produce", name: "Avocados", qty: "3", checked: false },
  { id: 4, category: "Protein", name: "Chicken breast", qty: "2 lbs", checked: false },
  { id: 5, category: "Protein", name: "Greek yogurt (plain)", qty: "32 oz", checked: false },
  { id: 6, category: "Dairy", name: "Eggs (large)", qty: "1 dozen", checked: true },
  { id: 7, category: "Pantry", name: "Olive oil (extra virgin)", qty: "1 bottle", checked: false },
  { id: 8, category: "Pantry", name: "Almond butter", qty: "1 jar", checked: false },
];

const grouped = items.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {} as Record<string, typeof items>);

export function ShoppingPage() {
  const [checkedIds, setCheckedIds] = useState<number[]>([1, 6]);
  const [scanPulse, setScanPulse] = useState(false);

  const toggle = (id: number) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-orange-950/60 to-black font-sans select-none overflow-y-auto pb-24">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-lg border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold">My Perfect Meals</p>
            <h1 className="text-white font-bold text-lg leading-tight">Smart Grocery List</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 rounded-full px-3 py-1 text-xs text-white/70">
              {checkedIds.length}/{items.length} done
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-sm mx-auto">

        {/* Summary card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide">This Week</p>
            <p className="text-white font-semibold text-base">{items.length} items</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 uppercase tracking-wide">Checked</p>
            <p className="text-emerald-400 font-semibold text-base">{checkedIds.length} done</p>
          </div>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-2 bg-white/8 border border-white/10 rounded-xl py-2.5 text-sm text-white/70">
            <Mic className="w-4 h-4" />
            Voice Add
          </button>
          <button className="flex items-center justify-center gap-2 bg-white/8 border border-white/10 rounded-xl py-2.5 text-sm text-white/70">
            <List className="w-4 h-4" />
            Bulk Add
          </button>
        </div>

        {/* Smart Scan button — featured */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-orange-500/20 blur-md scale-105" />
          <button
            onPointerDown={() => setScanPulse(true)}
            onPointerUp={() => setScanPulse(false)}
            className={[
              "relative w-full flex items-center gap-3 bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-4 border border-orange-400/50 transition-transform",
              scanPulse ? "scale-[0.98]" : "scale-100"
            ].join(" ")}
          >
            <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center flex-shrink-0">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-white font-bold text-sm leading-tight">Smart Scan</p>
              <p className="text-orange-100/70 text-xs mt-0.5">Analyze ingredients before you buy</p>
            </div>
            <div className="bg-white/20 rounded-lg px-2 py-0.5 text-[10px] text-white font-semibold uppercase tracking-wide">
              New
            </div>
          </button>
        </div>

        {/* Small explainer */}
        <p className="text-xs text-white/35 text-center px-2 -mt-1">
          Point your camera at any ingredient label to get a personalized alignment report.
        </p>

        {/* Grouped list */}
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{category}</p>
              <p className="text-xs text-white/30">{catItems.filter(i => checkedIds.includes(i.id)).length}/{catItems.length}</p>
            </div>
            <div className="divide-y divide-white/5">
              {catItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={[
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    checkedIds.includes(item.id)
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-white/30"
                  ].join(" ")}>
                    {checkedIds.includes(item.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={[
                    "flex-1 text-sm transition-colors",
                    checkedIds.includes(item.id) ? "text-white/30 line-through" : "text-white/80"
                  ].join(" ")}>
                    {item.name}
                  </span>
                  <span className="text-xs text-white/30">{item.qty}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
