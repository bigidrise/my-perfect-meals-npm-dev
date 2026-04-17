import { useLocation } from "wouter";
import { ArrowLeft, Database, Target, ChefHat, Activity, Pill } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const BLOCKS = [
  {
    step: "1",
    title: "Your Inputs",
    description: "The raw data that drives your plan.",
    color: "from-teal-500/20 to-teal-500/5",
    border: "border-teal-500/25",
    accent: "text-teal-400",
    icon: Database,
    items: [
      { label: "Glucose readings", detail: "Logged before and after meals to track your trends." },
      { label: "Preferences", detail: "Foods you like, avoid, or are allergic to." },
      { label: "Guardrails", detail: "Your carb limits, calorie targets, and clinical constraints." },
      { label: "GLP-1 cycle", detail: "Injection timing and phase — if you're on a GLP-1 medication." },
    ],
  },
  {
    step: "2",
    title: "Your Strategy",
    description: "How the system translates your inputs into rules.",
    color: "from-orange-500/20 to-orange-500/5",
    border: "border-orange-500/25",
    accent: "text-orange-400",
    icon: Target,
    items: [
      { label: "Carb limits", detail: "Per-meal and daily ceilings that keep your blood sugar stable." },
      { label: "Meal frequency", detail: "How many meals per day best supports your protocol." },
      { label: "Glucose patterns", detail: "Trend analysis that flags elevated or unstable readings." },
      { label: "Portion control", detail: "Volume limits during active GLP-1 phases." },
    ],
  },
  {
    step: "3",
    title: "Your Meals",
    description: "How every meal you generate reflects your strategy.",
    color: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/25",
    accent: "text-purple-400",
    icon: ChefHat,
    items: [
      { label: "Builder guardrails", detail: "Every meal builder checks your strategy before generating." },
      { label: "Safe ingredients", detail: "High-spike ingredients are blocked when your hub is active." },
      { label: "Macro alignment", detail: "Protein, fat, and carb ratios match your clinical targets." },
      { label: "Real-time adaptation", detail: "Meals update when your glucose trends or cycle changes." },
    ],
  },
];

const HUBS = [
  {
    icon: Activity,
    name: "Diabetic Hub",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    description: "Controls carb limits, glucose ranges, and meal decisions based on your diabetes type and targets.",
  },
  {
    icon: Pill,
    name: "GLP-1 Hub",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    description: "Adjusts portion size, protein focus, and meal volume around your GLP-1 injection cycle.",
  },
];

export default function AppLibrary() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/more")}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white">How It Works</h1>
              <p className="text-[11px] text-white/40 leading-none">Your nutrition strategy, explained</p>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-2xl mx-auto px-4 space-y-8 pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Intro */}
        <div className="text-center space-y-1.5">
          <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
            Every meal this app generates is driven by a three-layer system — your inputs, a smart strategy layer, and the builders that put it all together.
          </p>
        </div>

        {/* How Your Plan Works — 3 blocks */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1">How Your Plan Works</p>
          <div className="space-y-3">
            {BLOCKS.map(block => {
              const Icon = block.icon;
              return (
                <div
                  key={block.step}
                  className={`rounded-xl border ${block.border} bg-gradient-to-br ${block.color} p-4`}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${block.accent} bg-black/30`}>
                      {block.step}
                    </div>
                    <Icon className={`w-4 h-4 ${block.accent}`} />
                    <div>
                      <p className={`text-sm font-bold ${block.accent}`}>{block.title}</p>
                      <p className="text-[11px] text-white/40">{block.description}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {block.items.map(item => (
                      <div key={item.label} className="flex items-start gap-2">
                        <span className={`text-[10px] font-semibold mt-0.5 shrink-0 ${block.accent}`}>→</span>
                        <div>
                          <span className="text-xs font-semibold text-white/75">{item.label}</span>
                          <span className="text-xs text-white/40"> — {item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Hubs */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1">Clinical Hubs</p>
          <p className="text-xs text-white/40 px-1 leading-relaxed">
            Hubs are optional protocol layers you activate for a specific health goal. When a hub is active, it overrides default settings and enforces clinical-grade guardrails across every builder.
          </p>
          <div className="space-y-2.5 pt-1">
            {HUBS.map(hub => {
              const Icon = hub.icon;
              return (
                <div key={hub.name} className={`rounded-xl border ${hub.bg} px-4 py-3 flex items-start gap-3`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${hub.color}`} />
                  <div>
                    <p className={`text-sm font-semibold ${hub.color}`}>{hub.name}</p>
                    <p className="text-xs text-white/50 leading-relaxed mt-0.5">{hub.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom note */}
        <div className="rounded-xl bg-white/3 border border-white/8 px-4 py-3 text-center">
          <p className="text-xs text-white/35 leading-relaxed">
            Your strategy updates automatically as you log more data.
            The more consistent you are, the smarter your meals become.
          </p>
        </div>
      </div>
    </div>
  );
}
