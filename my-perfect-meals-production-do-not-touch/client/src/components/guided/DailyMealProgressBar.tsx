
import { useEffect, useState } from "react";
import { getProgress, MealId } from "@/lib/mealProgress";

const MEALS: MealId[] = ["breakfast", "lunch", "dinner", "snack1", "snack2"];

export default function DailyMealProgressBar() {
  const [progress, setProgress] = useState(0);

  const updateProgress = () => {
    const data = getProgress();
    const total = MEALS.length;
    const done = MEALS.filter((m) => data[m]).length;
    const pct = Math.round((done / total) * 100);
    setProgress(pct > 100 ? 100 : pct);
  };

  useEffect(() => {
    updateProgress();
    // Listen for meal saved events
    const onSaved = () => updateProgress();
    window.addEventListener("meal:saved", onSaved as EventListener);
    return () => window.removeEventListener("meal:saved", onSaved as EventListener);
  }, []);

  if (progress === 0) {
    return (
      <div className="w-full bg-white/10 h-3 rounded-xl overflow-hidden mt-3 mb-6">
        <div
          className="h-full bg-gradient-to-r from-emerald-500/50 to-green-400/40 transition-all duration-500"
          style={{ width: "0%" }}
        />
      </div>
    );
  }

  return (
    <div className="w-full bg-white/10 h-3 rounded-xl overflow-hidden mt-3 mb-6 relative">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/80">
        {progress}% complete
      </span>
    </div>
  );
}
