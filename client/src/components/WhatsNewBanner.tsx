import { useState } from 'react';
import { X, Sparkles, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useReleaseNotice } from '@/hooks/useReleaseNotice';

export function WhatsNewBanner() {
  const { showBanner, dismiss, update, releaseId, changes } = useReleaseNotice();
  const [expanded, setExpanded] = useState(false);

  if (!showBanner) return null;

  const hasChanges = changes.length > 0;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 safe-area-bottom">
      <div className="bg-black border border-orange-500/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => hasChanges && setExpanded(!expanded)}
              className="flex items-center gap-2 flex-1"
              disabled={!hasChanges}
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm font-medium">What's New in v{releaseId}</span>
              {hasChanges && (
                expanded 
                  ? <ChevronUp className="w-4 h-4 text-white/60" />
                  : <ChevronDown className="w-4 h-4 text-white/60" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={update}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1 rounded-full transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <button onClick={dismiss} className="text-white/40 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {expanded && hasChanges && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <ul className="space-y-2">
                {changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-2 text-white/80 text-sm">
                    <Check className="w-4 h-4 text-lime-400 mt-0.5 flex-shrink-0" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
