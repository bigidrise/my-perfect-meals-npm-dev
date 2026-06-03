const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const meals: Record<string, { name: string; protein: number; cal: number }[]> = {
  Mon: [
    { name: "Salmon Quinoa Bowl", protein: 38, cal: 520 },
    { name: "Turkey & Avocado Wrap", protein: 32, cal: 480 },
    { name: "Lentil Sweet Potato Stew", protein: 22, cal: 410 },
  ],
  Tue: [
    { name: "Egg & Veggie Scramble", protein: 28, cal: 380 },
    { name: "Grilled Chicken Salad", protein: 40, cal: 450 },
    { name: "Hormone Boost Bowl", protein: 34, cal: 490 },
  ],
};

const protocols = [
  { label: "🦋 Thyroid · Hypothyroid", color: "bg-orange-600" },
  { label: "⚡ Hormone Optimization", color: "bg-orange-500" },
];

export default function WeeklyProtocolBar() {
  const today = "Mon";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-3">
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.95) 0%, #c2410c 60%, rgba(0,0,0,0.95) 100%)" }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-white font-bold text-sm">Weekly Meal Board</p>
              <p className="text-white/40 text-xs">Week of June 3, 2026</p>
            </div>
            <span className="text-lg">📅</span>
          </div>

          <div className="rounded-xl border border-orange-500/40 bg-orange-900/20 p-2.5 mb-3">
            <p className="text-orange-400 text-xs font-semibold mb-1.5 flex items-center gap-1">
              <span>⚕️</span> Active Protocols
            </p>
            <div className="flex flex-wrap gap-1.5">
              {protocols.map((p) => (
                <span
                  key={p.label}
                  className={`${p.color} text-white text-xs px-2.5 py-1 rounded-full font-medium`}
                >
                  {p.label}
                </span>
              ))}
              <span className="bg-white/10 text-white/60 text-xs px-2.5 py-1 rounded-full font-medium">
                🔒 No seed oils · No alcohol
              </span>
            </div>
          </div>

          <div className="flex gap-1 mb-3 overflow-x-auto">
            {days.map((d) => (
              <button
                key={d}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  d === today
                    ? "bg-orange-600 text-white"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {(meals[today] || meals["Tue"]).map((meal, i) => (
              <div key={i} className="rounded-xl bg-black/30 border border-white/10 p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-white text-xs font-semibold">{meal.name}</p>
                  <p className="text-white/40 text-xs">{meal.protein}g protein · {meal.cal} cal</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-orange-500 text-xs">⚡</span>
                  <span className="text-white/30 text-xs">H-OPT</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/30 text-xs text-center mt-3">
            All meals built to protocol · hormone-supportive · nutrient-dense
          </p>
        </div>
      </div>
    </div>
  );
}
