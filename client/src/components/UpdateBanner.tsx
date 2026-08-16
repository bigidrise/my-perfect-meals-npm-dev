import { useState } from "react";
import { BUILD_VERSION } from "@/buildVersion";

const DISMISSED_KEY = `mpm_update_dismissed_${BUILD_VERSION}`;

interface UpdateBannerProps {
  show: boolean;
  releaseNotes?: string[];
}

export function UpdateBanner({ show, releaseNotes = [] }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-black/95 border border-orange-500/50 backdrop-blur-lg rounded-2xl px-5 py-4 shadow-lg shadow-orange-500/20">
        <p className="text-sm font-semibold text-white mb-2">What's new</p>

        {releaseNotes.length > 0 && (
          <ul className="mb-4 space-y-1">
            {releaseNotes.slice(0, 4).map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/75 leading-relaxed">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 text-sm font-semibold text-center bg-orange-600 text-white rounded-full py-2 active:scale-[0.98] transition-transform"
          >
            Refresh now
          </button>
          <button
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, "1");
              setDismissed(true);
            }}
            className="text-sm font-semibold text-white/40 active:scale-[0.98] transition-transform"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
