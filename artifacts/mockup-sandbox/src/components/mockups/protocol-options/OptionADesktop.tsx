export function OptionADesktop() {
  const protocols = [
    { id: "hashimotos", name: "Hashimoto's Support", category: "Hormonal & Autoimmune", active: true },
    { id: "thyroid", name: "Thyroid Support", category: "Hormonal & Autoimmune", active: false },
    { id: "menopause", name: "Menopause Support", category: "Hormonal & Autoimmune", active: false },
    { id: "perimenopause", name: "Perimenopause Support", category: "Hormonal & Autoimmune", active: false },
    { id: "hormone", name: "Hormone Optimization", category: "Hormonal & Autoimmune", active: false },
    { id: "metabolic", name: "Metabolic Recovery", category: "Metabolic", active: false },
    { id: "glp1", name: "GLP-1 Support", category: "Metabolic", active: false },
    { id: "diabetic", name: "Diabetic Support", category: "Metabolic", active: false },
    { id: "cardiac", name: "Cardiac Support", category: "Organ Support", active: false },
    { id: "renal", name: "Kidney Support", category: "Organ Support", active: false },
    { id: "oncology", name: "Oncology Support", category: "Organ Support", active: false },
    { id: "antiinflammatory", name: "Anti-Inflammatory", category: "Inflammatory", active: false },
  ];

  const categories: Record<string, typeof protocols> = {};
  protocols.forEach(p => {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  });

  const active = protocols.find(p => p.active)!;

  const meals = [
    { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal", badge: "Anti-inflammatory", day: "Mon" },
    { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal", badge: "Gluten-free", day: "Mon" },
    { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal", badge: "Thyroid-safe", day: "Mon" },
    { meal: "Snack", name: "Brazil Nut Selenium Mix", macros: "P 6g · C 8g · F 14g", kcal: "170 kcal", badge: "Selenium boost", day: "Mon" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex font-sans">
      {/* Left Rail — Protocol Panel */}
      <div className="w-72 flex-shrink-0 bg-black/40 border-r border-white/10 flex flex-col">
        {/* App header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MP</div>
          <span className="text-white font-bold text-sm">My Perfect Meals</span>
        </div>

        {/* Active Protocol Card */}
        <div className="m-4 rounded-xl bg-gradient-to-br from-orange-600/30 via-orange-500/15 to-transparent border border-orange-500/40 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-orange-400 text-[9px] font-bold tracking-widest uppercase">✦ Active Protocol</span>
          </div>
          <p className="text-white font-bold text-lg leading-tight">{active.name}</p>
          <p className="text-orange-300/70 text-xs mt-1 mb-3">{active.category}</p>
          <div className="flex items-center gap-2 text-[10px] text-white/40 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Self Selected
          </div>
          <button className="w-full py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
            Change Protocol
          </button>
        </div>

        {/* Lab Status */}
        <div className="mx-4 mb-4 rounded-xl bg-black/30 border border-white/10 p-3">
          <p className="text-white/40 text-[9px] uppercase tracking-widest mb-2">Lab Status</p>
          <div className="space-y-1.5">
            {[
              { label: "TSH", status: "Elevated", color: "text-amber-400" },
              { label: "TPO Antibodies", status: "Elevated", color: "text-amber-400" },
              { label: "Free T3", status: "Normal", color: "text-emerald-400" },
              { label: "Free T4", status: "Normal", color: "text-emerald-400" },
            ].map(lab => (
              <div key={lab.label} className="flex items-center justify-between">
                <span className="text-white/60 text-[10px]">{lab.label}</span>
                <span className={`text-[10px] font-semibold ${lab.color}`}>{lab.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Protocol count note */}
        <div className="mx-4 mt-auto mb-4 text-[10px] text-white/30 text-center">
          12 protocols available · 1 active
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Builder header */}
        <div className="bg-black/20 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-base">Weekly Meal Builder</h1>
            <p className="text-white/40 text-xs">Monday — June 2</p>
          </div>
          <div className="flex items-center gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
              <button key={day} className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${i === 0 ? "bg-orange-600 text-white" : "bg-white/10 text-white/60"}`}>
                {day}
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">Duplicate</button>
            <button className="px-3 py-1 rounded-full bg-orange-600 text-white text-xs font-semibold">Save Plan</button>
          </div>
        </div>

        {/* Meal grid */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {meals.map((card) => (
              <div key={card.meal} className="rounded-xl bg-black/30 border border-white/10 p-4 hover:border-orange-500/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400/80">{card.meal}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">{card.badge}</span>
                </div>
                <p className="text-white font-semibold text-sm leading-tight mb-2">{card.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-white/50 text-xs">{card.macros}</p>
                  <p className="text-white/40 text-xs">{card.kcal}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Protocol guardrail note */}
          <div className="mt-3 rounded-xl bg-orange-500/8 border border-orange-500/20 px-4 py-3 flex items-start gap-2">
            <span className="text-orange-400 text-sm flex-shrink-0">✦</span>
            <p className="text-orange-300/70 text-xs leading-relaxed">
              Hashimoto's guardrails active — selenium-rich ingredients prioritized, soy isolates excluded, gluten minimized across all generated meals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
