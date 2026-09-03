export function OptionBMobile() {
  const categoryGroups = [
    {
      label: "HORMONAL",
      protocols: [
        { id: "thyroid", name: "Thyroid Support", active: false },
        { id: "hashimotos", name: "Hashimoto's", active: true },
        { id: "menopause", name: "Menopause", active: false },
        { id: "perimenopause", name: "Perimenopause", active: false },
        { id: "hormone", name: "Hormone Optim.", active: false },
      ],
    },
  ];

  const meals = [
    { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal", badge: "Anti-inflam." },
    { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal", badge: "Gluten-free" },
    { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal", badge: "Thyroid-safe" },
    { meal: "Snack", name: "Brazil Nut Mix", macros: "P 6g · C 8g · F 14g", kcal: "170 kcal", badge: "Selenium" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MB</div>
        <span className="text-white font-semibold text-sm">Weekly Meal Builder</span>
      </div>

      {/* Category chip selector */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2 px-1">HORMONAL</p>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {categoryGroups[0].protocols.map(p => (
            <button
              key={p.id}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                p.active
                  ? "bg-orange-600 text-white border-orange-500"
                  : "bg-white/8 text-white/60 border-white/15"
              }`}
            >
              {p.name}
              {p.active && <span className="ml-1">✓</span>}
            </button>
          ))}
        </div>
        <p className="text-white/20 text-[9px] px-1 mt-1.5">Tap to switch within category · tap ••• to browse all</p>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 py-2 gap-2 border-t border-white/5">
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

        {/* See other categories */}
        <button className="w-full py-2 mt-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs font-semibold">
          ••• Browse all 12 protocols
        </button>
      </div>
    </div>
  );
}
