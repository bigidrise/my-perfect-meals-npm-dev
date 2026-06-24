import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { WHATS_NEW_RELEASES, DISMISS_KEY } from "@/config/whatsNew";

export function WhatsNewCard() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const release = WHATS_NEW_RELEASES[0];

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    setDismissed(true);
  }

  return (
    <div className="rounded-2xl bg-black/60 border border-orange-500/30 overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              {release.headline}
            </p>
            <p className="text-[10px] text-orange-400/70 mt-0.5">
              {release.date} · v{release.version}
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 p-1 rounded-full bg-white/5 active:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-white/40" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {release.bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
            <p className="text-xs text-white/75 leading-snug">{b}</p>
          </div>
        ))}
      </div>

      <button
        onClick={dismiss}
        className="w-full py-2.5 border-t border-white/8 text-[11px] font-semibold text-orange-400 active:bg-white/5 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
