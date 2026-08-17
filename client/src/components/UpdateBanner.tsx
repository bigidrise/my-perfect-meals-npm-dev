/**
 * UpdateBanner
 *
 * Shown when a new customer-facing release is available and the user hasn't dismissed it.
 *
 * Hard guards (never reaches the user if violated):
 *   1. `show` must be true (new deployment detected by UpdateContext).
 *   2. `releaseNotes` must be non-empty — an empty "What's New" banner never renders.
 *   3. User must not have already dismissed this specific releaseId.
 *
 * Dismiss key is `mpm_update_dismissed_<releaseId>` — keyed to the customer-facing release,
 * NOT to BUILD_VERSION. This means routine technical redeployments (same releaseId, new
 * BUILD_VERSION) do not reset the user's dismissal state.
 */

import { useState } from "react";

interface UpdateBannerProps {
  show: boolean;
  releaseNotes?: string[];
  /** Customer-facing release ID — used as the stable dismiss key. */
  releaseId?: string;
}

export function UpdateBanner({ show, releaseNotes = [], releaseId = "" }: UpdateBannerProps) {
  // Dismiss key is stable across routine technical redeployments.
  // Falls back to a generic key if releaseId is not yet loaded (during hydration).
  const dismissKey = releaseId
    ? `mpm_update_dismissed_${releaseId}`
    : "mpm_update_dismissed_fallback";

  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey) === "1"
  );

  // Hard guard 1: no new deployment detected.
  // Hard guard 2: no release notes — NEVER show an empty "What's New" banner.
  if (!show || releaseNotes.length === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-black/95 border border-orange-500/50 backdrop-blur-lg rounded-2xl px-5 py-4 shadow-lg shadow-orange-500/20">
        <p className="text-sm font-semibold text-white mb-2">What's new</p>

        <ul className="mb-4 space-y-1">
          {releaseNotes.slice(0, 4).map((note, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-white/75 leading-relaxed">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              {note}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 text-sm font-semibold text-center bg-orange-600 text-white rounded-full py-2 active:scale-[0.98] transition-transform"
          >
            Refresh now
          </button>
          <button
            onClick={() => {
              localStorage.setItem(dismissKey, "1");
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
