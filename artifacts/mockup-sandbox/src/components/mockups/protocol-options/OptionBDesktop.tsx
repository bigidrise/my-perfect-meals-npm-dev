export function OptionBDesktop() {
  const categoryGroups = [
    {
      label: "HORMONAL",
      protocols: [
        { id: "thyroid", name: "Thyroid Support", active: false },
        { id: "hashimotos", name: "Hashimoto's Support", active: true },
        { id: "menopause", name: "Menopause Support", active: false },
        { id: "perimenopause", name: "Perimenopause Support", active: false },
        { id: "hormone", name: "Hormone Optimization", active: false },
      ],
    },
    {
      label: "METABOLIC",
      protocols: [
        { id: "diabetic", name: "Diabetic Support", active: false },
        { id: "glp1", name: "GLP-1 Support", active: false },
        { id: "metabolic", name: "Metabolic Recovery", active: false },
      ],
    },
    {
      label: "ORGAN SUPPORT",
      protocols: [
        { id: "cardiac", name: "Cardiac Support", active: false },
        { id: "renal", name: "Kidney Support", active: false },
        { id: "oncology", name: "Oncology Support", active: false },
      ],
    },
    {
      label: "INFLAMMATORY",
      protocols: [
        { id: "antiinflammatory", name: "Anti-Inflammatory", active: false },
      ],
    },
  ];

  const meals = [
    { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal", badge: "Anti-inflammatory" },
    { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal", badge: "Gluten-free" },
    { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal", badge: "Thyroid-safe" },
    { meal: "Snack", name: "Brazil Nut Selenium Mix", macros: "P 6g · C 8g · F 14g", kcal: "170 kcal", badge: "Selenium boost" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-black/40 border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MP</div>
          <span className="text-white font-bold text-sm">Weekly Meal Builder</span>
        </div>
        <div className="flex items-center gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
            <button key={day} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${i === 0 ? "bg-orange-600 text-white" : "bg-white/10 text-white/60"}`}>
              {day}
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold">Duplicate</button>
          <button className="px-3 py-1 rounded-full bg-orange-600 text-white text-xs font-semibold">Save Plan</button>
        </div>
      </div>

      {/* Protocol chips area — categorized */}
      <div className="bg-black/25 border-b border-white/8 px-6 py-3">
        <div className="flex items-start gap-8 overflow-x-auto scrollbar-none">
          {categoryGroups.map(group => (
            <div key={group.label} className="flex-shrink-0">
              <p className="text-white/30 text-[8px] uppercase tracking-widest mb-1.5">{group.label}</p>
              <div className="flex items-center gap-1.5">
                {group.protocols.map(p => (
                  <button
                    key={p.id}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                      p.active
                        ? "bg-orange-600 text-white border-orange-500 shadow-[0_0_12px_rgba(234,88,12,0.4)]"
                        : "bg-white/8 text-white/60 border-white/15 hover:bg-white/12"
                    }`}
                  >
                    {p.name}
                    {p.active && <span className="ml-1 text-orange-200">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meal grid */}
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          {meals.map((card) => (
            <div key={card.meal} className="rounded-xl bg-black/30 border border-white/10 p-4">
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
      </div>
    </div>
  );
}
