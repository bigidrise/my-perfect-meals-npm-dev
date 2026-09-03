export function OptionCMobile() {
  const protocols = [
    { id: "hashimotos", label: "Hashimoto's Support", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labStatus: "TSH + TPO Elevated", labColor: "text-amber-400", lagging: true },
    { id: "oncology", label: "Oncology Support", category: "Organ Support", assignedBy: "Dr. Sarah Kim", labStatus: "Prealbumin Monitoring", labColor: "text-blue-400", lagging: false },
    { id: "menopause", label: "Menopause Support", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labStatus: "FSH Not Tracked", labColor: "text-white/40", lagging: false },
    { id: "metabolic", label: "Metabolic Recovery", category: "Metabolic", assignedBy: "Dr. James Park", labStatus: "Fasting Insulin Elevated", labColor: "text-amber-400", lagging: true },
    { id: "hormone", label: "Hormone Optimization", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labStatus: "Testosterone Not Tracked", labColor: "text-white/40", lagging: false },
  ];

  const activeProtocol = protocols[0];
  const meals = [
    { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal" },
    { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal" },
    { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MB</div>
        <span className="text-white font-semibold text-sm">Weekly Meal Builder</span>
      </div>

      {/* Clinical Protocol Card */}
      <div className="mx-3 mt-3 rounded-2xl overflow-hidden border border-orange-500/30 shadow-[0_0_24px_rgba(234,88,12,0.15)]">
        <div className="bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-orange-600/10 px-4 py-3 border-b border-orange-500/20">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-orange-300/80">Active Protocol</span>
          </div>
          <h2 className="text-white font-bold text-lg mt-0.5 leading-tight">{activeProtocol.label}</h2>
        </div>
        <div className="bg-black/40 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-white/30 text-[8px] uppercase tracking-widest mb-0.5">Category</p>
              <p className="text-white/80 text-[11px] font-medium leading-tight">{activeProtocol.category}</p>
            </div>
            <div>
              <p className="text-white/30 text-[8px] uppercase tracking-widest mb-0.5">Assigned By</p>
              <p className="text-white/80 text-[11px] font-medium leading-tight">{activeProtocol.assignedBy}</p>
            </div>
            <div>
              <p className="text-white/30 text-[8px] uppercase tracking-widest mb-0.5">Lab Signal</p>
              <p className={`text-[11px] font-semibold leading-tight ${activeProtocol.labColor}`}>{activeProtocol.labStatus}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/8 flex items-center justify-between">
            <span className="text-white/30 text-[9px]">Version 1.0 · Activated Jun 2</span>
            <button className="text-orange-400 text-[10px] font-semibold">Change →</button>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 py-2.5 gap-2 mt-1">
        <button className="flex-1 py-2 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">
          Duplicate Day
        </button>
        <button className="flex-1 py-2 rounded-full bg-orange-600 text-white text-xs font-semibold">
          Save Plan
        </button>
      </div>

      {/* Meal cards */}
      <div className="flex-1 px-3 space-y-2 pb-4 overflow-y-auto">
        {meals.map((card) => (
          <div key={card.meal} className="rounded-xl bg-black/30 border border-white/10 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400/80 block mb-1">{card.meal}</span>
                <p className="text-white text-sm font-semibold leading-tight">{card.name}</p>
                <p className="text-white/50 text-[11px] mt-1">{card.macros}</p>
              </div>
              <span className="text-white/40 text-[11px] flex-shrink-0">{card.kcal}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
