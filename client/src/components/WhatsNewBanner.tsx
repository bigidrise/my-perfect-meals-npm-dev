import { useState } from 'react';
import { X, Sparkles, RefreshCw } from 'lucide-react';
import { useReleaseNotice } from '@/hooks/useReleaseNotice';
import { currentRelease } from '@/lib/releaseNotes';

export function WhatsNewBanner() {
  const { showBanner, dismiss, update } = useReleaseNotice();
  const [expanded, setExpanded] = useState(false);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 safe-area-bottom">
      <div className="bg-black border border-orange-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {expanded ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400" />
                <span className="text-white font-semibold">What's New in v{currentRelease.version}</span>
              </div>
              <button onClick={() => setExpanded(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {currentRelease.bugFixes.length > 0 && (
              <div className="mb-3">
                <p className="text-orange-400 text-sm font-medium mb-1">Bug Fixes</p>
                <ul className="text-white/80 text-sm space-y-1">
                  {currentRelease.bugFixes.map((fix, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {currentRelease.designUpdates.length > 0 && (
              <div className="mb-4">
                <p className="text-orange-400 text-sm font-medium mb-1">Improvements</p>
                <ul className="text-white/80 text-sm space-y-1">
                  {currentRelease.designUpdates.map((update, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5">•</span>
                      <span>{update}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={update}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Now
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2 text-white/70 hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm">New update available</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(true)}
                className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm font-medium px-3 py-1 rounded-full transition-colors"
              >
                What's New
              </button>
              <button onClick={dismiss} className="text-white/40 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
