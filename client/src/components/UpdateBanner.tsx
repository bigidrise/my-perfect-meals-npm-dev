import { useState } from "react";
import { BUILD_VERSION } from "@/buildVersion";

const DISMISSED_KEY = `mpm_update_dismissed_${BUILD_VERSION}`;

interface UpdateBannerProps {
  show: boolean;
  releaseNotes?: string[];
  versionLabel?: string;
}

function RestartingOverlay() {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner */}
        <div className="w-12 h-12 rounded-full border-4 border-orange-500/30 border-t-orange-500 animate-spin" />
        <div className="text-center">
          <p className="text-white font-semibold text-base">Loading the latest</p>
          <p className="text-orange-400 font-bold text-lg">My Perfect Meals</p>
        </div>
      </div>
    </div>
  );
}

export function UpdateBanner({ show, releaseNotes = [], versionLabel }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1"
  );
  const [restarting, setRestarting] = useState(false);

  if (restarting) return <RestartingOverlay />;
  if (!show || dismissed) return null;

  const handleRestart = () => {
    setRestarting(true);
    setTimeout(() => window.location.reload(), 900);
  };

  const handleLater = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[#0f0f0f] border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Orange accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-orange-600 via-orange-400 to-orange-600" />

        <div className="px-5 pt-4 pb-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/20">
                  Update Ready
                </span>
              </div>
              <p className="text-white font-bold text-base leading-tight mt-1">
                My Perfect Meals
              </p>
              {versionLabel && (
                <p className="text-white/35 text-xs mt-0.5">{versionLabel}</p>
              )}
            </div>
            {/* Dismiss X */}
            <button
              onClick={handleLater}
              className="text-white/25 hover:text-white/50 transition-colors mt-0.5 flex-shrink-0"
              aria-label="Dismiss update"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <p className="text-white/60 text-sm leading-relaxed mb-4">
            A better version is ready. Restart to load the latest.
          </p>

          {/* What's new */}
          {releaseNotes.length > 0 && (
            <div className="mb-4 bg-white/[0.04] rounded-xl px-3.5 py-3 border border-white/[0.06]">
              <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">
                What's new
              </p>
              <ul className="space-y-1.5">
                {releaseNotes.slice(0, 4).map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/70 leading-relaxed">
                    <span className="mt-1 w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={handleRestart}
            className="w-full bg-orange-600 hover:bg-orange-500 active:scale-[0.98] transition-all text-white font-semibold text-sm rounded-xl py-2.5 text-center"
          >
            Restart My Perfect Meals
          </button>

          <button
            onClick={handleLater}
            className="w-full mt-2.5 text-white/35 hover:text-white/55 transition-colors text-xs font-medium text-center py-1"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
