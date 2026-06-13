import { useState } from "react";
import { useLocation } from "wouter";
import { X, Lightbulb } from "lucide-react";

const DISMISS_KEY = "mpm.dismiss.tipsBanner";

export function TipsBanner() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border border-orange-500/25 bg-orange-950/30 px-4 py-3.5 flex gap-3 items-start">
      <div className="mt-0.5 flex-shrink-0">
        <Lightbulb className="w-4 h-4 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug">
          Get more out of My Perfect Meals
        </p>
        <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
          Hidden features, workflow shortcuts, and coaching strategies — all in one guide.
        </p>
        <button
          onClick={() => { dismiss(); setLocation("/tips"); }}
          className="mt-2 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold active:scale-[0.97] transition-transform"
        >
          Read the guide
        </button>
      </div>
      <button onClick={dismiss} className="p-1 text-white/30 active:text-white/60 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
