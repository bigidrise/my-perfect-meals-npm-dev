export function OptionCDesktop() {
  const activeProtocol = {
    label: "Hashimoto's Support",
    category: "Hormonal & Autoimmune",
    assignedBy: "Self Selected",
    labStatus: "TSH + TPO Antibodies Elevated",
    labColor: "text-amber-400",
    activated: "Jun 2, 2026",
    version: "v1.0",
    guardrails: ["Selenium priority (Brazil nuts, salmon)", "Soy isolates excluded", "Gluten minimized", "Omega-3 priority"],
  };

  const otherProtocols = [
    { label: "Thyroid Support", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labColor: "text-white/40", labStatus: "TSH Monitoring" },
    { label: "Menopause Support", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labColor: "text-white/30", labStatus: "Self Reported" },
    { label: "Hormone Optimization", category: "Hormonal & Autoimmune", assignedBy: "Self Selected", labColor: "text-white/30", labStatus: "Testosterone Not Tracked" },
    { label: "Metabolic Recovery", category: "Metabolic", assignedBy: "Dr. James Park", labColor: "text-amber-400", labStatus: "Fasting Insulin Elevated" },
    { label: "Oncology Support", category: "Organ Support", assignedBy: "Dr. Sarah Kim", labColor: "text-blue-400", labStatus: "Prealbumin Monitoring" },
  ];

  const meals = [
    { meal: "Breakfast", name: "Lemon Herb Salmon Bowl", macros: "P 42g · C 28g · F 18g", kcal: "440 kcal", badge: "Anti-inflammatory" },
    { meal: "Lunch", name: "Roasted Root Veggie Plate", macros: "P 18g · C 52g · F 14g", kcal: "390 kcal", badge: "Gluten-free" },
    { meal: "Dinner", name: "Turkey Zucchini Skillet", macros: "P 38g · C 22g · F 16g", kcal: "380 kcal", badge: "Thyroid-safe" },
    { meal: "Snack", name: "Brazil Nut Selenium Mix", macros: "P 6g · C 8g · F 14g", kcal: "170 kcal", badge: "Selenium boost" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] flex font-sans">
      {/* Left Panel */}
      <div className="w-80 flex-shrink-0 bg-black/40 border-r border-white/10 flex flex-col overflow-y-auto">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white">MP</div>
          <span className="text-white font-bold text-sm">My Perfect Meals</span>
        </div>

        {/* Active Clinical Protocol Card */}
        <div className="m-4 rounded-2xl overflow-hidden border border-orange-500/40 shadow-[0_0_20px_rgba(234,88,12,0.2)]">
          <div className="bg-gradient-to-r from-orange-600/35 via-orange-500/20 to-transparent px-4 py-3.5 border-b border-orange-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-orange-300/80">Active Protocol</span>
            </div>
            <h2 className="text-white font-bold text-xl leading-tight">{activeProtocol.label}</h2>
          </div>
          <div className="bg-black/50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-white/30 text-[8px] uppercase tracking-widest mb-1">Category</p>
                <p className="text-white/80 text-xs font-medium">{activeProtocol.category}</p>
              </div>
              <div>
                <p className="text-white/30 text-[8px] uppercase tracking-widest mb-1">Assigned By</p>
                <p className="text-white/80 text-xs font-medium">{activeProtocol.assignedBy}</p>
              </div>
              <div>
                <p className="text-white/30 text-[8px] uppercase tracking-widest mb-1">Lab Status</p>
                <p className={`text-xs font-semibold ${activeProtocol.labColor}`}>{activeProtocol.labStatus}</p>
              </div>
              <div>
                <p className="text-white/30 text-[8px] uppercase tracking-widest mb-1">Activated</p>
                <p className="text-white/80 text-xs font-medium">{activeProtocol.activated}</p>
              </div>
            </div>
            <div>
              <p className="text-white/30 text-[8px] uppercase tracking-widest mb-2">Active Guardrails</p>
              <div className="space-y-1">
                {activeProtocol.guardrails.map(g => (
                  <div key={g} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                    <p className="text-white/60 text-[10px]">{g}</p>
                  </div>
                ))}
              </div>
            </div>
            <button className="w-full py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
              Change Protocol
            </button>
          </div>
        </div>

        {/* Other protocols available */}
        <div className="px-4 pb-4">
          <p className="text-white/25 text-[8px] uppercase tracking-widest mb-2">Other Available Protocols</p>
          <div className="space-y-1.5">
            {otherProtocols.map(p => (
              <div key={p.label} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/5 border border-white/8">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-white/60 text-[10px] font-semibold truncate">{p.label}</p>
                  <p className="text-white/25 text-[9px]">{p.category}</p>
                </div>
                <span className={`text-[9px] font-semibold flex-shrink-0 ${p.labColor}`}>{p.assignedBy === "Self Selected" ? "Self" : "MD"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-black/20 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-base">Weekly Meal Builder</h1>
            <p className="text-white/40 text-xs">Monday — June 2, 2026</p>
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

        {/* Meal grid */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 max-w-2xl">
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
    </div>
  );
}
