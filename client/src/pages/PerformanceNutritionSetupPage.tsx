import { useLocation } from "wouter";
import { ArrowLeft, Dumbbell } from "lucide-react";
import PerformanceNutritionSetupForm from "@/components/performance/PerformanceNutritionSetupForm";

export default function PerformanceNutritionSetupPage() {
  const [, setLocation] = useLocation();

  // Support ?returnTo so callers (e.g. General Nutrition Training page) can
  // send the user back to the right place after setup completes.
  const returnTo = new URLSearchParams(window.location.search).get("returnTo") ?? "/performance";

  return (
    <div className="min-h-svh bg-gradient-to-b from-black via-orange-950/20 to-black flex flex-col">

      {/* Sticky top header */}
      <div
        className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-3 flex items-center gap-3 flex-shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button
          onClick={() => setLocation(returnTo)}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
            <Dumbbell className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Performance Profile</p>
            <p className="text-orange-300/70 text-xs mt-0.5">Sport-specific nutrition setup</p>
          </div>
        </div>
      </div>

      {/* Form — fills remaining height, handles its own scroll + sticky footer */}
      <PerformanceNutritionSetupForm onSave={() => setLocation(returnTo)} />

    </div>
  );
}
