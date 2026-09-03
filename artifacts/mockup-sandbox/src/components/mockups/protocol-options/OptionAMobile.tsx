export function OptionAMobile() {
  const protocols = [
    { id: "hashimotos", name: "Hashimoto's Support", category: "Hormonal & Autoimmune", active: true },
    { id: "thyroid", name: "Thyroid Support", category: "Hormonal & Autoimmune", active: false },
    { id: "menopause", name: "Menopause Support", category: "Hormonal & Autoimmune", active: false },
    { id: "perimenopause", name: "Perimenopause Support", category: "Hormonal & Autoimmune", active: false },
    { id: "hormone", name: "Hormone Optimization", category: "Hormonal & Autoimmune", active: false },
    { id: "metabolic", name: "Metabolic Recovery", category: "Metabolic", active: false },
    { id: "glp1", name: "GLP-1 Support", category: "Metabolic", active: false },
    { id: "cardiac", name: "Cardiac Support", category: "Organ Support", active: false },
    { id: "renal", name: "Kidney Support", category: "Organ Support", active: false },
    { id: "oncology", name: "Oncology Support", category: "Organ Support", active: false },
  ];

  const categories: Record<string, typeof protocols> = {};
  protocols.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const active = protocols.find(p => p.active)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MB</div>
        <span className="text-white font-semibold text-sm">Weekly Meal Builder</span>
      </div>

      {/* ✦ Active Protocol Status Bar */}
      <div className="mx-3 mt-3 rounded-xl bg-gradient-to-r from-orange-600/25 via-orange-500/15 to-orange-600/25 border border-orange-500/40 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-orange-400 text-[10px] font-bold tracking-widest uppercase">✦ Active Protocol</span>
            </div>
            <p className="text-white font-bold text-base leading-tight">{active.name}</p>
            <p className="text-orange-300/70 text-[11px] mt-0.5">{active.category}</p>
          </div>
          <button className="flex-shrink-0 mt-0.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-[11px] font-semibold">
            Change
          </button>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <button className="flex-1 py-2 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">
          Duplicate Day
        </button>
        <button className="flex-1 py-2 rounded-full bg-orange-600 text-white text-xs font-semibold">
          Save Plan
        </button>
      </div>

      {/* Meal cards */}
      <div className="flex-1 px-3 space-y-2 pb-4 overflow-y-auto">
        {[
          { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal", badge: "Anti-inflammatory" },
          { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal", badge: "Gluten-free" },
          { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal", badge: "Thyroid-safe" },
          { meal: "Snack", name: "Brazil Nut Selenium Mix", macros: "P 6g · C 8g · F 14g", kcal: "170 kcal", badge: "Selenium boost" },
        ].map((card) => (
          <div key={card.meal} className="rounded-xl bg-black/30 border border-white/10 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400/80">{card.meal}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">{card.badge}</span>
                </div>
                <p className="text-white text-sm font-semibold leading-tight">{card.name}</p>
                <p className="text-white/50 text-[11px] mt-1">{card.macros}</p>
              </div>
              <span className="text-white/40 text-[11px] flex-shrink-0">{card.kcal}</span>
            </div>
          </div>
        ))}

        {/* Floating protocol note */}
        <div className="mt-2 rounded-xl bg-orange-500/8 border border-orange-500/20 px-3 py-2">
          <p className="text-orange-300/70 text-[10px] leading-relaxed">
            ✦ All meals generated with Hashimoto's guardrails active — selenium-rich ingredients prioritized, soy isolates excluded.
          </p>
        </div>
      </div>
    </div>
  );
}
